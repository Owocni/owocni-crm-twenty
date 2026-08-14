#!/usr/bin/env python3
"""Faza 3.1 — backfill Company.domainName (+ address) z PD staging / URL-name.

Domyślnie dry-run. --apply patchuje tylko brakujące domainName.

Użycie:
  python3 integrations/tools/backfill_company_from_pd.py --run 20260804T065324Z
  python3 integrations/tools/backfill_company_from_pd.py --run 20260804T065324Z --apply
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


def has_domain(company: dict) -> bool:
    dn = company.get("domainName") or {}
    return bool((dn.get("primaryLinkUrl") or "").strip())


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

    orgs = {str(o["id"]): o for o in expected_orgs(run)}
    companies_list = paginate(
        "companies",
        "companies",
        "pipedriveId[is]:NOT_NULL",
        user_agent="owocni-backfill-company-from-pd/1.0",
    )
    companies = {str(c["pipedriveId"]): c for c in companies_list if c.get("pipedriveId")}

    candidates = []
    for pid, org in orgs.items():
        co = companies.get(pid)
        if not co:
            continue
        mapped = map_company_fields(org)
        if not mapped.get("domainName"):
            continue
        if has_domain(co):
            continue
        candidates.append((pid, co, mapped))

    if args.limit:
        candidates = candidates[: args.limit]

    results = []
    for pid, co, mapped in candidates:
        patch = {"domainName": mapped["domainName"]}
        if mapped.get("address") and not (co.get("address") or {}).get("addressStreet1"):
            patch["address"] = mapped["address"]
        row = {
            "pipedriveId": pid,
            "twentyId": co["id"],
            "name": co.get("name"),
            "domain": mapped["domainName"].get("primaryLinkLabel"),
            "mode": "apply" if args.apply else "dry-run",
        }
        if args.apply:
            st, res = http_json(
                "PATCH",
                f"/companies/{co['id']}",
                patch,
                user_agent="owocni-backfill-company-from-pd/1.0",
            )
            row["status"] = st
            if st not in (200, 201):
                row["error"] = res.get("error") or res
            time.sleep(0.45)
        results.append(row)
        print(
            f"{'PATCH' if args.apply else 'WOULD'} {pid} {row['name']} → {row['domain']}"
            + (f" st={row.get('status')}" if args.apply else "")
        )

    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "apply": args.apply,
        "pd_companies_in_twenty": len(companies),
        "processed": len(results),
        "results": results,
    }
    path = repair / ("backfill_company_apply.json" if args.apply else "backfill_company_dry.json")
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"done processed={len(results)} → {path}")


if __name__ == "__main__":
    main()
