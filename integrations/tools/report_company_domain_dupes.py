#!/usr/bin/env python3
"""Faza 4.1 — raport dubli firm po domenie (PD shell ↔ auto-mint).

Źródła:
  A) firmy z domainName w Twenty pogrupowane po hostcie
  B) firmy PD bez domainName, których domena ze stagingu koliduje z A

Użycie:
  python3 integrations/tools/report_company_domain_dupes.py --run 20260804T065324Z
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import time
import urllib.parse
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pd_company_map import (  # noqa: E402
    domain_from_urlish,
    expected_orgs,
    map_company_fields,
    resolve_run,
)
from twenty_rest import http_json, load_env, paginate  # noqa: E402

UA = "owocni-report-company-domain-dupes/1.0"


def host_of(company: dict) -> str | None:
    url = ((company.get("domainName") or {}).get("primaryLinkUrl") or "").strip()
    if not url:
        return None
    return domain_from_urlish(url)


def count_related(company_id: str) -> dict[str, int]:
    """Cheap counts via totalCount filters."""
    out = {}
    for coll, key, filt in (
        ("people", "people", f"companyId[eq]:{company_id}"),
        ("opportunities", "opportunities", f"companyId[eq]:{company_id}"),
    ):
        st, payload = http_json(
            "GET",
            f"/{coll}?limit=1&filter={urllib.parse.quote(filt, safe='')}",
            user_agent=UA,
        )
        out[key] = int(payload.get("totalCount") or 0) if st == 200 else -1
        time.sleep(0.25)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="20260804T065324Z")
    ap.add_argument("--skip-counts", action="store_true", help="Faster: no opp/people counts")
    args = ap.parse_args()
    load_env()
    run = resolve_run(args.run)
    repair = run / "repair"
    repair.mkdir(parents=True, exist_ok=True)

    print("fetch companies with pipedriveId…")
    pd_cos = paginate(
        "companies", "companies", "pipedriveId[is]:NOT_NULL", user_agent=UA
    )
    pd_by_id = {c["id"]: c for c in pd_cos}
    pd_by_pid = {str(c["pipedriveId"]): c for c in pd_cos if c.get("pipedriveId")}

    print("fetch companies with domain…")
    with_domain = paginate(
        "companies",
        "companies",
        "domainName.primaryLinkUrl[is]:NOT_NULL",
        user_agent=UA,
    )
    by_host: dict[str, list[dict]] = defaultdict(list)
    for c in with_domain:
        h = host_of(c)
        if h:
            by_host[h].append(c)

    # Logical pairs: PD intended domain vs existing domain holder
    orgs = {str(o["id"]): o for o in expected_orgs(run)}
    pairs: list[dict] = []
    seen_pair: set[tuple[str, str]] = set()

    def add_pair(domain: str, winner: dict, loser: dict, reason: str) -> None:
        key = tuple(sorted([winner["id"], loser["id"]]))
        if key in seen_pair:
            return
        seen_pair.add(key)
        pairs.append(
            {
                "domain": domain,
                "reason": reason,
                "winner_id": winner["id"],
                "winner_name": winner.get("name"),
                "winner_pipedriveId": winner.get("pipedriveId") or "",
                "loser_id": loser["id"],
                "loser_name": loser.get("name"),
                "loser_pipedriveId": loser.get("pipedriveId") or "",
                "winner_has_domain": bool(host_of(winner)),
                "loser_has_domain": bool(host_of(loser)),
            }
        )

    # A) multi companies same host (shouldn't happen often due to unique)
    for host, cos in by_host.items():
        if len(cos) < 2:
            continue
        with_pd = [c for c in cos if (c.get("pipedriveId") or "").strip()]
        without = [c for c in cos if not (c.get("pipedriveId") or "").strip()]
        if with_pd and without:
            for w in with_pd:
                for l in without:
                    add_pair(host, w, l, "same_domain_multi")
        elif len(with_pd) >= 2:
            # keep first as winner, rest losers — rare
            for l in with_pd[1:]:
                add_pair(host, with_pd[0], l, "same_domain_two_pd")
        elif len(without) >= 2:
            for l in without[1:]:
                add_pair(host, without[0], l, "same_domain_two_automint")

    # B) PD without domain + automint holds intended domain (Faza 3.1 collisions)
    for pid, org in orgs.items():
        mapped = map_company_fields(org)
        domain = (mapped.get("domainName") or {}).get("primaryLinkLabel")
        if not domain:
            continue
        pd_co = pd_by_pid.get(pid)
        if not pd_co:
            continue
        if host_of(pd_co) == domain:
            continue  # already has domain — no collision partner needed
        holders = [c for c in by_host.get(domain, []) if c["id"] != pd_co["id"]]
        if not holders:
            continue
        # Prefer loser without pipedriveId
        losers = [c for c in holders if not (c.get("pipedriveId") or "").strip()] or holders
        for loser in losers:
            # Winner = PD (leads). If loser also has PD id, skip auto (manual)
            if (loser.get("pipedriveId") or "").strip() and loser.get("pipedriveId") != pid:
                add_pair(domain, pd_co, loser, "pd_vs_pd_domain_conflict")
            else:
                add_pair(domain, pd_co, loser, "pd_shell_vs_automint_domain")

    # Optional counts
    if not args.skip_counts:
        print(f"counting people/opps for {len(pairs)} pairs…")
        for i, p in enumerate(pairs):
            wc = count_related(p["winner_id"])
            lc = count_related(p["loser_id"])
            p["winner_people"] = wc["people"]
            p["winner_opps"] = wc["opportunities"]
            p["loser_people"] = lc["people"]
            p["loser_opps"] = lc["opportunities"]
            if (i + 1) % 20 == 0:
                print(f"  {i+1}/{len(pairs)}")

    # Filter actionable: only pairs where we merge into PD winner from non-PD loser
    actionable = [
        p
        for p in pairs
        if p["reason"] in ("pd_shell_vs_automint_domain", "same_domain_multi")
        and (p["winner_pipedriveId"] or "")
        and not (p["loser_pipedriveId"] or "")
    ]

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "run": run.name,
        "companies_with_domain": len(with_domain),
        "pd_companies": len(pd_cos),
        "pairs_total": len(pairs),
        "pairs_actionable": len(actionable),
        "pairs": pairs,
        "actionable": actionable,
    }
    json_path = repair / "domain_dupes.json"
    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    csv_path = repair / "domain_dupes.csv"
    fields = [
        "domain",
        "reason",
        "winner_id",
        "winner_name",
        "winner_pipedriveId",
        "loser_id",
        "loser_name",
        "loser_pipedriveId",
        "winner_has_domain",
        "loser_has_domain",
        "winner_people",
        "winner_opps",
        "loser_people",
        "loser_opps",
    ]
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for p in pairs:
            w.writerow(p)

    print(
        json.dumps(
            {
                "pairs_total": len(pairs),
                "pairs_actionable": len(actionable),
                "by_reason": {
                    r: sum(1 for p in pairs if p["reason"] == r)
                    for r in sorted({p["reason"] for p in pairs})
                },
            },
            indent=2,
        )
    )
    print(f"→ {json_path}")
    print(f"→ {csv_path}")


if __name__ == "__main__":
    main()
