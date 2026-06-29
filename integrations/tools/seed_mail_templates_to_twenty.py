#!/usr/bin/env python3
"""Seed mailTemplate records from BB export into Twenty workspace."""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
EXPORT = REPO_ROOT / "integrations/runbooks/exports/bb_email_templates"
MIGRATION_FILE = EXPORT / "bb_email_templates_migration_2026-06-16.json"
MAPPING_FILE = EXPORT / "seed_mapping_twenty_mail_templates.json"

BB_TAG_TO_CATEGORY = {
    "sales": "SALES",
    "contact": "SALES",
    "website": "WEBSITE",
    "helpdesk": "HELPDESK",
    "logo": "LOGO",
    "name": "NAME",
    "invoice": "INVOICE",
    "customer_service": "CUSTOMER_SERVICE",
    "reminder": "REMINDER",
    "texts": "GENERAL",
    "project_start": "GENERAL",
    "packaging": "GENERAL",
    "packages": "GENERAL",
}


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


def category_from_row(row: dict) -> str:
    labels = row.get("category_labels") or []
    for label in labels:
        mapped = BB_TAG_TO_CATEGORY.get(label)
        if mapped:
            return mapped
    return "GENERAL"


def rest(method: str, path: str, payload: dict | None = None) -> dict:
    api_key = os.environ["TWENTY_API_KEY"]
    base = os.environ.get("TWENTY_REST_URL", "https://api.twenty.com/rest").rstrip("/")
    request = urllib.request.Request(
        f"{base}{path}",
        data=json.dumps(payload).encode("utf-8") if payload else None,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "owocni-seed-mail-templates/1.0",
        },
        method=method,
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            body = response.read()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"{method} {path} -> HTTP {exc.code}: {detail}") from exc


def list_existing_legacy_ids() -> set[int]:
    try:
        payload = rest("GET", "/mailTemplates?limit=200")
    except RuntimeError as exc:
        if "404" in str(exc):
            return set()
        raise

    records = payload.get("data", {}).get("mailTemplates", [])
    if isinstance(records, list):
        return {
            int(record["legacyId"])
            for record in records
            if record.get("legacyId") is not None
        }

    return set()


def main() -> None:
    load_env()

    if "TWENTY_API_KEY" not in os.environ or not os.environ["TWENTY_API_KEY"]:
        raise SystemExit("TWENTY_API_KEY is empty in .env.local")

    rows = json.loads(MIGRATION_FILE.read_text(encoding="utf-8"))["templates"]
    existing_legacy_ids = list_existing_legacy_ids()
    mapping: list[dict] = []
    created = 0
    skipped = 0

    for row in rows:
        bb_id = int(row["id"])
        if bb_id in existing_legacy_ids:
            skipped += 1
            print(f"  SKIP bb={bb_id} (already seeded)")
            continue

        name = (row.get("twenty_name") or row.get("title") or "Bez tytułu").strip()
        subject = (row.get("subject") or "").strip()
        body_html = (row.get("message") or "").strip()
        category = category_from_row(row)
        priority = "MUST" if row.get("migration_priority") == "MUST" else "NICE"

        payload = {
            "name": name,
            "subjectTemplate": subject,
            "bodyHtmlTemplate": {"markdown": body_html},
            "category": category,
            "priority": priority,
            "legacyId": bb_id,
            "isActive": True,
        }

        try:
            response = rest("POST", "/mailTemplates", payload)
            record = response.get("data", {}).get("createMailTemplate") or response.get(
                "data", {}
            ).get("mailTemplate")
            if not record:
                record = response.get("data", response)
            twenty_id = record.get("id")
            if not twenty_id:
                raise RuntimeError(f"Unexpected response shape: {json.dumps(response)[:300]}")
            mapping.append(
                {
                    "bb_id": bb_id,
                    "twenty_id": twenty_id,
                    "name": name,
                    "category": category,
                    "priority": priority,
                }
            )
            created += 1
            print(f"  OK   bb={bb_id} -> {twenty_id}  {name[:60]}")
        except RuntimeError as exc:
            print(f"  ERR  bb={bb_id}: {exc}")

        time.sleep(0.25)

    MAPPING_FILE.write_text(
        json.dumps({"mapping": mapping, "created": created, "skipped": skipped}, indent=2),
        encoding="utf-8",
    )
    print(f"\nDone: created={created}, skipped={skipped}, total={len(rows)}")
    print(f"Mapping: {MAPPING_FILE}")


if __name__ == "__main__":
    main()
