#!/usr/bin/env python3
"""Usuń rekordy CRM z Twenty (REST API) — smoke/POC przed Email Sync.

Użycie:
  python3 integrations/tools/twenty_cleanup.py --dry-run
  python3 integrations/tools/twenty_cleanup.py --apply

Wymaga TWENTY_API_KEY w .env.local. Nie usuwa pól custom ani webhooków.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
USER_AGENT = "owocni-crm-twenty-cleanup/1.0"

# Kolejność: zależności FK (opp → person/company)
DELETE_ORDER = (
    "opportunities",
    "notes",
    "tasks",
    "messageThreads",
    "messages",
    "people",
    "companies",
)


def load_dotenv_local() -> None:
    env_path = REPO_ROOT / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def rest_base() -> str:
    return os.environ.get("TWENTY_REST_URL", "https://api.twenty.com/rest").rstrip("/")


def api_headers() -> dict[str, str]:
    token = os.environ.get("TWENTY_API_KEY", "").strip()
    if not token:
        print("Błąd: brak TWENTY_API_KEY", file=sys.stderr)
        sys.exit(2)
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
    }


def fetch_all_ids(collection: str) -> list[str]:
    ids: list[str] = []
    cursor: str | None = None
    while True:
        url = f"{rest_base()}/{collection}?limit=60"
        if cursor:
            url += f"&starting_after={cursor}"
        req = urllib.request.Request(url, headers=api_headers(), method="GET")
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        items = payload.get("data", {}).get(collection, [])
        for item in items:
            rid = item.get("id")
            if rid:
                ids.append(rid)
        page = payload.get("pageInfo") or {}
        if not page.get("hasNextPage"):
            break
        cursor = page.get("endCursor")
        if not cursor:
            break
    return ids


def delete_one(collection: str, record_id: str) -> bool:
    url = f"{rest_base()}/{collection}/{record_id}"
    req = urllib.request.Request(url, headers=api_headers(), method="DELETE")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return 200 <= resp.status < 300
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:200]
        print(f"  FAIL DELETE {collection}/{record_id}: {e.code} {body}", file=sys.stderr)
        return False


def main() -> None:
    load_dotenv_local()
    apply = "--apply" in sys.argv
    dry = "--dry-run" in sys.argv or not apply
    if not dry and not apply:
        print("Podaj --dry-run lub --apply", file=sys.stderr)
        sys.exit(1)

    print(f"Twenty cleanup ({'APPLY' if apply else 'DRY-RUN'}) @ {rest_base()}")
    summary: dict[str, tuple[int, int]] = {}

    for collection in DELETE_ORDER:
        try:
            ids = fetch_all_ids(collection)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print(f"  skip {collection} (endpoint n/a)")
                continue
            raise
        print(f"{collection}: {len(ids)} rekordów")
        deleted = 0
        if apply:
            for i, rid in enumerate(ids, 1):
                if delete_one(collection, rid):
                    deleted += 1
                if i % 10 == 0:
                    time.sleep(0.2)
        summary[collection] = (len(ids), deleted if apply else 0)

    print("\n--- podsumowanie ---")
    for col, (total, deleted) in summary.items():
        if total:
            print(f"  {col}: {total}" + (f" → usunięto {deleted}" if apply else " (dry-run)"))

    if dry:
        print("\nUruchom z --apply aby usunąć.")


if __name__ == "__main__":
    main()
