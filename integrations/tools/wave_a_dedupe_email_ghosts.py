#!/usr/bin/env python3
"""Wave A: delete TWENTY_EMAIL NEW ghosts when BETTER_BITRIX_LEGACY open exists on same person.

Also deletes known test opps (fastman / invitely / liderbudowlany).

Guards:
  - ghost srcSystem == TWENTY_EMAIL
  - ghost stage == NEW
  - keep opp exists, srcSystem == BETTER_BITRIX_LEGACY, stage open
  - ghost stage NOT more advanced than keep (NEW never is)

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
from twenty_rest import http_json, load_env  # noqa: E402

UA = "owocni-wave-a-dedupe/1.0"
SCAN = (
    Path(__file__).resolve().parents[1]
    / "runbooks"
    / "exports"
    / "bb_sync"
    / "ghost_scan_20260828.json"
)
OUT = SCAN.parent
OPEN = {"NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "CONTRACT_SENT", "PAYING"}
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
TEST_EMAIL_SUBSTR = ("fastman.eu", "invitely.", "liderbudowlany.pl")


def snap(opp_id: str) -> dict:
    st, res = http_json("GET", f"/opportunities/{opp_id}", user_agent=UA)
    if st != 200:
        return {"id": opp_id, "http_status": st, "error": res}
    o = (res.get("data") or {}).get("opportunity") or {}
    return {
        "id": o.get("id"),
        "name": o.get("name"),
        "stage": o.get("stage"),
        "ownerId": o.get("ownerId"),
        "srcSystem": o.get("srcSystem"),
        "bitrixDealId": o.get("bitrixDealId"),
        "idOid": o.get("idOid"),
        "pointOfContactId": o.get("pointOfContactId"),
        "bizCardEmail": o.get("bizCardEmail"),
    }


def is_test_opp(s: dict) -> bool:
    em = (s.get("bizCardEmail") or "").lower()
    name = (s.get("name") or "").lower()
    blob = em + " " + name
    return any(x in blob for x in TEST_EMAIL_SUBSTR)


def safe_to_delete_ghost(ghost: dict, keep: dict) -> tuple[bool, str]:
    if ghost.get("srcSystem") != "TWENTY_EMAIL":
        return False, "ghost_not_twenty_email"
    if ghost.get("stage") != "NEW":
        return False, f"ghost_stage_{ghost.get('stage')}"
    if keep.get("srcSystem") != "BETTER_BITRIX_LEGACY":
        return False, "keep_not_bb_legacy"
    if keep.get("stage") not in OPEN:
        return False, f"keep_not_open_{keep.get('stage')}"
    if (ghost.get("pointOfContactId") or "") != (keep.get("pointOfContactId") or ""):
        return False, "person_mismatch"
    g = STAGE_RANK.get(ghost.get("stage") or "", -1)
    k = STAGE_RANK.get(keep.get("stage") or "", -1)
    if g > k:
        return False, "ghost_more_advanced"
    return True, "ok"


def run(*, apply: bool) -> dict:
    load_env()
    scan = json.loads(SCAN.read_text(encoding="utf-8"))
    evidence: dict = {
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "apply": apply,
        "wave_a": [],
        "tests": [],
        "skipped": [],
    }

    print(f"Wave A candidates from scan: {len(scan['duplicates'])}", flush=True)
    for d in scan["duplicates"]:
        ghost_id = d["opp_id"]
        keep_id = d["bb_twenty_opp"]
        ghost = snap(ghost_id)
        keep = snap(keep_id)
        ok, reason = safe_to_delete_ghost(ghost, keep)
        row = {
            "email": d.get("email"),
            "ghost_id": ghost_id,
            "keep_id": keep_id,
            "before_ghost": ghost,
            "before_keep": keep,
            "guard": reason,
        }
        if not ok:
            evidence["skipped"].append(row)
            print(f"  SKIP {d.get('email')} — {reason}", flush=True)
            continue
        print(
            f"  DELETE ghost NEW {ghost_id[:8]} | keep {keep.get('stage')} {keep.get('bitrixDealId')} | {d.get('email')}",
            flush=True,
        )
        if apply:
            st, _ = http_json("DELETE", f"/opportunities/{ghost_id}", user_agent=UA)
            row["delete_http"] = st
            row["delete_ok"] = st in (200, 204)
            # stamp idOid on keep if missing
            if not keep.get("idOid") and ghost.get("idOid"):
                st2, _ = http_json(
                    "PATCH",
                    f"/opportunities/{keep_id}",
                    {"idOid": ghost["idOid"]},
                    user_agent=UA,
                )
                row["stamp_http"] = st2
            time.sleep(0.35)
        evidence["wave_a"].append(row)

    # Test cleanup from with_bb + orphans + already listed
    test_ids = set()
    for bucket in ("with_bb", "orphans_new", "duplicates"):
        for d in scan.get(bucket) or []:
            em = (d.get("email") or "").lower()
            name = (d.get("name") or "").lower()
            if any(x in em or x in name for x in TEST_EMAIL_SUBSTR):
                test_ids.add(d["opp_id"])

    print(f"\nTest opps: {len(test_ids)}", flush=True)
    for oid in sorted(test_ids):
        s = snap(oid)
        if s.get("error") or not s.get("id"):
            evidence["tests"].append({"opp_id": oid, "skip": "gone", "snap": s})
            print(f"  SKIP gone {oid[:8]}", flush=True)
            continue
        # Prefer scan email if API bizCardEmail empty
        scan_email = ""
        for bucket in ("with_bb", "orphans_new", "duplicates"):
            for d in scan.get(bucket) or []:
                if d.get("opp_id") == oid:
                    scan_email = (d.get("email") or "").lower()
                    break
        blob = " ".join(
            [
                (s.get("bizCardEmail") or "").lower(),
                (s.get("name") or "").lower(),
                scan_email,
            ]
        )
        if not any(x in blob for x in TEST_EMAIL_SUBSTR):
            evidence["tests"].append({"opp_id": oid, "skip": "not_test", "snap": s, "scan_email": scan_email})
            print(f"  SKIP not_test {oid[:8]} blob={blob[:60]!r}", flush=True)
            continue
        print(
            f"  DELETE TEST {oid[:8]} {s.get('stage')} {scan_email or s.get('bizCardEmail') or s.get('name')}",
            flush=True,
        )
        row = {"opp_id": oid, "before": s, "scan_email": scan_email}
        if apply:
            st, _ = http_json("DELETE", f"/opportunities/{oid}", user_agent=UA)
            row["delete_http"] = st
            row["delete_ok"] = st in (200, 204)
            time.sleep(0.3)
        evidence["tests"].append(row)

    evidence["finishedAt"] = datetime.now(timezone.utc).isoformat()
    evidence["counts"] = {
        "wave_a_planned_or_deleted": len(evidence["wave_a"]),
        "wave_a_delete_ok": sum(1 for r in evidence["wave_a"] if r.get("delete_ok")),
        "skipped": len(evidence["skipped"]),
        "tests_planned_or_deleted": sum(
            1 for t in evidence["tests"] if "skip" not in t
        ),
        "tests_delete_ok": sum(1 for t in evidence["tests"] if t.get("delete_ok")),
    }
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    mode = "apply" if apply else "dryrun"
    path = OUT / f"wave_a_dedupe_{mode}_{stamp}.json"
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
