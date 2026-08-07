#!/usr/bin/env python3
"""Rollback importu Pipedrive z Twenty (REST) — TYLKO przed IMAP.

Usuwa rekordy z mostem migracji:
  Opportunity: pipedriveId niepusty LUB srcSystem=PIPEDRIVE_LEGACY
  Person / Company: pipedriveId niepusty

Kolejność: opportunities → people → companies.
Notes/Tasks podpięte do PD-rekordów: skrypt NIE czyści ich automatycznie
(Twenty REST bez prostego filtra noteTargets) — po rollbacku sprawdź sieroty ręcznie
albo uruchom osobny cleanup.

Użycie:
  python3 integrations/tools/pipedrive_rollback_twenty.py --dry-run
  python3 integrations/tools/pipedrive_rollback_twenty.py --apply

Wymaga TWENTY_API_KEY w .env.local.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
USER_AGENT = "owocni-pipedrive-rollback/1.0"
PIPEDRIVE_NONEMPTY = 'pipedriveId[neq]:""'
SRC_PD = "srcSystem[eq]:PIPEDRIVE_LEGACY"


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


def rest_base() -> str:
    return os.environ.get("TWENTY_REST_URL", "https://api.twenty.com/rest").rstrip("/")


def headers() -> dict[str, str]:
    key = os.environ.get("TWENTY_API_KEY", "").strip()
    if not key:
        raise SystemExit("Brak TWENTY_API_KEY")
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }


def http_json(method: str, path: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{rest_base()}{path}",
        data=data,
        headers=headers(),
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            raw = res.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")[:400]
        raise RuntimeError(f"{method} {path} → HTTP {e.code}: {err}") from e


def fetch_filtered(collection: str, filt: str) -> list[dict]:
    out: list[dict] = []
    cursor: str | None = None
    while True:
        qs = {"limit": "60", "filter": filt}
        if cursor:
            qs["starting_after"] = cursor
        page = http_json("GET", f"/{collection}?" + urllib.parse.urlencode(qs))
        batch = (page.get("data") or {}).get(collection) or []
        out.extend(batch)
        page_info = page.get("pageInfo") or {}
        paging = page.get("paging") or {}
        if page_info.get("hasNextPage"):
            cursor = page_info.get("endCursor")
        else:
            cursor = paging.get("next_cursor") or paging.get("nextCursor")
        if not cursor or len(batch) < 60:
            break
        time.sleep(0.2)
    return out


def merge_by_id(*lists: list[dict]) -> list[dict]:
    seen: dict[str, dict] = {}
    for lst in lists:
        for row in lst:
            rid = row.get("id")
            if rid:
                seen[rid] = row
    return list(seen.values())


def delete_one(collection_singular_path: str, record_id: str) -> bool:
    """collection_singular_path e.g. opportunities/{id} uses plural REST."""
    try:
        http_json("DELETE", f"/{collection_singular_path}/{record_id}")
        return True
    except RuntimeError as e:
        print(f"  FAIL DELETE {collection_singular_path}/{record_id}: {e}", file=sys.stderr)
        return False


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser(description="Rollback Pipedrive import from Twenty")
    parser.add_argument("--dry-run", action="store_true", help="Tylko policz (domyślne jeśli brak --apply)")
    parser.add_argument("--apply", action="store_true", help="Faktycznie usuń")
    args = parser.parse_args()
    apply = bool(args.apply)
    if not apply:
        args.dry_run = True

    print(f"Pipedrive rollback ({'APPLY' if apply else 'DRY-RUN'}) @ {rest_base()}")
    print("UWAGA: wolno tylko PRZED podłączeniem/re-sync IMAP po loadzie.\n")

    opps = merge_by_id(
        fetch_filtered("opportunities", PIPEDRIVE_NONEMPTY),
        fetch_filtered("opportunities", SRC_PD),
    )
    people = fetch_filtered("people", PIPEDRIVE_NONEMPTY)
    companies = fetch_filtered("companies", PIPEDRIVE_NONEMPTY)

    print(f"opportunities (pipedriveId|PIPEDRIVE_LEGACY): {len(opps)}")
    for o in opps[:10]:
        print(f"  - {o.get('id')} | {o.get('name')!r} | pd={o.get('pipedriveId')!r} src={o.get('srcSystem')!r}")
    if len(opps) > 10:
        print(f"  … +{len(opps) - 10} more")

    print(f"people (pipedriveId): {len(people)}")
    for p in people[:5]:
        name = p.get("name") or {}
        label = f"{name.get('firstName', '')} {name.get('lastName', '')}".strip() if isinstance(name, dict) else name
        print(f"  - {p.get('id')} | {label!r} | pd={p.get('pipedriveId')!r}")

    print(f"companies (pipedriveId): {len(companies)}")
    for c in companies[:5]:
        print(f"  - {c.get('id')} | {c.get('name')!r} | pd={c.get('pipedriveId')!r}")

    if not apply:
        print("\nDry-run only. Aby usunąć: --apply")
        return 0

    if not opps and not people and not companies:
        print("\nNic do usunięcia.")
        return 0

    confirm = input(f"Usunąć {len(opps)} opp + {len(people)} people + {len(companies)} companies? wpisz DELETE: ")
    if confirm.strip() != "DELETE":
        print("Anulowano.")
        return 1

    ok = fail = 0
    for o in opps:
        if delete_one("opportunities", o["id"]):
            ok += 1
        else:
            fail += 1
        time.sleep(0.15)
    for p in people:
        if delete_one("people", p["id"]):
            ok += 1
        else:
            fail += 1
        time.sleep(0.15)
    for c in companies:
        if delete_one("companies", c["id"]):
            ok += 1
        else:
            fail += 1
        time.sleep(0.15)

    print(f"\nDONE ok={ok} fail={fail}")
    print("Sprawdź ręcznie Notes/Tasks sieroty (nie objęte tym skryptem).")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
