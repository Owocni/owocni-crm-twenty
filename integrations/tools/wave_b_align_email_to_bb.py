#!/usr/bin/env python3
"""Wave B: align open TWENTY_EMAIL opps to Better Bitrix state (owner/stage/bb id).

Uses ghost_scan_20260828.json `with_bb`, minus wave-A duplicates and test emails.
Re-validates live before PATCH.

Guards:
  - opp still exists, srcSystem == TWENTY_EMAIL
  - BB stage mappable and not service/won/lost
  - BB owner in Marta/Gosia/Maciej map
  - do NOT move Twenty stage backward if user already advanced past BB target
  - skip if already aligned (owner+stage+bitrixDealId)

Dry-run default; --apply to mutate.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bb_supabase import OWNER_TWENTY, OWNER_LABEL  # noqa: E402
from twenty_rest import http_json, load_env  # noqa: E402

UA = "owocni-wave-b-align/1.0"
SCAN = (
    Path(__file__).resolve().parents[1]
    / "runbooks"
    / "exports"
    / "bb_sync"
    / "ghost_scan_20260828.json"
)
OUT = SCAN.parent

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
}
STAGE_RANK = {
    "NEW": 0,
    "CONTACTED": 1,
    "QUALIFIED": 2,
    "PROPOSAL": 3,
    "CONTRACT_SENT": 4,
    "PAYING": 5,
    "WON": 6,
    "LOST": 6,
}
SKIP_BB_STAGES = frozenset({"service", "lead_won", "lead_lost"})
TEST_EMAIL_SUBSTR = ("fastman.eu", "invitely.", "liderbudowlany.pl")
PRODUCT_MAP = {
    "strona": "WEB",
    "logo": "LOGO",
    "nazwa": "NAME",
    "marketing": "MARKETING",
    "copywriting": "COPYWRITING",
    "opakowanie": "OPAKOWANIE",
    "inne": "INNE",
}


def snap(opp_id: str) -> dict:
    st, res = http_json("GET", f"/opportunities/{opp_id}", user_agent=UA)
    if st != 200:
        return {"id": opp_id, "http_status": st, "error": True}
    o = (res.get("data") or {}).get("opportunity") or {}
    return {
        "id": o.get("id"),
        "name": o.get("name"),
        "stage": o.get("stage"),
        "ownerId": o.get("ownerId"),
        "srcSystem": o.get("srcSystem"),
        "bitrixDealId": o.get("bitrixDealId"),
        "idOid": o.get("idOid"),
        "bizProduct": o.get("bizProduct"),
        "bizCardEmail": o.get("bizCardEmail"),
    }


def label_owner(oid: str | None) -> str:
    m = {
        OWNER_TWENTY[257]: "Gosia",
        OWNER_TWENTY[259]: "Marta",
        OWNER_TWENTY[79]: "Maciej",
    }
    return m.get(oid or "", (oid or "")[:8])


def candidates_from_scan(scan: dict) -> list[dict]:
    dups = {d["opp_id"] for d in scan.get("duplicates") or []}
    out = []
    for d in scan.get("with_bb") or []:
        em = (d.get("email") or "").lower()
        if any(x in em for x in TEST_EMAIL_SUBSTR):
            continue
        if d["opp_id"] in dups:
            continue
        out.append(d)
    return out


def plan_one(d: dict, live: dict) -> tuple[str, dict | None]:
    """Return (decision, patch_or_none)."""
    if live.get("error") or not live.get("id"):
        return "gone", None
    if live.get("srcSystem") != "TWENTY_EMAIL":
        return f"skip_src_{live.get('srcSystem')}", None

    bb_stage = d.get("bb_stage") or ""
    if bb_stage in SKIP_BB_STAGES:
        return f"skip_bb_stage_{bb_stage}", None
    target_stage = BB_TO_TWENTY_STAGE.get(bb_stage)
    if not target_stage:
        return f"skip_unmapped_bb_stage_{bb_stage}", None

    bb_owner_raw = d.get("bb_owner")
    # ghost_scan stored label or numeric id
    owner_id = None
    if bb_owner_raw in ("Gosia", "Marta", "Maciej"):
        rev = {"Gosia": 257, "Marta": 259, "Maciej": 79}
        owner_id = OWNER_TWENTY[rev[bb_owner_raw]]
    else:
        try:
            owner_id = OWNER_TWENTY.get(int(bb_owner_raw))
        except (TypeError, ValueError):
            owner_id = None
    if not owner_id:
        return f"skip_bb_owner_{bb_owner_raw}", None

    cur_stage = live.get("stage") or "NEW"
    cur_rank = STAGE_RANK.get(cur_stage, -1)
    tgt_rank = STAGE_RANK.get(target_stage, -1)
    # If Twenty already further than BB target — keep stage, still stamp bb link/owner if needed
    keep_stage = cur_stage if cur_rank > tgt_rank else target_stage
    stage_guard = cur_rank > tgt_rank

    bitrix = f"bb:{d['bb_id']}"
    patch: dict = {
        "ownerId": owner_id,
        "stage": keep_stage,
        "bitrixDealId": bitrix,
        "srcSystem": "BETTER_BITRIX_LEGACY",
        "bizSource": "MANUAL",
        "campaignRejected": False,
    }
    if live.get("idOid"):
        patch["idOid"] = live["idOid"]

    already = (
        live.get("ownerId") == owner_id
        and live.get("stage") == keep_stage
        and live.get("bitrixDealId") == bitrix
        and live.get("srcSystem") == "BETTER_BITRIX_LEGACY"
    )
    if already:
        return "already_aligned", None

    return ("align_keep_stage" if stage_guard else "align"), patch


def run(*, apply: bool) -> dict:
    load_env()
    scan = json.loads(SCAN.read_text(encoding="utf-8"))
    cands = candidates_from_scan(scan)
    evidence: dict = {
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "apply": apply,
        "aligned": [],
        "skipped": [],
        "failed": [],
    }
    print(f"Wave B candidates: {len(cands)}", flush=True)

    # Pre-plan with live snaps; collapse duplicate bb_id → one align + archive others
    planned: list[dict] = []
    for d in cands:
        live = snap(d["opp_id"])
        decision, patch = plan_one(d, live)
        planned.append(
            {
                "email": d.get("email"),
                "opp_id": d["opp_id"],
                "bb_id": d.get("bb_id"),
                "bb_stage": d.get("bb_stage"),
                "bb_owner": d.get("bb_owner"),
                "before": live,
                "decision": decision,
                "patch": patch,
            }
        )

    # Among alignable rows sharing bb_id, keep best (highest stage, else oldest created name)
    by_bb: dict = {}
    for row in planned:
        if row["decision"] not in ("align", "align_keep_stage") or not row.get("patch"):
            continue
        by_bb.setdefault(row["bb_id"], []).append(row)
    archive_ids = set()
    for bb_id, rows in by_bb.items():
        if len(rows) < 2:
            continue
        rows_sorted = sorted(
            rows,
            key=lambda r: (
                -STAGE_RANK.get((r["before"] or {}).get("stage") or "NEW", 0),
                (r["before"] or {}).get("name") or "",
            ),
        )
        winner = rows_sorted[0]
        for loser in rows_sorted[1:]:
            archive_ids.add(loser["opp_id"])
            print(
                f"  DEDUPE bb:{bb_id} keep {winner['opp_id'][:8]} archive {loser['opp_id'][:8]} {loser.get('email')}",
                flush=True,
            )

    for row in planned:
        decision = row["decision"]
        patch = row["patch"]
        live = row["before"]
        email = row.get("email")

        if row["opp_id"] in archive_ids:
            decision = "archive_dup_bb"
            patch = {
                "stage": "LOST",
                "name": f"[dup bb:{row['bb_id']}] {email or live.get('name')}",
            }
            row["decision"] = decision
            row["patch"] = patch

        if decision.startswith("skip") or decision in ("gone", "already_aligned"):
            evidence["skipped"].append(row)
            print(f"  SKIP {email} — {decision}", flush=True)
            continue

        if decision == "archive_dup_bb":
            print(f"  LOST dup {email} bb:{row['bb_id']}", flush=True)
        else:
            print(
                f"  ALIGN {email} | {live.get('stage')}→{patch['stage']} | "
                f"{label_owner(live.get('ownerId'))}→{label_owner(patch['ownerId'])} | "
                f"bb:{row.get('bb_id')} ({decision})",
                flush=True,
            )

        if apply:
            st, res = http_json(
                "PATCH", f"/opportunities/{row['opp_id']}", patch, user_agent=UA
            )
            row["http_status"] = st
            row["ok"] = st in (200, 201)
            if st not in (200, 201):
                row["error"] = res
                evidence["failed"].append(row)
                print(f"    FAIL {st}", flush=True)
            else:
                time.sleep(0.35)
                row["after"] = snap(row["opp_id"])
                evidence["aligned"].append(row)
        else:
            evidence["aligned"].append(row)

    evidence["finishedAt"] = datetime.now(timezone.utc).isoformat()
    evidence["counts"] = {
        "candidates": len(cands),
        "aligned": len(evidence["aligned"]),
        "skipped": len(evidence["skipped"]),
        "failed": len(evidence["failed"]),
        "align_ok": sum(1 for r in evidence["aligned"] if r.get("ok")),
    }
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    mode = "apply" if apply else "dryrun"
    path = OUT / f"wave_b_align_{mode}_{stamp}.json"
    path.write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\n{json.dumps(evidence['counts'], indent=2)}\n→ {path}", flush=True)
    return evidence


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    run(apply=args.apply)


if __name__ == "__main__":
    main()
