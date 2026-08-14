#!/usr/bin/env python3
"""Faza 5.1 — link people → companies.

Źródło A: Opportunity PIPEDRIVE_LEGACY — pointOfContact bez companyId → opp.companyId
Źródło B: domain-match (nie-freemail) — dry-run lista; apply tylko po review (--apply-domain)

Użycie:
  python3 integrations/tools/link_people_to_companies.py --run 20260804T065324Z
  python3 integrations/tools/link_people_to_companies.py --run 20260804T065324Z --apply-opp
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
from pd_company_map import FREE_MAIL, domain_from_urlish, resolve_run  # noqa: E402
from twenty_rest import http_json, load_env, paginate  # noqa: E402

UA = "owocni-link-people-to-companies/1.0"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="20260804T065324Z")
    ap.add_argument("--apply-opp", action="store_true", help="Apply source A (opp→person)")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    load_env()
    run = resolve_run(args.run)
    repair = run / "repair"

    print("fetch PIPEDRIVE_LEGACY opps…", flush=True)
    opps = paginate(
        "opportunities",
        "opportunities",
        "srcSystem[eq]:PIPEDRIVE_LEGACY",
        user_agent=UA,
    )
    print(f"  opps={len(opps)}", flush=True)

    # Source A candidates
    a_rows = []
    seen_person: set[str] = set()
    for o in opps:
        poc = o.get("pointOfContactId")
        cid = o.get("companyId")
        if not poc or not cid:
            continue
        if poc in seen_person:
            continue
        seen_person.add(poc)
        a_rows.append(
            {
                "personId": poc,
                "companyId": cid,
                "oppId": o.get("id"),
                "oppName": o.get("name"),
            }
        )

    # Filter: person missing companyId
    actionable_a = []
    for i, row in enumerate(a_rows):
        st, payload = http_json("GET", f"/people/{row['personId']}", user_agent=UA)
        person = (
            ((payload.get("data") or {}).get("person") or payload.get("data") or {})
            if st == 200
            else {}
        )
        if not isinstance(person, dict):
            continue
        if person.get("companyId"):
            continue
        row["personName"] = person.get("name")
        actionable_a.append(row)
        time.sleep(0.25)
        if (i + 1) % 100 == 0:
            print(f"  scanned persons {i+1}/{len(a_rows)} actionable={len(actionable_a)}", flush=True)
        if args.limit and len(actionable_a) >= args.limit and not args.apply_opp:
            break

    print(f"source A actionable (person w/o company, opp has company): {len(actionable_a)}", flush=True)

    results = []
    if args.apply_opp:
        for i, row in enumerate(actionable_a if not args.limit else actionable_a[: args.limit]):
            st, res = http_json(
                "PATCH",
                f"/people/{row['personId']}",
                {"companyId": row["companyId"]},
                user_agent=UA,
            )
            r = {**row, "status": st, "ok": st in (200, 201)}
            if st not in (200, 201):
                r["error"] = res.get("error")
            results.append(r)
            time.sleep(0.4)
            if (i + 1) % 25 == 0:
                print(f"  patched {i+1}/{len(actionable_a)}", flush=True)

    # Source B: domain proposals (report only)
    print("fetch PD companies with domain for source B…", flush=True)
    cos = paginate("companies", "companies", "pipedriveId[is]:NOT_NULL", user_agent=UA)
    domain_to_cos: dict[str, list[dict]] = defaultdict(list)
    for c in cos:
        url = ((c.get("domainName") or {}).get("primaryLinkUrl") or "").strip()
        d = domain_from_urlish(url)
        if d and d not in FREE_MAIL:
            domain_to_cos[d].append(c)

    print("fetch people with pipedriveId missing company…", flush=True)
    people = paginate("people", "people", "pipedriveId[is]:NOT_NULL", user_agent=UA)
    b_rows = []
    conflicts = []
    for p in people:
        if p.get("companyId"):
            continue
        email = ((p.get("emails") or {}).get("primaryEmail") or "").strip().lower()
        if not email or "@" not in email:
            continue
        domain = email.split("@", 1)[1]
        if domain in FREE_MAIL:
            continue
        matches = domain_to_cos.get(domain) or []
        if len(matches) == 1:
            b_rows.append(
                {
                    "personId": p["id"],
                    "email": email,
                    "domain": domain,
                    "companyId": matches[0]["id"],
                    "companyName": matches[0].get("name"),
                }
            )
        elif len(matches) > 1:
            conflicts.append(
                {
                    "personId": p["id"],
                    "email": email,
                    "domain": domain,
                    "companyIds": [m["id"] for m in matches],
                }
            )

    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "apply_opp": args.apply_opp,
        "source_a_candidates_with_opp_company": len(a_rows),
        "source_a_actionable": len(actionable_a),
        "source_a_applied": len(results),
        "source_a_ok": sum(1 for r in results if r.get("ok")),
        "source_b_domain_proposals": len(b_rows),
        "source_b_conflicts": len(conflicts),
        "source_a_results": results if args.apply_opp else actionable_a[:50],
        "source_b_sample": b_rows[:50],
    }
    path = repair / (
        "link_people_apply.json" if args.apply_opp else "link_people_dry.json"
    )
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    csv_path = repair / "link_people_domain_proposals.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f, fieldnames=["personId", "email", "domain", "companyId", "companyName"]
        )
        w.writeheader()
        for r in b_rows:
            w.writerow(r)
    conflict_path = repair / "link_people_domain_conflicts.csv"
    with conflict_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["personId", "email", "domain", "companyIds"])
        w.writeheader()
        for r in conflicts:
            w.writerow({**r, "companyIds": "|".join(r["companyIds"])})

    print(json.dumps({k: out[k] for k in out if "results" not in k and "sample" not in k}, indent=2))
    print(f"→ {path}")
    print(f"→ {csv_path} ({len(b_rows)} proposals)")
    print(f"→ {conflict_path} ({len(conflicts)} conflicts)")


if __name__ == "__main__":
    main()
