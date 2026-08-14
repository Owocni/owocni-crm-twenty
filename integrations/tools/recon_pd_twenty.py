#!/usr/bin/env python3
"""Faza 2.3 / bilans — recon PD staging ↔ Twenty (firmy z pipedriveId).

Użycie:
  python3 integrations/tools/recon_pd_twenty.py --run 20260804T065324Z
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pd_company_map import expected_orgs, resolve_run  # noqa: E402
from twenty_rest import load_env, paginate  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="20260804T065324Z")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    load_env()
    run = resolve_run(args.run)
    expected = expected_orgs(run)
    exp_ids = {str(o["id"]) for o in expected}
    twenty = paginate(
        "companies",
        "companies",
        "pipedriveId[is]:NOT_NULL",
        user_agent="owocni-recon-pd-twenty/1.0",
    )
    tw_ids = {str(c.get("pipedriveId")) for c in twenty if c.get("pipedriveId")}
    missing = sorted(exp_ids - tw_ids, key=lambda x: int(x) if x.isdigit() else 0)
    extra = sorted(tw_ids - exp_ids, key=lambda x: int(x) if x.isdigit() else 0)
    with_domain = sum(
        1
        for c in twenty
        if ((c.get("domainName") or {}).get("primaryLinkUrl") or "").strip()
    )
    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "run": run.name,
        "pd_expected": len(expected),
        "twenty_pipedriveId": len(twenty),
        "twenty_unique_pipedriveId": len(tw_ids),
        "balance_expected_minus_twenty": len(expected) - len(tw_ids & exp_ids),
        "missing_count": len(missing),
        "extra_count": len(extra),
        "missing_pipedriveIds": missing,
        "extra_pipedriveIds_outside_window_or_junk": extra,
        "twenty_with_domainName": with_domain,
        "twenty_domain_pct": round(100.0 * with_domain / max(1, len(twenty)), 1),
    }
    out = Path(args.out) if args.out else run / "repair" / "recon.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    summary = {k: report[k] for k in report if "pipedriveIds" not in k}
    print(json.dumps(summary, indent=2))
    print(f"→ {out}")


if __name__ == "__main__":
    main()
