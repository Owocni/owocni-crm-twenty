#!/usr/bin/env python3
"""Faza 4.2 — merge dubli domen: PD winner ← relink people/opps ← DELETE automint loser.

Brak natywnego merge Company w Twenty Cloud → relink + delete.
Domyślnie dry-run. Czyta actionable z domain_dupes.json (albo regeneruje).

Użycie:
  python3 integrations/tools/merge_company_domain_dupes.py --run 20260804T065324Z
  python3 integrations/tools/merge_company_domain_dupes.py --run 20260804T065324Z --apply
  python3 integrations/tools/merge_company_domain_dupes.py --run 20260804T065324Z --apply --limit 5
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pd_company_map import resolve_run  # noqa: E402
from twenty_rest import http_json, load_env  # noqa: E402

UA = "owocni-merge-company-domain-dupes/1.0"


def list_by_company(collection: str, list_key: str, company_id: str) -> list[dict]:
    """Single-page fetch is enough (company rarely has >100 people/opps)."""
    filt = urllib.parse.quote(f"companyId[eq]:{company_id}", safe="")
    st, payload = http_json(
        "GET",
        f"/{collection}?limit=100&filter={filt}",
        user_agent=UA,
    )
    if st != 200:
        raise SystemExit(f"list {collection} for {company_id} fail {st} {payload}")
    return (payload.get("data") or {}).get(list_key) or []


def clear_domain(company_id: str) -> tuple[int, dict]:
    # Empty URL clears unique slot
    return http_json(
        "PATCH",
        f"/companies/{company_id}",
        {"domainName": {"primaryLinkUrl": "", "primaryLinkLabel": ""}},
        user_agent=UA,
    )


def set_domain(company_id: str, domain: str) -> tuple[int, dict]:
    return http_json(
        "PATCH",
        f"/companies/{company_id}",
        {
            "domainName": {
                "primaryLinkUrl": f"https://{domain}",
                "primaryLinkLabel": domain,
            }
        },
        user_agent=UA,
    )


def merge_one(pair: dict, *, apply: bool) -> dict:
    winner_id = pair["winner_id"]
    loser_id = pair["loser_id"]
    domain = pair["domain"]
    row = {
        "domain": domain,
        "winner_id": winner_id,
        "loser_id": loser_id,
        "mode": "apply" if apply else "dry-run",
    }

    people = list_by_company("people", "people", loser_id)
    opps = list_by_company("opportunities", "opportunities", loser_id)
    row["people_to_move"] = len(people)
    row["opps_to_move"] = len(opps)
    row["people_ids"] = [p["id"] for p in people]
    row["opp_ids"] = [o["id"] for o in opps]

    # Enrichment fields to copy if winner empty
    st_w, w_payload = http_json("GET", f"/companies/{winner_id}", user_agent=UA)
    st_l, l_payload = http_json("GET", f"/companies/{loser_id}", user_agent=UA)
    winner = ((w_payload.get("data") or {}).get("company") or w_payload.get("data") or {}) if st_w == 200 else {}
    loser = ((l_payload.get("data") or {}).get("company") or l_payload.get("data") or {}) if st_l == 200 else {}
    if not isinstance(winner, dict):
        winner = {}
    if not isinstance(loser, dict):
        loser = {}

    enrich_patch: dict = {}
    for field in (
        "legalName",
        "nip",
        "regon",
        "krs",
        "legalForm",
        "pkd",
        "vatStatus",
        "boardMembers",
        "enrichmentSource",
        "enrichedAt",
    ):
        if not (winner.get(field) or "") and (loser.get(field) or ""):
            enrich_patch[field] = loser[field]
    if not (winner.get("registeredAddress") or {}).get("addressStreet1"):
        ra = loser.get("registeredAddress") or {}
        if ra.get("addressStreet1") or ra.get("addressCity"):
            enrich_patch["registeredAddress"] = ra
    # Prefer richer display name from automint if PD name looks like URL and loser has legal/enriched name
    w_name = (winner.get("name") or "").strip()
    l_name = (loser.get("name") or "").strip()
    l_legal = (loser.get("legalName") or "").strip()
    if ("." in w_name or w_name.lower().startswith("http")) and (l_legal or (l_name and "." not in l_name)):
        enrich_patch["name"] = l_legal or l_name

    row["enrich_fields"] = sorted(enrich_patch.keys())
    row["need_domain_transfer"] = not bool(
        ((winner.get("domainName") or {}).get("primaryLinkUrl") or "").strip()
    )

    if not apply:
        return row

    errors: list[str] = []

    # 1) Move domain: clear loser first (unique), then set on winner
    if pair.get("loser_has_domain") or (
        ((loser.get("domainName") or {}).get("primaryLinkUrl") or "").strip()
    ):
        st, res = clear_domain(loser_id)
        if st not in (200, 201):
            errors.append(f"clear_domain_loser:{st}:{res.get('error')}")
        time.sleep(0.4)

    if row["need_domain_transfer"] or not (
        ((winner.get("domainName") or {}).get("primaryLinkUrl") or "").strip()
    ):
        st, res = set_domain(winner_id, domain)
        if st not in (200, 201):
            errors.append(f"set_domain_winner:{st}:{res.get('error')}")
        time.sleep(0.4)

    # 2) Copy enrichment
    if enrich_patch:
        st, res = http_json(
            "PATCH", f"/companies/{winner_id}", enrich_patch, user_agent=UA
        )
        if st not in (200, 201):
            errors.append(f"enrich:{st}:{res.get('error')}")
        time.sleep(0.4)

    # 3) Relink people
    moved_p = 0
    for p in people:
        st, res = http_json(
            "PATCH",
            f"/people/{p['id']}",
            {"companyId": winner_id},
            user_agent=UA,
        )
        if st in (200, 201):
            moved_p += 1
        else:
            errors.append(f"person:{p['id']}:{st}")
        time.sleep(0.4)
    row["people_moved"] = moved_p

    # 4) Relink opportunities
    moved_o = 0
    for o in opps:
        st, res = http_json(
            "PATCH",
            f"/opportunities/{o['id']}",
            {"companyId": winner_id},
            user_agent=UA,
        )
        if st in (200, 201):
            moved_o += 1
        else:
            errors.append(f"opp:{o['id']}:{st}")
        time.sleep(0.4)
    row["opps_moved"] = moved_o

    # 5) Delete loser
    st, res = http_json("DELETE", f"/companies/{loser_id}", user_agent=UA)
    row["delete_status"] = st
    if st not in (200, 201):
        errors.append(f"delete:{st}:{res.get('error')}")
    time.sleep(0.4)

    row["errors"] = errors
    row["ok"] = not errors
    return row


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="20260804T065324Z")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument(
        "--from-report",
        default=None,
        help="Path to domain_dupes.json (default: repair/domain_dupes.json)",
    )
    args = ap.parse_args()
    load_env()
    run = resolve_run(args.run)
    repair = run / "repair"
    report_path = Path(args.from_report) if args.from_report else repair / "domain_dupes.json"
    if not report_path.is_file():
        raise SystemExit(f"Brak raportu {report_path} — uruchom report_company_domain_dupes.py")

    report = json.loads(report_path.read_text(encoding="utf-8"))
    pairs = report.get("actionable") or []
    if args.limit:
        pairs = pairs[: args.limit]

    results = []
    path = repair / ("merge_domain_dupes_apply.json" if args.apply else "merge_domain_dupes_dry.json")
    for i, pair in enumerate(pairs):
        print(
            f"[{i+1}/{len(pairs)}] {pair['domain']} "
            f"{pair['loser_name']!r} → {pair['winner_name']!r}",
            flush=True,
        )
        row = merge_one(pair, apply=args.apply)
        results.append(row)
        if args.apply:
            print(
                f"  people={row.get('people_moved')}/{row['people_to_move']} "
                f"opps={row.get('opps_moved')}/{row['opps_to_move']} "
                f"del={row.get('delete_status')} ok={row.get('ok')} "
                f"err={row.get('errors')}",
                flush=True,
            )
        else:
            print(
                f"  WOULD people={row['people_to_move']} opps={row['opps_to_move']} "
                f"domain_xfer={row['need_domain_transfer']} enrich={row['enrich_fields']}",
                flush=True,
            )
        # Incremental checkpoint
        out = {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "apply": args.apply,
            "processed": len(results),
            "ok": sum(1 for r in results if r.get("ok")) if args.apply else None,
            "results": results,
        }
        path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"done → {path}", flush=True)


if __name__ == "__main__":
    main()
