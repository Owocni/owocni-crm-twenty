#!/usr/bin/env python3
"""Sync otwartych leadów Better Bitrix (/lead) → Twenty.

Fazy:
  export  — pobierz BB → run/bb_leads.json
  plan    — match Twenty, dry-run CSV + review_list.json
  apply   — wykonaj (manifest do rollback)
  delta   — poniedziałek rano: zmiany BB od apply, bez nadpisywania edycji w Twenty
  rollback — przywróć stage/owner z manifestu apply

Scope domyślny: Marta/Gosia/Maciej, 30d, bez service/won/lost.

Przykład (pt apply):
  python3 integrations/tools/sync_bb_to_twenty.py export --run 20260828T120000Z
  python3 integrations/tools/sync_bb_to_twenty.py plan --run 20260828T120000Z
  python3 integrations/tools/sync_bb_to_twenty.py apply --run 20260828T120000Z

Poniedziałek delta:
  python3 integrations/tools/sync_bb_to_twenty.py delta --run 20260828T120000Z
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bb_supabase import (  # noqa: E402
    OWNER_LABEL,
    OWNER_TWENTY,
    fetch_bb_leads,
)
from twenty_rest import http_json, load_env, paginate  # noqa: E402

UA = "owocni-sync-bb-to-twenty/1.0"
RUNS = Path(__file__).resolve().parents[1] / "runbooks" / "exports" / "bb_sync" / "runs"
HOLDING_OWNER = "2d65d0e6-8a7f-4e6b-868f-07a6c4fd1f7d"
# Nie cofamy SQL / wpłaty / wygranej samym inquiry z BB.
PROTECTED_TWENTY_STAGES = frozenset({"QUALIFIED", "CONTRACT_SENT", "PAYING", "WON"})
BB_AHEAD_STAGES = frozenset({"WON", "LOST", "PAYING"})

BB_TO_TWENTY_STAGE = {
    "unsorted": "NEW",
    "to_call": "NEW",
    "reminder": "CONTACTED",
    "inquiry": "CONTACTED",
    "negotiations": "PROPOSAL",
    "pays": "PAYING",
    "analysis": "PROPOSAL",
    "call_after_offer": "PROPOSAL",
    "cold": "PROPOSAL",
    "hot": "PROPOSAL",
    "indifferent": "CONTACTED",
    "excited": "CONTACTED",
    "blackday": "CONTACTED",
    "error": "NEW",
    "lead_won": "WON",
    "lead_lost": "LOST",
}

PRODUCT_MAP = {
    "strona": "WEB",
    "logo": "LOGO",
    "nazwa": "NAME",
    "marketing": "MARKETING",
    "copywriting": "COPYWRITING",
    "opakowanie": "OPAKOWANIE",
    "inne": "INNE",
}


def run_dir(run_id: str) -> Path:
    p = RUNS / run_id
    p.mkdir(parents=True, exist_ok=True)
    return p


def map_stage(bb_stage: str) -> str | None:
    return BB_TO_TWENTY_STAGE.get(bb_stage or "")


def map_product(primary: str | None) -> str:
    return PRODUCT_MAP.get((primary or "").lower().strip(), "INNE")


def norm_email(s: str | None) -> str:
    return (s or "").strip().lower()


def extract_created_id(collection: str, payload: dict) -> str | None:
    data = payload.get("data") or {}
    key = collection.rstrip("s") if collection.endswith("ies") else collection
    if collection == "opportunities":
        obj = data.get("opportunity") or data.get("createOpportunity") or data
    elif collection == "people":
        obj = data.get("person") or data.get("createPerson") or data
    else:
        obj = data.get(collection[:-1]) or data
    if isinstance(obj, dict) and obj.get("id"):
        return str(obj["id"])
    if isinstance(data, dict) and data.get("id"):
        return str(data["id"])
    return None


def find_person_by_email(email: str) -> str | None:
    em = norm_email(email)
    if not em:
        return None
    st, payload = http_json(
        "GET",
        f"/people?limit=5&filter=emails.primaryEmail[eq]:{urllib_quote_email(em)}",
        user_agent=UA,
    )
    if st != 200:
        return None
    people = (payload.get("data") or {}).get("people") or []
    for p in people:
        pe = ((p.get("emails") or {}).get("primaryEmail") or "").lower()
        if pe == em:
            return p.get("id")
    return people[0].get("id") if people else None


def urllib_quote_email(email: str) -> str:
    import urllib.parse

    return urllib.parse.quote(email, safe="")


def prefetch_twenty_index(owner_ids: list[str]) -> tuple[dict[str, dict], dict[str, list[dict]]]:
    """bitrixDealId → opp; email → list opps (open only)."""
    by_bb: dict[str, dict] = {}
    by_email: dict[str, list[dict]] = {}
    # WON/LOST też — inaczej zamknięte karty z BB wychodzą jako fałszywe create.
    index_stages = {
        "NEW",
        "CONTACTED",
        "QUALIFIED",
        "PROPOSAL",
        "CONTRACT_SENT",
        "PAYING",
        "WON",
        "LOST",
    }
    seen: set[str] = set()
    for oid in owner_ids:
        opps = paginate("opportunities", "opportunities", f"ownerId[eq]:{oid}", user_agent=UA, pace=0.35)
        for o in opps:
            if o.get("stage") not in index_stages:
                continue
            rid = o.get("id")
            if rid and rid in seen:
                continue
            if rid:
                seen.add(rid)
            bid = (o.get("bitrixDealId") or "").strip()
            if bid:
                by_bb[bid] = o
            em = norm_email(o.get("bizCardEmail"))
            if em:
                by_email.setdefault(em, []).append(o)
    return by_bb, by_email


def resolve_match(bb: dict, by_bb: dict, by_email: dict) -> tuple[str | None, str, dict | None]:
    """Returns (action, reason, twenty_opp). action: patch|create|review"""
    bid = bb["bitrix_deal_id"]
    if bid in by_bb:
        return "patch", "bitrixDealId", by_bb[bid]

    emails = bb.get("emails") or []
    owner = OWNER_TWENTY.get(bb["assigned_user_id"])
    candidates: list[dict] = []
    for em in emails:
        for o in by_email.get(em, []):
            if o.get("ownerId") == owner:
                candidates.append(o)
            else:
                candidates.append(o)

    if len(candidates) == 1:
        return "patch", "email_single", candidates[0]
    if len(candidates) > 1:
        return "review", "email_ambiguous", None
    if emails:
        # email exists but other owner or closed — still review
        all_em = []
        for em in emails:
            all_em.extend(by_email.get(em, []))
        if all_em:
            return "review", "email_other_owner_or_dup", None
    if not emails:
        return "review", "no_email", None
    # Karta na innym ownerze / puste bizCardEmail — szukaj po Person.
    found: list[dict] = []
    for em in emails:
        pid = find_person_by_email(em)
        if not pid:
            continue
        extra = paginate(
            "opportunities",
            "opportunities",
            f"pointOfContactId[eq]:{pid}",
            user_agent=UA,
            pace=0.2,
            limit=50,
        )
        found.extend(extra)
    uniq: dict[str, dict] = {}
    for o in found:
        if o.get("id"):
            uniq[o["id"]] = o
    found = list(uniq.values())
    if len(found) == 1:
        return "patch", "person_single", found[0]
    if len(found) > 1:
        return "review", "person_ambiguous", None
    return "create", "no_match", None


def build_opp_name(bb: dict) -> str:
    emails = bb.get("emails") or []
    if emails:
        base = emails[0]
    elif bb.get("phones"):
        base = bb["phones"][0]
    else:
        base = "Lead"
    parts = [base]
    prod = (bb.get("primary_product") or "").strip()
    if prod:
        label = {"strona": "Strona", "logo": "Logo", "nazwa": "Naming", "copywriting": "Copywriting",
                 "marketing": "Marketing"}.get(prod.lower(), prod)
        parts.append(label)
    title = (bb.get("title") or "").strip()
    if title and title.lower() not in ("lead", "brak") and base not in title:
        pass  # keep compact name
    return " · ".join(parts)[:512]


def plan_row(bb: dict, by_bb: dict, by_email: dict) -> dict:
    stage = map_stage(bb.get("stage_name") or "")
    owner = OWNER_TWENTY.get(bb.get("assigned_user_id"))
    action, reason, tw = resolve_match(bb, by_bb, by_email)
    row = {
        "bb_id": bb["id"],
        "bb_title": bb.get("title"),
        "bb_stage": bb.get("stage_name"),
        "twenty_stage": stage,
        "bb_owner": bb.get("owner_label"),
        "twenty_owner_id": owner,
        "emails": bb.get("emails"),
        "bitrix_deal_id": bb["bitrix_deal_id"],
        "action": action,
        "match_reason": reason,
        "twenty_opp_id": tw.get("id") if tw else None,
        "twenty_opp_name_before": tw.get("name") if tw else None,
        "twenty_stage_before": tw.get("stage") if tw else None,
        "twenty_owner_before": tw.get("ownerId") if tw else None,
        "stage_hold": False,
        "patch_stage": stage,
        "needs_patch": False,
    }
    if action == "patch" and tw and stage and owner:
        tw_stage = tw.get("stage") or ""
        hold_stage = (
            tw_stage in PROTECTED_TWENTY_STAGES and stage not in BB_AHEAD_STAGES
        )
        row["stage_hold"] = hold_stage
        row["patch_stage"] = tw_stage if hold_stage else stage
        row["needs_patch"] = (
            (not hold_stage and tw_stage != stage)
            or tw.get("ownerId") != owner
            or not (tw.get("bitrixDealId") or "").strip()
        )
    return row


def cmd_export(args: argparse.Namespace) -> None:
    rd = run_dir(args.run)
    leads = fetch_bb_leads(
        days=args.days,
        owner_ids=[257, 259, 79],
        include_closed=args.include_closed,
    )
    out = {
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "days": args.days,
        "includeClosed": bool(args.include_closed),
        "count": len(leads),
        "leads": leads,
    }
    path = rd / "bb_leads.json"
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"run": args.run, "count": len(leads), "path": str(path)}, indent=2))


def cmd_plan(args: argparse.Namespace) -> None:
    load_env()
    rd = run_dir(args.run)
    src = rd / "bb_leads.json"
    if not src.is_file():
        raise SystemExit(f"Brak {src} — najpierw export")
    leads = json.loads(src.read_text(encoding="utf-8"))["leads"]
    print("prefetch Twenty index…", flush=True)
    by_bb, by_email = prefetch_twenty_index(
        list(OWNER_TWENTY.values()) + [HOLDING_OWNER]
    )

    rows = [plan_row(bb, by_bb, by_email) for bb in leads]
    review = [r for r in rows if r["action"] == "review"]
    patch = [r for r in rows if r["action"] == "patch"]
    create = [r for r in rows if r["action"] == "create"]

    summary = {
        "plannedAt": datetime.now(timezone.utc).isoformat(),
        "total": len(rows),
        "patch": len(patch),
        "create": len(create),
        "review": len(review),
        "review_reasons": {},
    }
    for r in review:
        summary["review_reasons"][r["match_reason"]] = summary["review_reasons"].get(r["match_reason"], 0) + 1

    (rd / "plan_summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    (rd / "review_list.json").write_text(json.dumps(review, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    csv_path = rd / "plan.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        if rows:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), extrasaction="ignore")
            w.writeheader()
            for r in rows:
                r2 = dict(r)
                r2["emails"] = ";".join(r2.get("emails") or [])
                w.writerow(r2)

    print(json.dumps(summary, indent=2), flush=True)
    print(f"→ {csv_path}\n→ {rd / 'review_list.json'}", flush=True)


def apply_one(row: dict, bb_by_id: dict, *, pace: float) -> dict:
    bb = bb_by_id[row["bb_id"]]
    stage = row["twenty_stage"]
    owner = row["twenty_owner_id"]
    result = dict(row)
    result["appliedAt"] = datetime.now(timezone.utc).isoformat()

    if row["action"] == "review":
        result["status"] = "skipped_review"
        return result

    if row["action"] == "patch":
        oid = row["twenty_opp_id"]
        patch_stage = row.get("patch_stage") or stage
        body: dict = {
            "stage": patch_stage,
            "ownerId": owner,
            "bitrixDealId": row["bitrix_deal_id"],
        }
        if patch_stage in ("WON", "LOST", "PAYING", "PROPOSAL", "CONTACTED"):
            body["isFollowUp"] = False
        if patch_stage == "WON":
            # inbound SKIP_LEGACY_IMPORT — zero purchase na historycznym WON
            body["srcSystem"] = "BETTER_BITRIX_LEGACY"
        # Stamp idOid from Person so later create_lead / mail path dedupes on same oid.
        st_p, res_p = http_json("GET", f"/opportunities/{oid}", user_agent=UA)
        opp_now = {}
        if st_p == 200:
            opp_now = (res_p.get("data") or {}).get("opportunity") or {}
            poc = opp_now.get("pointOfContactId")
            if poc and not opp_now.get("idOid"):
                st_pe, res_pe = http_json("GET", f"/people/{poc}", user_agent=UA)
                if st_pe == 200:
                    person = (res_pe.get("data") or {}).get("person") or {}
                    if person.get("idOid"):
                        body["idOid"] = person["idOid"]
            tw_now = opp_now.get("stage") or ""
            if tw_now in PROTECTED_TWENTY_STAGES and patch_stage not in BB_AHEAD_STAGES:
                body.pop("stage", None)
                body.pop("srcSystem", None)
        st, res = http_json("PATCH", f"/opportunities/{oid}", body, user_agent=UA)
        result["status"] = "patched" if st in (200, 201) else "patch_failed"
        result["http_status"] = st
        result["patched_fields"] = sorted(body.keys())
        if st not in (200, 201):
            result["error"] = res.get("error")
        result["rollback"] = {
            "opportunity_id": oid,
            "stage": row.get("twenty_stage_before") or opp_now.get("stage"),
            "ownerId": row.get("twenty_owner_before") or opp_now.get("ownerId"),
            "bitrixDealId": opp_now.get("bitrixDealId") or None,
            "isFollowUp": opp_now.get("isFollowUp"),
            "srcSystem": opp_now.get("srcSystem"),
        }
        time.sleep(pace)
        return result

    # create
    emails = bb.get("emails") or []
    person_id = find_person_by_email(emails[0]) if emails else None
    if emails and not person_id:
        pe_body = {
            "name": {"firstName": (bb.get("title") or emails[0].split("@")[0])[:120], "lastName": ""},
            "emails": {"primaryEmail": emails[0], "additionalEmails": emails[1:] or None},
        }
        st, res = http_json("POST", "/people", pe_body, user_agent=UA)
        person_id = extract_created_id("people", res) if st in (200, 201) else None
        time.sleep(pace)

    opp_body: dict = {
        "name": build_opp_name(bb),
        "stage": stage,
        "ownerId": owner,
        "srcSystem": "BETTER_BITRIX_LEGACY",
        "bizSource": "MANUAL",
        "bitrixDealId": row["bitrix_deal_id"],
        "bizProduct": map_product(bb.get("primary_product")),
        "campaignRejected": False,
        "isFollowUp": False,
    }
    if emails:
        opp_body["bizCardEmail"] = emails[0]
    if bb.get("phones"):
        opp_body["bizCardPhone"] = bb["phones"][0]
    if person_id:
        opp_body["pointOfContactId"] = person_id
        st_pe, res_pe = http_json("GET", f"/people/{person_id}", user_agent=UA)
        if st_pe == 200:
            person = (res_pe.get("data") or {}).get("person") or {}
            if person.get("idOid"):
                opp_body["idOid"] = person["idOid"]
    if bb.get("created_at"):
        opp_body["legacyCreatedAt"] = bb["created_at"]

    st, res = http_json("POST", "/opportunities", opp_body, user_agent=UA)
    oid = extract_created_id("opportunities", res) if st in (200, 201) else None
    result["status"] = "created" if oid else "create_failed"
    result["twenty_opp_id"] = oid
    result["http_status"] = st
    if not oid:
        result["error"] = res.get("error")
    else:
        result["rollback"] = {"opportunity_id": oid, "action": "delete", "created": True}
    time.sleep(pace)
    return result


def cmd_apply(args: argparse.Namespace) -> None:
    load_env()
    rd = run_dir(args.run)
    plan_path = rd / "plan.csv"
    if not plan_path.is_file():
        raise SystemExit("Brak plan.csv — najpierw plan")
    bb_data = json.loads((rd / "bb_leads.json").read_text(encoding="utf-8"))
    bb_by_id = {b["id"]: b for b in bb_data["leads"]}

    rows = []
    with plan_path.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            r["bb_id"] = int(r["bb_id"])
            np = r.get("needs_patch")
            if np == "True":
                r["needs_patch"] = True
            elif np == "False":
                r["needs_patch"] = False
            else:
                r["needs_patch"] = r.get("action") == "patch"
            if r.get("emails"):
                r["emails"] = [e for e in r["emails"].split(";") if e]
            rows.append(r)

    allowed = {a.strip() for a in (args.actions or "patch,create").split(",") if a.strip()}
    if args.limit:
        actionable = [r for r in rows if r["action"] in allowed][: args.limit]
    else:
        actionable = [r for r in rows if r["action"] in allowed]

    manifest = {
        "applyStartedAt": datetime.now(timezone.utc).isoformat(),
        "run": args.run,
        "mode": "apply",
        "records": [],
    }
    print(f"apply {len(actionable)} records…", flush=True)
    for i, row in enumerate(actionable):
        if row["action"] == "patch" and row.get("needs_patch") is False:
            rec = {**row, "status": "skipped_unchanged"}
            manifest["records"].append(rec)
            continue
        rec = apply_one(row, bb_by_id, pace=args.pace)
        manifest["records"].append(rec)
        print(f"[{i+1}/{len(actionable)}] bb={row['bb_id']} {rec['status']}", flush=True)
        manifest_path = rd / "apply_manifest.json"
        manifest["applyCompletedAt"] = datetime.now(timezone.utc).isoformat()
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    manifest["applyCompletedAt"] = datetime.now(timezone.utc).isoformat()
    (rd / "apply_manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    ok = sum(1 for r in manifest["records"] if r.get("status") in ("patched", "created", "skipped_unchanged"))
    print(json.dumps({"ok": ok, "total": len(manifest["records"])}, indent=2))
    print(f"→ {rd / 'apply_manifest.json'}", flush=True)


def cmd_delta(args: argparse.Namespace) -> None:
    """Monday: BB changes since apply; skip if Twenty diverged from our manifest snapshot."""
    load_env()
    rd = run_dir(args.run)
    manifest_path = rd / "apply_manifest.json"
    if not manifest_path.is_file():
        raise SystemExit("Brak apply_manifest.json")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    since = manifest.get("applyStartedAt") or manifest.get("applyCompletedAt")
    if not since:
        raise SystemExit("manifest bez applyStartedAt")

    snapshot: dict[str, dict] = {}
    for rec in manifest.get("records") or []:
        bid = rec.get("bitrix_deal_id") or f"bb:{rec.get('bb_id')}"
        if rec.get("status") in ("patched", "created"):
            snapshot[bid] = {
                "twenty_opp_id": rec.get("twenty_opp_id"),
                "stage": rec.get("twenty_stage"),
                "ownerId": rec.get("twenty_owner_id"),
            }

    bb_leads = fetch_bb_leads(modified_since=since[:19], owner_ids=[257, 259, 79])
    by_bb, by_email = prefetch_twenty_index(list(OWNER_TWENTY.values()))
    bb_by_id = {b["id"]: b for b in bb_leads}

    delta_records = []
    for bb in bb_leads:
        pr = plan_row(bb, by_bb, by_email)
        bid = bb["bitrix_deal_id"]
        snap = snapshot.get(bid)
        if not snap or not snap.get("twenty_opp_id"):
            # new since apply or was review — try apply path
            if pr["action"] in ("patch", "create"):
                rec = apply_one(pr, bb_by_id, pace=args.pace)
                delta_records.append({**rec, "delta_reason": "new_or_unlinked"})
            continue

        oid = snap["twenty_opp_id"]
        st, payload = http_json("GET", f"/opportunities/{oid}", user_agent=UA)
        time.sleep(args.pace)
        if st != 200:
            continue
        cur = ((payload.get("data") or {}).get("opportunity") or payload.get("data") or {})
        # User edited Twenty after our apply?
        if cur.get("stage") != snap.get("stage") or cur.get("ownerId") != snap.get("ownerId"):
            delta_records.append({
                "bb_id": bb["id"],
                "twenty_opp_id": oid,
                "status": "skipped_twenty_user_edit",
                "twenty_stage_now": cur.get("stage"),
                "snap_stage": snap.get("stage"),
            })
            continue
        target_stage = pr["twenty_stage"]
        target_owner = pr["twenty_owner_id"]
        if cur.get("stage") == target_stage and cur.get("ownerId") == target_owner:
            continue
        st2, res = http_json(
            "PATCH",
            f"/opportunities/{oid}",
            {"stage": target_stage, "ownerId": target_owner},
            user_agent=UA,
        )
        delta_records.append({
            "bb_id": bb["id"],
            "twenty_opp_id": oid,
            "status": "delta_patched" if st2 in (200, 201) else "delta_failed",
            "bb_stage": bb.get("stage_name"),
            "from_stage": cur.get("stage"),
            "to_stage": target_stage,
        })
        time.sleep(args.pace)

    out = {
        "deltaAt": datetime.now(timezone.utc).isoformat(),
        "since": since,
        "records": delta_records,
    }
    (rd / "delta_manifest.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"delta": len(delta_records), "patched": sum(1 for r in delta_records if r.get("status") == "delta_patched")}, indent=2))


def cmd_rollback(args: argparse.Namespace) -> None:
    load_env()
    rd = run_dir(args.run)
    manifest = json.loads((rd / "apply_manifest.json").read_text(encoding="utf-8"))
    restored = 0
    for rec in reversed(manifest.get("records") or []):
        rb = rec.get("rollback")
        if not rb:
            continue
        if rb.get("action") == "delete" and rb.get("created") and rec.get("twenty_opp_id"):
            st, _ = http_json("DELETE", f"/opportunities/{rec['twenty_opp_id']}", user_agent=UA)
            if st in (200, 204):
                restored += 1
            time.sleep(args.pace)
        elif rb.get("opportunity_id"):
            body = {k: v for k, v in rb.items() if k != "opportunity_id" and v is not None}
            st, _ = http_json("PATCH", f"/opportunities/{rb['opportunity_id']}", body, user_agent=UA)
            if st in (200, 201):
                restored += 1
            time.sleep(args.pace)
    print(json.dumps({"restored": restored}, indent=2))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["export", "plan", "apply", "delta", "rollback"])
    ap.add_argument("--run", required=True, help="Run id e.g. 20260828T140000Z")
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--pace", type=float, default=0.35)
    ap.add_argument(
        "--include-closed",
        action="store_true",
        help="Dołącz lead_won / lead_lost (domyślnie wycięte)",
    )
    ap.add_argument(
        "--actions",
        default="patch,create",
        help="Apply: które akcje z planu (np. patch). Domyślnie patch,create",
    )
    args = ap.parse_args()
    cmds = {
        "export": cmd_export,
        "plan": cmd_plan,
        "apply": cmd_apply,
        "delta": cmd_delta,
        "rollback": cmd_rollback,
    }
    cmds[args.command](args)


if __name__ == "__main__":
    main()
