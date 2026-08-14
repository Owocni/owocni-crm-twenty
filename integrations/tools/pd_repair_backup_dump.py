#!/usr/bin/env python3
"""Faza 2.3 — backup REST dump (companies/people z pipedriveId + opp PIPEDRIVE_LEGACY).

Użycie:
  python3 integrations/tools/pd_repair_backup_dump.py --run 20260804T065324Z
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from twenty_rest import load_env, paginate  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="20260804T065324Z")
    args = ap.parse_args()
    load_env()
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = (
        REPO_ROOT
        / "integrations"
        / "pipedrive-staging"
        / "runs"
        / args.run
        / "repair"
        / "backup"
        / ts
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    print("dump companies…")
    companies = paginate(
        "companies", "companies", "pipedriveId[is]:NOT_NULL", user_agent="owocni-pd-repair-backup/1.0"
    )
    print(f"  companies={len(companies)}")
    print("dump people…")
    people = paginate(
        "people", "people", "pipedriveId[is]:NOT_NULL", user_agent="owocni-pd-repair-backup/1.0"
    )
    print(f"  people={len(people)}")
    print("dump opportunities…")
    opps = paginate(
        "opportunities",
        "opportunities",
        "srcSystem[eq]:PIPEDRIVE_LEGACY",
        user_agent="owocni-pd-repair-backup/1.0",
    )
    print(f"  opportunities={len(opps)}")
    meta = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "counts": {
            "companies": len(companies),
            "people": len(people),
            "opportunities": len(opps),
        },
    }
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    (out_dir / "companies.json").write_text(
        json.dumps(companies, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (out_dir / "people.json").write_text(
        json.dumps(people, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (out_dir / "opportunities.json").write_text(
        json.dumps(opps, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps(meta, indent=2))
    print(f"→ {out_dir}")


if __name__ == "__main__":
    main()
