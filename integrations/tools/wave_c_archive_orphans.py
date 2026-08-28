#!/usr/bin/env python3
"""Wave C: archive TWENTY_EMAIL NEW orphans with no BB email match.

Guards:
  - live srcSystem == TWENTY_EMAIL
  - live stage == NEW only (do not touch CONTACTED+)
  - not test emails (already cleaned)
  - createdAt older than --min-age-days (default 7) OR --all-new

Dry-run default; --apply to mutate.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from twenty_rest import http_json, load_env  # noqa: E402

UA = "owocni-wave-c-archive/1.0"
SCAN = (
    Path(__file__).resolve().parents[1]
    / "runbooks"
    / "exports"
    / "bb_sync"
    / "ghost_scan_20260828.json"
)
OUT = SCAN.parent
TEST_EMAIL_SUBSTR = ("fastman.eu", "invitely.", "liderbudowlany.pl")


def snap(opp_id: str) -> dict:
    st, res = http_json("GET", f"/opportunities/{opp_id}", user_agent=UA)
    if st != 200:
        return {"id": opp_id, "error": True, "http_status": st}
    o = (res.get("data") or {}).get("opportunity") or {}
    return {
        "id": o.get("id"),
        "name": o.get("name"),
        "stage": o.get("stage"),
        "ownerId": o.get("ownerId"),
        "srcSystem": o.get("srcSystem"),
        "createdAt": o.get("createdAt"),
        "bizCardEmail": o.get("bizCardEmail"),
    }


def parse_ts(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def run(*, apply: bool, min_age_days: int) -> dict:
    load_env()
    scan = json.loads(SCAN.read_text(encoding="utf-8"))
    cutoff = datetime.now(timezone.utc) - timedelta(days=min_age_days)
    evidence: dict = {
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "apply": apply,
        "min_age_days": min_age_days,
        "cutoff": cutoff.isoformat(),
        "archived": [],
        "skipped": [],
        "failed": [],
    }

    cands = []
    for d in scan.get("orphans_new") or []:
        em = (d.get("email") or "").lower()
        if any(x in em for x in TEST_EMAIL_SUBSTR):
            continue
        cands.append(d)

    print(f"Wave C orphans: {len(cands)} (age>{min_age_days}d → LOST)", flush=True)

    for d in cands:
        live = snap(d["opp_id"])
        row = {"email": d.get("email"), "opp_id": d["opp_id"], "before": live}
        if live.get("error"):
            row["decision"] = "gone"
            evidence["skipped"].append(row)
            continue
        if live.get("srcSystem") != "TWENTY_EMAIL":
            row["decision"] = f"skip_src_{live.get('srcSystem')}"
            evidence["skipped"].append(row)
            continue
        if live.get("stage") != "NEW":
            row["decision"] = f"skip_stage_{live.get('stage')}"
            evidence["skipped"].append(row)
            continue
        created = parse_ts(live.get("createdAt") or d.get("createdAt"))
        if created and created > cutoff:
            row["decision"] = "skip_too_fresh"
            evidence["skipped"].append(row)
            print(f"  SKIP fresh {d.get('email')} created {created.date()}", flush=True)
            continue

        em = d.get("email") or live.get("bizCardEmail") or "unknown"
        patch = {
            "stage": "LOST",
            "name": f"[brak BB] {em} — mail leads@ (archiwum)",
        }
        row["decision"] = "archive"
        row["patch"] = patch
        print(f"  LOST {em} | {live.get('createdAt', '')[:10]}", flush=True)

        if apply:
            st, res = http_json(
                "PATCH", f"/opportunities/{d['opp_id']}", patch, user_agent=UA
            )
            row["http_status"] = st
            row["ok"] = st in (200, 201)
            if st not in (200, 201):
                row["error"] = res
                evidence["failed"].append(row)
            else:
                time.sleep(0.3)
                evidence["archived"].append(row)
        else:
            evidence["archived"].append(row)

    evidence["finishedAt"] = datetime.now(timezone.utc).isoformat()
    evidence["counts"] = {
        "candidates": len(cands),
        "archived": len(evidence["archived"]),
        "skipped": len(evidence["skipped"]),
        "failed": len(evidence["failed"]),
        "archive_ok": sum(1 for r in evidence["archived"] if r.get("ok")),
    }
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    mode = "apply" if apply else "dryrun"
    path = OUT / f"wave_c_archive_{mode}_{stamp}.json"
    path.write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\n{json.dumps(evidence['counts'], indent=2)}\n→ {path}", flush=True)
    return evidence


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument(
        "--min-age-days",
        type=int,
        default=7,
        help="Only archive NEW older than N days (default 7)",
    )
    args = ap.parse_args()
    run(apply=args.apply, min_age_days=args.min_age_days)


if __name__ == "__main__":
    main()
