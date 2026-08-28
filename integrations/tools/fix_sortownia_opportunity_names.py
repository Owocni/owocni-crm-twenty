#!/usr/bin/env python3
"""Przemianowanie Opportunity OWOCNI_SORTOWNIA → format email · produkt · typ · jakość.

Nowy format (createLead.js v15): pierwszy segment = email (fallback telefon / Lead).

Użycie:
  python3 integrations/tools/fix_sortownia_opportunity_names.py
  python3 integrations/tools/fix_sortownia_opportunity_names.py --apply
  python3 integrations/tools/fix_sortownia_opportunity_names.py --apply --limit 5
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
from twenty_rest import http_json, load_env, paginate  # noqa: E402

UA = "owocni-fix-sortownia-opportunity-names/1.0"
EXPORT_DIR = Path(__file__).resolve().parents[1] / "runbooks" / "exports" / "repair_sortownia_names"

PRODUCT_LABELS = {
    "WEB": "Strona",
    "LOGO": "Logo",
    "NAME": "Naming",
    "MARKETING": "Marketing",
    "COPYWRITING": "Copywriting",
    "OPAKOWANIE": "Opakowanie",
    "INNE": "INNE",
}
PROJECT_LABELS = {"NEW": "Nowe", "REDESIGN": "Redesign"}
INTENT_LABELS = {"CENNIK": "Cennik", "EKSPERT": "Ekspert"}


def fold(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def first_segment(name: str) -> str:
    return (name or "").split(" · ", 1)[0].strip()


def looks_like_email(s: str) -> bool:
    return "@" in s and "." in s.split("@", 1)[-1]


def looks_like_phone(s: str) -> bool:
    digits = re.sub(r"\D", "", s or "")
    return 7 <= len(digits) <= 15


def name_already_new_format(name: str) -> bool:
    seg = first_segment(name)
    return looks_like_email(seg) or looks_like_phone(seg)


def product_label(biz_product: str | None) -> str:
    key = (biz_product or "").upper().strip()
    return PRODUCT_LABELS.get(key, "")


def compose_name(opp: dict, person_email: str | None, person_phone: str | None) -> str:
    email = (opp.get("bizCardEmail") or person_email or "").strip()
    phone = (opp.get("bizCardPhone") or person_phone or "").strip()

    segments: list[str] = []
    if email:
        segments.append(email)
    elif phone:
        segments.append(phone)
    else:
        segments.append("Lead")

    pl = product_label(opp.get("bizProduct"))
    if pl:
        segments.append(pl)

    pt = PROJECT_LABELS.get(opp.get("bizProjectType") or "")
    if pt:
        segments.append(pt)

    intent = INTENT_LABELS.get(opp.get("bizIntent") or "")
    if intent:
        segments.append(intent)

    if len(segments) == 1 and segments[0] == "Lead":
        return "Lead formularz"
    return " · ".join(segments)[:512]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="Max candidates (dry-run preview or apply batch)")
    args = ap.parse_args()
    load_env()
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)

    print("fetch OWOCNI_SORTOWNIA opps…", flush=True)
    opps = paginate(
        "opportunities",
        "opportunities",
        "srcSystem[eq]:OWOCNI_SORTOWNIA",
        user_agent=UA,
    )
    print(f"opps={len(opps)}", flush=True)

    person_cache: dict[str, dict] = {}

    def get_person(pid: str | None) -> dict | None:
        if not pid:
            return None
        if pid in person_cache:
            return person_cache[pid]
        st, payload = http_json("GET", f"/people/{pid}", user_agent=UA)
        time.sleep(0.25)
        pe = (
            ((payload.get("data") or {}).get("person") or payload.get("data") or {})
            if st == 200
            else {}
        )
        if not isinstance(pe, dict):
            pe = {}
        person_cache[pid] = pe
        return pe

    def person_contact(person: dict | None) -> tuple[str | None, str | None]:
        if not person:
            return None, None
        emails = person.get("emails") or {}
        email = (emails.get("primaryEmail") or "").strip() or None
        phones = person.get("phones") or {}
        phone = (phones.get("primaryPhoneNumber") or "").strip() or None
        if phone and phones.get("primaryPhoneCallingCode"):
            cc = str(phones.get("primaryPhoneCallingCode") or "").strip()
            if cc and not phone.startswith("+"):
                phone = f"{cc}{phone}"
        return email, phone

    candidates = []
    skipped_already = 0
    skipped_unchanged = 0

    for i, opp in enumerate(opps):
        old_name = opp.get("name") or ""
        if name_already_new_format(old_name):
            skipped_already += 1
            continue

        person = get_person(opp.get("pointOfContactId"))
        p_email, p_phone = person_contact(person)
        new_name = compose_name(opp, p_email, p_phone)

        if fold(new_name) == fold(old_name):
            skipped_unchanged += 1
            continue

        candidates.append(
            {
                "id": opp["id"],
                "old_name": old_name,
                "new_name": new_name,
                "bizCardEmail": opp.get("bizCardEmail") or "",
                "bizProduct": opp.get("bizProduct") or "",
            }
        )
        if args.limit and len(candidates) >= args.limit and not args.apply:
            break
        if (i + 1) % 100 == 0:
            print(f"  scanned {i+1}/{len(opps)} candidates={len(candidates)}", flush=True)

    if args.limit and args.apply:
        candidates = candidates[: args.limit]

    print(
        f"candidates={len(candidates)} skipped_already_new={skipped_already} "
        f"skipped_unchanged={skipped_unchanged}",
        flush=True,
    )

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = EXPORT_DIR / (
        f"fix_sortownia_names_{'apply' if args.apply else 'dry'}_{stamp}.json"
    )

    results = []
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
            time.sleep(0.35)
            print(
                f"[{i+1}/{len(candidates)}] {row['old_name']!r} → {row['new_name']!r} st={st}",
                flush=True,
            )
        else:
            if i < 25 or (i + 1) % 50 == 0:
                print(f"WOULD {row['old_name']!r} → {row['new_name']!r}", flush=True)
        results.append(row)

    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "apply": args.apply,
        "scanned_opps": len(opps),
        "processed": len(results),
        "skipped_already_new_format": skipped_already,
        "skipped_unchanged": skipped_unchanged,
        "ok": sum(1 for r in results if r.get("ok")) if args.apply else None,
        "results": results,
    }
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    summary = {k: out[k] for k in out if k != "results"}
    print(json.dumps(summary, indent=2), flush=True)
    print(f"→ {path}", flush=True)


if __name__ == "__main__":
    main()
