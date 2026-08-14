#!/usr/bin/env python3
"""Faza 8.2 opcja C — cleanup firm auto-mint z gate'em poczty wychodzącej.

DELETE candidate:
  - brak pipedriveId
  - 0 Opportunity
  - 0 Faktura
  - żadna osoba firmy nie jest TO/CC/BCC na Message.direction=OUTGOING

Osoby NIE są kasowane.

Użycie:
  python3 integrations/tools/cleanup_automint_companies.py --run 20260804T065324Z --outbound-gate
  python3 integrations/tools/cleanup_automint_companies.py --run 20260804T065324Z --outbound-gate --apply --only-safe
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pd_company_map import resolve_run  # noqa: E402
from twenty_rest import http_json, load_env, paginate  # noqa: E402

UA = "owocni-cleanup-automint-companies/1.1"
OUT_ROLES = frozenset({"TO", "CC", "BCC"})


def build_outbound_protected_companies() -> tuple[set[str], dict[str, int], dict]:
    """Companies that have ≥1 person who received our OUTGOING mail."""
    print("fetch OUTGOING message ids…", flush=True)
    out_msgs = paginate(
        "messages", "messages", "direction[eq]:OUTGOING", user_agent=UA, pace=0.3
    )
    out_ids = {m["id"] for m in out_msgs if m.get("id")}
    print(f"  OUTGOING messages={len(out_ids)}", flush=True)

    print("fetch messageParticipants with personId…", flush=True)
    parts = paginate(
        "messageParticipants",
        "messageParticipants",
        "personId[is]:NOT_NULL",
        user_agent=UA,
        pace=0.25,
        max_pages=2000,
    )
    print(f"  participants_with_person={len(parts)}", flush=True)

    outbound_person_ids: set[str] = set()
    for p in parts:
        if p.get("messageId") not in out_ids:
            continue
        if (p.get("role") or "") not in OUT_ROLES:
            continue
        pid = p.get("personId")
        if pid:
            outbound_person_ids.add(pid)
    print(f"  people_with_outbound={len(outbound_person_ids)}", flush=True)

    print("map people → companyId…", flush=True)
    # Prefer people we care about: those with outbound; also build full company map
    people = paginate(
        "people", "people", "companyId[is]:NOT_NULL", user_agent=UA, pace=0.3
    )
    people_count: dict[str, int] = {}
    protected: set[str] = set()
    for pe in people:
        cid = pe.get("companyId")
        if not cid:
            continue
        people_count[cid] = people_count.get(cid, 0) + 1
        if pe.get("id") in outbound_person_ids:
            protected.add(cid)
    # Also: outbound people without companyId in the above list — fetch individually? skip
    # Catch outbound people that might have been missed if companyId filter missed empties
    missing = outbound_person_ids - {pe["id"] for pe in people if pe.get("id")}
    print(f"  outbound people without company link in batch: {len(missing)}", flush=True)
    # sample fetch missing (may have companyId null — irrelevant for company protect)
    stats = {
        "outgoing_messages": len(out_ids),
        "participants_scanned": len(parts),
        "people_with_outbound": len(outbound_person_ids),
        "companies_protected_by_outbound": len(protected),
    }
    return protected, people_count, stats


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="20260804T065324Z")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--only-safe", action="store_true", help="Alias: delete only final candidates")
    ap.add_argument("--outbound-gate", action="store_true", help="Opcja C: chroń firmy z OUT mail")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    load_env()
    run = resolve_run(args.run)
    repair = run / "repair"
    repair.mkdir(parents=True, exist_ok=True)

    print("fetch all companies…", flush=True)
    a = paginate(
        "companies", "companies", "idealCustomerProfile[eq]:false", user_agent=UA, pace=0.3
    )
    b = paginate(
        "companies", "companies", "idealCustomerProfile[eq]:true", user_agent=UA, pace=0.3
    )
    seen: set[str] = set()
    companies: list[dict] = []
    for c in a + b:
        if c["id"] in seen:
            continue
        seen.add(c["id"])
        companies.append(c)
    print(f"companies={len(companies)}", flush=True)

    print("fetch opportunities (protect companyIds)…", flush=True)
    opps: list[dict] = []
    seen_opp: set[str] = set()
    for src in (
        "PIPEDRIVE_LEGACY",
        "OWOCNI_SORTOWNIA",
        "TWENTY_UI",
        "TWENTY_EMAIL",
        "BETTER_BITRIX_LEGACY",
    ):
        batch = paginate(
            "opportunities",
            "opportunities",
            f"srcSystem[eq]:{src}",
            user_agent=UA,
            pace=0.3,
        )
        for o in batch:
            oid = o.get("id")
            if oid and oid not in seen_opp:
                seen_opp.add(oid)
                opps.append(o)
    protected_from_opp = {o.get("companyId") for o in opps if o.get("companyId")}
    print(f"opps={len(opps)} protected_from_opp={len(protected_from_opp)}", flush=True)

    faktura_cos: set[str] = set()
    try:
        faktury = paginate(
            "faktury", "faktury", "companyId[is]:NOT_NULL", user_agent=UA, pace=0.3
        )
        faktura_cos = {f.get("companyId") for f in faktury if f.get("companyId")}
        print(f"faktury_with_company={len(faktura_cos)}", flush=True)
    except SystemExit as e:
        print(f"faktury skip: {e}", flush=True)

    outbound_protected: set[str] = set()
    people_count: dict[str, int] = {}
    outbound_stats: dict = {}
    if args.outbound_gate:
        outbound_protected, people_count, outbound_stats = build_outbound_protected_companies()
        print(
            f"companies_protected_by_outbound={len(outbound_protected)}",
            flush=True,
        )
    else:
        people = paginate(
            "people", "people", "companyId[is]:NOT_NULL", user_agent=UA, pace=0.3
        )
        for pe in people:
            cid = pe.get("companyId")
            if cid:
                people_count[cid] = people_count.get(cid, 0) + 1

    candidates = []
    protected_outbound_rows = []
    for c in companies:
        pid = (c.get("pipedriveId") or "").strip()
        if pid:
            continue
        cid = c["id"]
        if cid in protected_from_opp or cid in faktura_cos:
            continue
        n_people = people_count.get(cid, 0)
        has_out = cid in outbound_protected
        if args.outbound_gate and has_out:
            protected_outbound_rows.append(
                {
                    "id": cid,
                    "name": c.get("name") or "",
                    "domain": ((c.get("domainName") or {}).get("primaryLinkUrl") or ""),
                    "people": n_people,
                    "reason": "has_outbound",
                }
            )
            continue
        bucket = "delete_ok"
        if not args.outbound_gate:
            bucket = "safe_delete" if n_people == 0 else "review_has_people"
        candidates.append(
            {
                "id": cid,
                "name": c.get("name") or "",
                "domain": ((c.get("domainName") or {}).get("primaryLinkUrl") or ""),
                "people": n_people,
                "bucket": bucket,
                "has_outbound": has_out,
                "createdAt": c.get("createdAt") or "",
                "createdBy": ((c.get("createdBy") or {}).get("source") or ""),
            }
        )

    summary = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "outbound_gate": args.outbound_gate,
        "companies_total": len(companies),
        "candidates_delete": len(candidates),
        "protected_by_outbound": len(protected_outbound_rows),
        "outbound_stats": outbound_stats,
        "note": (
            "Opcja C: delete_ok = brak PD / opp / faktury / outbound TO-CC-BCC. "
            "Osoby niekasowane. Czeka na GO apply."
            if args.outbound_gate
            else "Bez outbound-gate (v1)."
        ),
    }
    print(json.dumps({k: summary[k] for k in summary if k != "outbound_stats"}, indent=2), flush=True)
    if outbound_stats:
        print(json.dumps(outbound_stats, indent=2), flush=True)

    suffix = "outbound" if args.outbound_gate else "v1"
    csv_path = repair / f"cleanup_automint_candidates_{suffix}.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "bucket",
                "id",
                "name",
                "domain",
                "people",
                "has_outbound",
                "createdAt",
                "createdBy",
            ],
        )
        w.writeheader()
        for row in candidates:
            w.writerow(row)

    protected_csv = repair / f"cleanup_automint_protected_outbound_{suffix}.csv"
    if args.outbound_gate:
        with protected_csv.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(
                f, fieldnames=["id", "name", "domain", "people", "reason"]
            )
            w.writeheader()
            for row in protected_outbound_rows:
                w.writerow(row)

    dry_path = repair / f"cleanup_automint_dry_{suffix}.json"
    dry_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(f"→ {csv_path}")
    print(f"→ {dry_path}")
    if args.outbound_gate:
        print(f"→ {protected_csv} ({len(protected_outbound_rows)} protected)")

    if not args.apply:
        print("DRY-RUN only — czekam na GO apply od właściciela.", flush=True)
        return

    to_delete = candidates
    if args.only_safe and not args.outbound_gate:
        to_delete = [c for c in candidates if c["bucket"] == "safe_delete"]
    if args.limit:
        to_delete = to_delete[: args.limit]
    print(f"APPLY delete n={len(to_delete)}", flush=True)
    results = []
    path = repair / f"cleanup_automint_apply_{suffix}.json"
    for i, row in enumerate(to_delete):
        st, res = http_json("DELETE", f"/companies/{row['id']}", user_agent=UA)
        ok = st in (200, 201)
        results.append(
            {
                **row,
                "status": st,
                "ok": ok,
                "error": res.get("error") if not ok else None,
            }
        )
        if (i + 1) % 50 == 0:
            print(f"  deleted {i+1}/{len(to_delete)}", flush=True)
            path.write_text(
                json.dumps(
                    {
                        "processed": len(results),
                        "ok": sum(1 for r in results if r.get("ok")),
                        "results": results,
                    },
                    indent=2,
                    ensure_ascii=False,
                )
                + "\n",
                encoding="utf-8",
            )
        time.sleep(0.3)
    path.write_text(
        json.dumps(
            {
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "processed": len(results),
                "ok": sum(1 for r in results if r.get("ok")),
                "results": results,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"done ok={sum(1 for r in results if r.get('ok'))}/{len(results)} → {path}")


if __name__ == "__main__":
    main()
