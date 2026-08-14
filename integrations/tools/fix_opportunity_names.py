#!/usr/bin/env python3
"""Faza 6 — nazwy Opportunity PIPEDRIVE_LEGACY gdy name == firma / URL / junk.

Nowa nazwa: „{Osoba} — {Firma}” lub „{Firma} · {YYYY-MM}” / „{Osoba} · {YYYY-MM}”.

Użycie:
  python3 integrations/tools/fix_opportunity_names.py --run 20260804T065324Z
  python3 integrations/tools/fix_opportunity_names.py --run 20260804T065324Z --apply
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pd_company_map import URL_NAME_RE, domain_from_urlish, resolve_run  # noqa: E402
from pipedrive_sample_load import is_junk_label, clean_label  # noqa: E402
from twenty_rest import http_json, load_env, paginate  # noqa: E402

UA = "owocni-fix-opportunity-names/1.0"


def fold(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def looks_url(s: str) -> bool:
    return bool(domain_from_urlish(s) or URL_NAME_RE.match((s or "").strip()))


def person_label(person: dict | None) -> str | None:
    if not person:
        return None
    name = person.get("name") or {}
    if isinstance(name, dict):
        parts = [name.get("firstName") or "", name.get("lastName") or ""]
        full = clean_label(" ".join(p for p in parts if p))
    else:
        full = clean_label(str(name))
    if full and not is_junk_label(full):
        return full
    email = ((person.get("emails") or {}).get("primaryEmail") or "").strip()
    return email or None


def needs_rename(opp_name: str, company_name: str | None) -> bool:
    n = clean_label(opp_name)
    if not n or is_junk_label(n):
        return True
    if looks_url(n):
        return True
    if company_name and fold(n) == fold(company_name):
        return True
    return False


def compose(person: dict | None, company: dict | None, created_at: str | None) -> str:
    pname = person_label(person)
    cname = clean_label((company or {}).get("name") or "")
    if cname and is_junk_label(cname):
        cname = ""
    ym = ""
    if created_at:
        try:
            ym = created_at[:7]  # YYYY-MM
        except Exception:  # noqa: BLE001
            ym = ""
    if pname and cname:
        if fold(pname) in fold(cname):
            return cname[:512]
        return f"{pname} — {cname}"[:512]
    if cname and ym:
        return f"{cname} · {ym}"[:512]
    if pname and ym:
        return f"{pname} · {ym}"[:512]
    if cname:
        return cname[:512]
    if pname:
        return pname[:512]
    return f"PD lead {ym or 'legacy'}"[:512]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="20260804T065324Z")
    ap.add_argument("--apply", action="store_true")
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
    print(f"opps={len(opps)}", flush=True)

    print("prefetch PD companies…", flush=True)
    cos = paginate("companies", "companies", "pipedriveId[is]:NOT_NULL", user_agent=UA)
    company_cache: dict[str, dict] = {c["id"]: c for c in cos}
    person_cache: dict[str, dict] = {}

    def get_company(cid: str | None) -> dict | None:
        if not cid:
            return None
        if cid in company_cache:
            return company_cache[cid]
        st, payload = http_json("GET", f"/companies/{cid}", user_agent=UA)
        time.sleep(0.25)
        co = ((payload.get("data") or {}).get("company") or payload.get("data") or {}) if st == 200 else {}
        if not isinstance(co, dict):
            co = {}
        company_cache[cid] = co
        return co

    def get_person(pid: str | None) -> dict | None:
        if not pid:
            return None
        if pid in person_cache:
            return person_cache[pid]
        st, payload = http_json("GET", f"/people/{pid}", user_agent=UA)
        time.sleep(0.25)
        pe = ((payload.get("data") or {}).get("person") or payload.get("data") or {}) if st == 200 else {}
        if not isinstance(pe, dict):
            pe = {}
        person_cache[pid] = pe
        return pe

    candidates = []
    for i, opp in enumerate(opps):
        company = get_company(opp.get("companyId"))
        cname = (company or {}).get("name") if company else None
        if not needs_rename(opp.get("name") or "", cname):
            continue
        # Prefer card email; fetch person only when missing
        person = None
        card_email = (opp.get("bizCardEmail") or "").strip()
        if card_email:
            person = {"emails": {"primaryEmail": card_email}, "name": {}}
        elif opp.get("pointOfContactId"):
            person = get_person(opp.get("pointOfContactId"))
        new_name = compose(person, company, opp.get("createdAt") or opp.get("legacyCreatedAt"))
        if fold(new_name) == fold(opp.get("name") or ""):
            continue
        candidates.append(
            {
                "id": opp["id"],
                "pipedriveId": opp.get("pipedriveId"),
                "old_name": opp.get("name"),
                "new_name": new_name,
                "companyName": cname or "",
            }
        )
        if (i + 1) % 500 == 0:
            print(f"  scanned {i+1}/{len(opps)} candidates={len(candidates)}", flush=True)
        if args.limit and len(candidates) >= args.limit and not args.apply:
            break

    if args.limit and args.apply:
        candidates = candidates[: args.limit]
    print(f"candidates={len(candidates)}", flush=True)

    results = []
    path = repair / (
        "fix_opportunity_names_apply.json" if args.apply else "fix_opportunity_names_dry.json"
    )
    for i, row in enumerate(candidates):
        if args.apply:
            st, res = http_json(
                "PATCH",
                f"/opportunities/{row['id']}",
                {"name": row["new_name"]},
                user_agent=UA,
            )
            row = {**row, "status": st, "ok": st in (200, 201)}
            if st not in (200, 201):
                row["error"] = res.get("error")
            time.sleep(0.4)
            print(
                f"[{i+1}/{len(candidates)}] {row['old_name']!r} → {row['new_name']!r} st={st}",
                flush=True,
            )
        else:
            if i < 30 or (i + 1) % 50 == 0:
                print(f"WOULD {row['old_name']!r} → {row['new_name']!r}", flush=True)
        results.append(row)
        if args.apply and (i + 1) % 50 == 0:
            path.write_text(
                json.dumps(
                    {
                        "generatedAt": datetime.now(timezone.utc).isoformat(),
                        "apply": True,
                        "processed": len(results),
                        "results": results,
                    },
                    indent=2,
                    ensure_ascii=False,
                )
                + "\n",
                encoding="utf-8",
            )

    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "apply": args.apply,
        "scanned_opps": len(opps),
        "processed": len(results),
        "ok": sum(1 for r in results if r.get("ok")) if args.apply else None,
        "results": results,
    }
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({k: out[k] for k in out if k != "results"}, indent=2), flush=True)
    print(f"→ {path}", flush=True)


if __name__ == "__main__":
    main()
