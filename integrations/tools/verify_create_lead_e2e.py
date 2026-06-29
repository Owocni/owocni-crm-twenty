#!/usr/bin/env python3
"""Preflight / E2E helper for crm:twenty_create_lead (Twenty REST)."""
from __future__ import annotations

import argparse
import json
import os
import random
import string
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def load_env() -> None:
    env_path = REPO_ROOT / ".env.local"
    if not env_path.is_file():
        raise SystemExit(f"Missing {env_path}")
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def map_biz_product(slug: str | None) -> str:
    if not slug:
        return "INNE"
    s = slug.lower().strip()
    mapping = {
        "strony": "WEB",
        "strona": "WEB",
        "web": "WEB",
        "logo": "LOGO",
        "nazwa": "NAME",
        "naming": "NAME",
        "copywriting": "COPYWRITING",
        "opakowanie": "OPAKOWANIE",
        "packaging": "OPAKOWANIE",
        "marketing": "MARKETING",
        "strategia": "MARKETING",
        "konsultacje": "MARKETING",
    }
    if s in mapping:
        return mapping[s]
    upper = slug.upper().strip()
    allowed = {"WEB", "LOGO", "NAME", "MARKETING", "COPYWRITING", "OPAKOWANIE", "INNE"}
    return upper if upper in allowed else "INNE"


def rest(method: str, path: str, payload: dict | None = None) -> tuple[int, dict | str]:
    key = os.environ["TWENTY_API_KEY"]
    base = os.environ.get("TWENTY_REST_URL", "https://api.twenty.com/rest").rstrip("/")
    req = urllib.request.Request(
        f"{base}{path}",
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "User-Agent": "owocni-verify-create-lead/1.0",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            body = res.read().decode()
            return res.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        try:
            parsed = json.loads(detail)
        except json.JSONDecodeError:
            parsed = detail[:800]
        return exc.code, parsed


def extract_id(collection: str, response: dict) -> str | None:
    data = response.get("data", {})
    if collection == "people":
        record = data.get("createPerson") or data.get("person") or {}
    else:
        record = data.get("createOpportunity") or data.get("opportunity") or {}
    return record.get("id")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="Create test Person+Opportunity")
    parser.add_argument("--dry-run", action="store_true", help="Only print mapped payload")
    args = parser.parse_args()

    load_env()

    suffix = "".join(random.choices(string.ascii_lowercase, k=8))
    test_oid = ("01VERIFYCL" + suffix.upper())[:26]
    email = f"verify-create-lead-{suffix}@example.com"

    person_payload = {
        "name": {"firstName": "Verify", "lastName": "CreateLead"},
        "emails": {"primaryEmail": email},
        "idOid": test_oid,
    }
    opp_payload = {
        "name": f"Verify {suffix} — WEB",
        "stage": "NEW",
        "idOid": test_oid,
        "srcSystem": "OWOCNI_SORTOWNIA",
        "bizSource": "FORM",
        "bizProduct": map_biz_product("strony"),
        "pointOfContactId": "<person-id>",
    }

    print("map_biz_product(strony) =", map_biz_product("strony"))
    print("person_payload:", json.dumps(person_payload, indent=2))
    print("opp_payload (template):", json.dumps(opp_payload, indent=2))

    if args.dry_run or not args.write:
        print("\nDry-run OK. Use --write to hit Twenty API.")
        return 0

    st, person_res = rest("POST", "/people", person_payload)
    print(f"\nPOST /people -> {st}")
    if st not in (200, 201):
        print(person_res)
        return 1
    person_id = extract_id("people", person_res if isinstance(person_res, dict) else {})
    if not person_id:
        print("No person id in response")
        return 1

    opp_payload["pointOfContactId"] = person_id
    st2, opp_res = rest("POST", "/opportunities", opp_payload)
    print(f"POST /opportunities -> {st2}")
    if st2 not in (200, 201):
        print(opp_res)
        return 1
    opp_id = extract_id("opportunities", opp_res if isinstance(opp_res, dict) else {})
    print(f"PASS person={person_id} opp={opp_id} idOid={test_oid}")

    filter_param = urllib.parse.quote(f"idOid[eq]:{test_oid}", safe="")
    st3, found = rest("GET", f"/opportunities?filter={filter_param}&limit=1")
    opps = (found.get("data", {}) if isinstance(found, dict) else {}).get("opportunities", [])
    print(f"GET by idOid -> {st3}, count={len(opps)}")
    return 0 if opps else 1


if __name__ == "__main__":
    sys.exit(main())
