#!/usr/bin/env python3
"""Monday GO: align Twenty isFollowUp to live BB; list live BB without Twenty cards.

Does NOT create Opportunity. Flag PATCH only on existing matched cards.
"""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[6]
sys.path.insert(0, str(ROOT / "integrations" / "tools"))

from bb_supabase import (  # noqa: E402
    CLOSED_STAGES,
    OWNER_LABEL,
    OWNER_TWENTY,
    bb_get,
    company_emails,
    fetch_bb_leads,
    load_bb_env,
)
from twenty_rest import http_json, load_env, paginate  # noqa: E402

UA = "owocni-monday-flag-align/1.0"
OPEN = {"NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "CONTRACT_SENT", "PAYING"}
LIVE_STAGES = {"inquiry", "negotiations", "analysis", "reminder", "unsorted", "to_call"}
EXCLUDE_BB = CLOSED_STAGES | {"service"}
RUN_DIR = Path(__file__).resolve().parent
NOW = datetime.now(timezone.utc)
SINCE_30 = (NOW - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S")


def parse_dt(raw) -> datetime | None:
    if not raw:
        return None
    text = str(raw).replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def chunks(xs, n):
    for i in range(0, len(xs), n):
        yield xs[i : i + n]


def fetch_twenty_open() -> list[dict]:
    rows = []
    for oid in OWNER_TWENTY.values():
        rows.extend(
            paginate(
                "opportunities",
                "opportunities",
                f"ownerId[eq]:{oid}",
                user_agent=UA,
                pace=0.15,
                limit=100,
            )
        )
    return [o for o in rows if (o.get("stage") or "") in OPEN]


def fetch_bb_by_ids(ids: list[int]) -> dict[int, dict]:
    out: dict[int, dict] = {}
    for group in chunks(ids, 40):
        rows = bb_get(
            "leads",
            params={
                "id": f"in.({','.join(str(i) for i in group)})",
                "select": (
                    "id,title,stage_name,assigned_user_id,is_follow_up,"
                    "is_archived,created_at,last_modified_at,company_id"
                ),
                "limit": str(len(group)),
            },
        )
        for r in rows:
            out[int(r["id"])] = r
        time.sleep(0.1)
    return out


def emails_for_company(cid) -> list[str]:
    if not cid:
        return []
    links = bb_get(
        "company_email_addresses",
        params={"company_id": f"eq.{cid}", "select": "email_address_id", "limit": "20"},
    )
    eids = [x["email_address_id"] for x in links]
    if not eids:
        return []
    eas = bb_get(
        "email_addresses",
        params={
            "id": f"in.({','.join(map(str, eids))})",
            "select": "email",
            "limit": "20",
        },
    )
    return [str(e.get("email") or "").strip().lower() for e in eas if e.get("email")]


def main() -> None:
    load_bb_env()
    load_env()
    RUN_DIR.mkdir(parents=True, exist_ok=True)

    print("fetch Twenty open…", flush=True)
    opps = fetch_twenty_open()
    print(f"twenty open={len(opps)}", flush=True)

    by_bb: dict[str, dict] = {}
    by_email: dict[str, list[dict]] = {}
    for o in opps:
        bid = (o.get("bitrixDealId") or "").strip().lower()
        if bid.startswith("bb:"):
            by_bb[bid] = o
        em = (o.get("bizCardEmail") or "").strip().lower()
        if em:
            by_email.setdefault(em, []).append(o)

    bb_ids = []
    for bid in by_bb:
        try:
            bb_ids.append(int(bid.split(":", 1)[1]))
        except ValueError:
            continue
    print(f"fetch BB live for {len(bb_ids)} linked ids…", flush=True)
    bb_map = fetch_bb_by_ids(bb_ids)

    planned = []
    skipped = []
    for bid, o in by_bb.items():
        try:
            nid = int(bid.split(":", 1)[1])
        except ValueError:
            skipped.append({"id": o.get("id"), "why": "bad_bitrixDealId", "bid": bid})
            continue
        bb = bb_map.get(nid)
        if not bb:
            skipped.append({"id": o.get("id"), "why": "bb_not_found", "bid": bid})
            continue
        if bb.get("is_archived"):
            skipped.append({"id": o.get("id"), "why": "bb_archived", "bb_id": nid})
            continue
        if (bb.get("stage_name") or "") in CLOSED_STAGES:
            skipped.append({"id": o.get("id"), "why": "bb_closed", "bb_id": nid})
            continue
        fu = bb.get("is_follow_up")
        if fu is None:
            skipped.append({"id": o.get("id"), "why": "bb_fu_null", "bb_id": nid})
            continue
        snooze = parse_dt(o.get("snoozeUntil"))
        if snooze and snooze > NOW:
            skipped.append(
                {
                    "id": o.get("id"),
                    "why": "future_snooze",
                    "snoozeUntil": o.get("snoozeUntil"),
                    "bb_id": nid,
                    "bb_fu": fu,
                    "tw_fu": o.get("isFollowUp"),
                }
            )
            continue
        want = not bool(fu)
        have = o.get("isFollowUp")
        if bool(have) is want:
            continue
        planned.append(
            {
                "id": o.get("id"),
                "email": o.get("bizCardEmail"),
                "name": o.get("name"),
                "stage": o.get("stage"),
                "owner": OWNER_LABEL.get(bb.get("assigned_user_id"), "?"),
                "bb_id": nid,
                "bb_stage": bb.get("stage_name"),
                "bb_fu": fu,
                "before": have,
                "isFollowUp": want,
                "why": "bb_waiting" if fu else "bb_our_turn",
            }
        )

    print(f"flag diffs={len(planned)} skipped={len(skipped)}", flush=True)
    (RUN_DIR / "flag_align_plan.json").write_text(
        json.dumps(
            {
                "plannedAt": NOW.isoformat(),
                "twenty_open": len(opps),
                "linked_bb": len(bb_ids),
                "planned": planned,
                "skipped": skipped,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    applied = []
    for i, row in enumerate(planned, 1):
        oid = row["id"]
        st0, res0 = http_json("GET", f"/opportunities/{oid}", user_agent=UA)
        before = (res0.get("data") or {}).get("opportunity") or {}
        st, res = http_json(
            "PATCH",
            f"/opportunities/{oid}",
            {"isFollowUp": row["isFollowUp"]},
            user_agent=UA,
        )
        time.sleep(0.25)
        ok = st in (200, 201)
        rec = {
            **row,
            "http": st,
            "ok": ok,
            "rollback": {
                "opportunity_id": oid,
                "isFollowUp": before.get("isFollowUp"),
            },
        }
        if not ok:
            rec["error"] = (res.get("error") or "")[:400]
        applied.append(rec)
        print(
            f"  {i}/{len(planned)} {row['why']} {row.get('email')} → {row['isFollowUp']} http={st}",
            flush=True,
        )

    (RUN_DIR / "flag_align_apply.json").write_text(
        json.dumps(
            {
                "run": "20260912T205000Z",
                "no_emit": True,
                "appliedAt": datetime.now(timezone.utc).isoformat(),
                "ok": sum(1 for r in applied if r.get("ok")),
                "fail": sum(1 for r in applied if not r.get("ok")),
                "on": sum(1 for r in applied if r.get("ok") and r.get("isFollowUp") is True),
                "off": sum(1 for r in applied if r.get("ok") and r.get("isFollowUp") is False),
                "records": applied,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    print("fetch BB 30d + our-turn for gap list…", flush=True)
    bb_30 = fetch_bb_leads(days=30, include_closed=False)
    our_turn = []
    for oid in OWNER_TWENTY:
        rows = bb_get(
            "leads",
            params={
                "assigned_user_id": f"eq.{oid}",
                "is_archived": "eq.false",
                "is_follow_up": "eq.false",
                "stage_name": "not.in.(lead_won,lead_lost,service)",
                "select": (
                    "id,title,stage_name,assigned_user_id,is_follow_up,"
                    "created_at,last_modified_at,company_id"
                ),
                "order": "created_at.desc",
                "limit": "300",
            },
        )
        our_turn.extend(rows)
        time.sleep(0.1)

    by_id: dict[int, dict] = {}
    for r in bb_30:
        if (r.get("stage_name") or "") in EXCLUDE_BB:
            continue
        by_id[int(r["id"])] = r
    for r in our_turn:
        if (r.get("stage_name") or "") in EXCLUDE_BB:
            continue
        by_id.setdefault(int(r["id"]), r)

    missing = []
    matched = 0
    for nid, r in sorted(by_id.items(), reverse=True):
        emails = r.get("emails") or []
        if not emails and r.get("company_id"):
            emails = emails_for_company(r.get("company_id"))
            r["emails"] = emails
            time.sleep(0.05)
        tw = by_bb.get(f"bb:{nid}")
        via = "bitrixDealId"
        if not tw:
            for em in emails:
                cands = by_email.get(em) or []
                if cands:
                    tw = cands[0]
                    via = "email"
                    break
        created = r.get("created_at") or ""
        modified = r.get("last_modified_at") or ""
        recent = created >= SINCE_30 or modified >= SINCE_30
        stage = r.get("stage_name") or ""
        live_stage = stage in LIVE_STAGES or stage in {"inquiry", "negotiations"}
        fu = r.get("is_follow_up")
        buckets = []
        if recent and live_stage:
            buckets.append("recent_30d")
        if fu is False and live_stage:
            buckets.append("our_turn")
        if not buckets:
            continue
        if tw:
            matched += 1
            continue
        missing.append(
            {
                "bb_id": nid,
                "owner": OWNER_LABEL.get(r.get("assigned_user_id"), "?"),
                "stage": stage,
                "is_follow_up": fu,
                "title": r.get("title"),
                "emails": emails,
                "created_at": created,
                "last_modified_at": modified,
                "buckets": buckets,
                "create_candidate": "recent_30d" in buckets,
            }
        )

    by_owner = {}
    by_bucket = {"recent_30d": 0, "our_turn_only": 0, "both": 0}
    for m in missing:
        by_owner[m["owner"]] = by_owner.get(m["owner"], 0) + 1
        has_r = "recent_30d" in m["buckets"]
        has_t = "our_turn" in m["buckets"]
        if has_r and has_t:
            by_bucket["both"] += 1
        elif has_r:
            by_bucket["recent_30d"] += 1
        else:
            by_bucket["our_turn_only"] += 1

    create_candidates = [m for m in missing if m.get("create_candidate")]
    gap = {
        "listedAt": datetime.now(timezone.utc).isoformat(),
        "no_create": True,
        "sitko": "open inquiry/negotiations/analysis (+reminder/unsorted); 30d OR our-turn; no Twenty card",
        "bb_considered": len(by_id),
        "matched_existing_twenty": matched,
        "missing_total": len(missing),
        "create_candidates_recent_30d": len(create_candidates),
        "by_owner": by_owner,
        "by_bucket": by_bucket,
        "missing": missing,
    }
    (RUN_DIR / "live_bb_without_twenty.json").write_text(
        json.dumps(gap, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps({k: gap[k] for k in gap if k != "missing"}, indent=2), flush=True)
    print(f"→ {RUN_DIR}", flush=True)


if __name__ == "__main__":
    main()
