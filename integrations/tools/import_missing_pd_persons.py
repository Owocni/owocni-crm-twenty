#!/usr/bin/env python3
"""Faza 5.0 — import brakujących osób PD → Twenty People.

Domyślnie dry-run. Dedup: istniejący email → stamp pipedriveId (+braki).

Użycie:
  python3 integrations/tools/import_missing_pd_persons.py --run 20260804T065324Z
  python3 integrations/tools/import_missing_pd_persons.py --run 20260804T065324Z --apply
  python3 integrations/tools/import_missing_pd_persons.py --run 20260804T065324Z --apply --limit 50
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pd_company_map import in_window, load_pages, resolve_run  # noqa: E402
from pipedrive_sample_load import phone_payload, split_name  # noqa: E402
from twenty_rest import http_json, load_env, paginate  # noqa: E402

UA = "owocni-import-missing-pd-persons/1.0"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(raw: str | None) -> str | None:
    if not raw or not isinstance(raw, str):
        return None
    e = raw.strip().lower()
    if not e or not EMAIL_RE.match(e):
        return None
    return e


def person_emails(person: dict) -> list[str]:
    out: list[str] = []
    for item in person.get("email") or person.get("emails") or []:
        if isinstance(item, dict):
            e = normalize_email(item.get("value") or item.get("email"))
        else:
            e = normalize_email(str(item))
        if e and e not in out:
            out.append(e)
    return out


def person_phones(person: dict) -> list[str]:
    out: list[str] = []
    for item in person.get("phone") or person.get("phones") or []:
        if isinstance(item, dict):
            v = (item.get("value") or item.get("phone") or "").strip()
        else:
            v = str(item).strip()
        if not v:
            continue
        # crude E.164-ish
        digits = re.sub(r"[^\d+]", "", v)
        if digits.startswith("00"):
            digits = "+" + digits[2:]
        elif digits.startswith("+"):
            pass
        elif len(digits) == 9:
            digits = "+48" + digits
        elif digits.startswith("48") and len(digits) >= 11:
            digits = "+" + digits
        else:
            continue
        if digits not in out:
            out.append(digits)
    return out


def expected_persons(run: Path) -> list[dict]:
    return [p for p in load_pages(run / "persons") if in_window(p)]


def find_person_by_email(email: str) -> str | None:
    filt = urllib.parse.quote(f"emails.primaryEmail[eq]:{email}", safe="")
    st, payload = http_json("GET", f"/people?limit=1&filter={filt}", user_agent=UA)
    if st != 200:
        return None
    batch = (payload.get("data") or {}).get("people") or []
    return batch[0]["id"] if batch else None


def map_person_body(person: dict, company_id: str | None) -> dict:
    emails = person_emails(person)
    phones = person_phones(person)
    body: dict = {
        "name": split_name(person.get("name") or "Unknown"),
        "pipedriveId": str(person["id"]),
        "position": "last",
    }
    if emails:
        body["emails"] = {"primaryEmail": emails[0]}
        if len(emails) > 1:
            body["emails"]["additionalEmails"] = emails[1:5]
    ph = phone_payload(phones[0]) if phones else None
    if ph:
        body["phones"] = ph
    if company_id:
        body["companyId"] = company_id
    add_time = person.get("add_time")
    if add_time:
        body["createdAt"] = (
            add_time.replace("Z", ".000Z") if add_time.endswith("Z") else add_time
        )
    return body


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

    expected = expected_persons(run)
    print(f"PD persons in window: {len(expected)}", flush=True)

    print("fetch Twenty people with pipedriveId…", flush=True)
    existing = paginate("people", "people", "pipedriveId[is]:NOT_NULL", user_agent=UA)
    have = {str(p["pipedriveId"]) for p in existing if p.get("pipedriveId")}
    print(f"Twenty with pipedriveId: {len(have)}", flush=True)

    print("fetch companies with pipedriveId (org map)…", flush=True)
    cos = paginate("companies", "companies", "pipedriveId[is]:NOT_NULL", user_agent=UA)
    org_to_co = {str(c["pipedriveId"]): c["id"] for c in cos if c.get("pipedriveId")}

    missing = [p for p in expected if str(p["id"]) not in have]
    print(f"missing: {len(missing)}", flush=True)
    if args.limit:
        missing = missing[: args.limit]

    results = []
    path = repair / (
        "import_missing_persons_apply.json" if args.apply else "import_missing_persons_dry.json"
    )
    for i, person in enumerate(missing):
        pid = str(person["id"])
        emails = person_emails(person)
        org_id = person.get("org_id")
        if isinstance(org_id, dict):
            org_id = org_id.get("value") or org_id.get("id")
        company_id = org_to_co.get(str(org_id)) if org_id else None
        row = {
            "pipedriveId": pid,
            "name": person.get("name"),
            "emails": emails,
            "companyId": company_id,
            "mode": None,
        }
        if not args.apply:
            # preview mode only
            if emails:
                existing_id = find_person_by_email(emails[0])
                time.sleep(0.25)
                row["mode"] = "email_dedup" if existing_id else "create"
                row["existingId"] = existing_id
            else:
                row["mode"] = "create"
            results.append(row)
            if (i + 1) % 50 == 0 or i == 0:
                print(f"  dry {i+1}/{len(missing)} last={row['mode']} {pid}", flush=True)
            continue

        # apply
        if emails:
            existing_id = find_person_by_email(emails[0])
            time.sleep(0.35)
            if existing_id:
                patch: dict = {"pipedriveId": pid}
                phones = person_phones(person)
                ph = phone_payload(phones[0]) if phones else None
                if ph:
                    patch["phones"] = ph
                if company_id:
                    # only set company if empty? check quickly via patch anyway — may overwrite
                    patch["companyId"] = company_id
                st, res = http_json(
                    "PATCH", f"/people/{existing_id}", patch, user_agent=UA
                )
                row["mode"] = "email_dedup"
                row["twentyId"] = existing_id
                row["status"] = st
                if st not in (200, 201):
                    row["error"] = res.get("error")
                results.append(row)
                time.sleep(0.4)
                if (i + 1) % 25 == 0:
                    print(f"  {i+1}/{len(missing)} dedup {pid} → {existing_id} st={st}", flush=True)
                    path.write_text(
                        json.dumps(
                            {
                                "generatedAt": datetime.now(timezone.utc).isoformat(),
                                "apply": True,
                                "missing_total": len(
                                    [p for p in expected if str(p["id"]) not in have]
                                ),
                                "processed": len(results),
                                "results": results,
                            },
                            indent=2,
                            ensure_ascii=False,
                        )
                        + "\n",
                        encoding="utf-8",
                    )
                continue

        body = map_person_body(person, company_id)
        st, res = http_json("POST", "/people", body, user_agent=UA)
        data = res.get("data") or {}
        created = data.get("createPerson") or data.get("person") or {}
        twenty_id = created.get("id") if isinstance(created, dict) else None
        row["mode"] = "create"
        row["status"] = st
        row["twentyId"] = twenty_id
        if st not in (200, 201):
            row["error"] = res.get("error")
            # retry email dedup on duplicate
            if emails and twenty_id is None:
                existing_id = find_person_by_email(emails[0])
                if existing_id:
                    http_json(
                        "PATCH",
                        f"/people/{existing_id}",
                        {"pipedriveId": pid},
                        user_agent=UA,
                    )
                    row["mode"] = "email_dedup_after_fail"
                    row["twentyId"] = existing_id
                    row["status"] = 200
                    row.pop("error", None)
        results.append(row)
        time.sleep(0.45)
        if (i + 1) % 25 == 0:
            print(
                f"  {i+1}/{len(missing)} {row['mode']} {pid} st={row.get('status')}",
                flush=True,
            )
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

    modes: dict[str, int] = {}
    for r in results:
        modes[r.get("mode") or "?"] = modes.get(r.get("mode") or "?", 0) + 1
    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "apply": args.apply,
        "pd_expected": len(expected),
        "twenty_already": len(have),
        "missing_total": len([p for p in expected if str(p["id"]) not in have]),
        "processed": len(results),
        "modes": modes,
        "results": results,
    }
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({k: out[k] for k in out if k != "results"}, indent=2), flush=True)
    print(f"→ {path}", flush=True)


if __name__ == "__main__":
    main()
