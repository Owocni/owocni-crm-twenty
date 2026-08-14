#!/usr/bin/env python3
"""Faza 3.0 — import brakujących organizacji PD → Twenty Company.

Domyślnie dry-run. --apply tworzy rekordy (pacing ≥0.4s).

Użycie:
  python3 integrations/tools/import_missing_pd_orgs.py --run 20260804T065324Z
  python3 integrations/tools/import_missing_pd_orgs.py --run 20260804T065324Z --apply
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pd_company_map import expected_orgs, map_company_fields, resolve_run  # noqa: E402
from twenty_rest import http_json, load_env, paginate  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="20260804T065324Z")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    load_env()
    run = resolve_run(args.run)
    repair = run / "repair"
    repair.mkdir(parents=True, exist_ok=True)

    expected = expected_orgs(run)
    existing = paginate(
        "companies",
        "companies",
        "pipedriveId[is]:NOT_NULL",
        user_agent="owocni-import-missing-pd-orgs/1.0",
    )
    have = {str(c["pipedriveId"]) for c in existing if c.get("pipedriveId")}
    missing = [o for o in expected if str(o["id"]) not in have]
    if args.limit:
        missing = missing[: args.limit]

    results = []
    for org in missing:
        body = map_company_fields(org)
        row = {
            "pipedriveId": str(org["id"]),
            "name": body.get("name"),
            "has_domain": bool(body.get("domainName")),
            "mode": "apply" if args.apply else "dry-run",
        }
        if args.apply:
            st, res = http_json(
                "POST", "/companies", body, user_agent="owocni-import-missing-pd-orgs/1.0"
            )
            row["status"] = st
            data = res.get("data") or {}
            created = data.get("createCompany") or data.get("company") or {}
            row["twentyId"] = created.get("id") if isinstance(created, dict) else None
            if st not in (200, 201):
                row["error"] = res.get("error") or res
            time.sleep(0.45)
        results.append(row)
        print(
            f"{'CREATE' if args.apply else 'WOULD'} {row['pipedriveId']} {row['name']}"
            f" domain={row['has_domain']}"
            + (f" st={row.get('status')}" if args.apply else "")
        )

    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "apply": args.apply,
        "expected": len(expected),
        "already": len(have),
        "missing_total": len([o for o in expected if str(o["id"]) not in have]),
        "processed": len(results),
        "results": results,
    }
    path = repair / ("import_missing_orgs_apply.json" if args.apply else "import_missing_orgs_dry.json")
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"done processed={len(results)} → {path}")


if __name__ == "__main__":
    main()
