#!/usr/bin/env python3
"""Soft-delete Twenty Messages older than a cutoff. Does NOT touch IMAP.

Usage:
  python3 integrations/tools/twenty_cleanup_old_messages.py --dry-run
  python3 integrations/tools/twenty_cleanup_old_messages.py --apply

Requires TWENTY_API_KEY in .env.local (repo root).
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
USER_AGENT = "owocni-msg-cleanup/1.0"
DEFAULT_CUTOFF = "2023-07-21T00:00:00.000Z"
BATCH = 100
# Cloud long limit: 100 req / 60 s. Each cycle = GET + DELETE (+ rare count).
# ~2.5 s/cycle ⇒ ≤ ~48 cycles/min ⇒ ≤ ~96 req/min with headroom.
MIN_CYCLE_SEC = 2.5
MAX_RETRIES = 8
RATE_LIMIT_SLEEP_SEC = 65.0


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


def gql_url() -> str:
    return os.environ.get("TWENTY_GRAPHQL_URL", "https://api.twenty.com/graphql").rstrip("/")


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


def _is_rate_limit(payload: dict | str, http_code: int | None = None) -> bool:
    if http_code == 429:
        return True
    text = payload if isinstance(payload, str) else json.dumps(payload)
    return "LIMIT_REACHED" in text or "Rate limit" in text or "Limit reached" in text


def http_json(method: str, url: str, body: dict | None = None, timeout: int = 180) -> dict:
    data = None if body is None else json.dumps(body).encode("utf-8")
    last_err: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        req = urllib.request.Request(url, data=data, headers=api_headers(), method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", errors="replace")[:800]
            last_err = RuntimeError(f"HTTP {e.code} {url}: {err}")
            if _is_rate_limit(err, e.code) and attempt < MAX_RETRIES:
                print(
                    f"  rate-limit HTTP {e.code}, sleep {RATE_LIMIT_SLEEP_SEC:.0f}s "
                    f"(attempt {attempt}/{MAX_RETRIES})",
                    flush=True,
                )
                time.sleep(RATE_LIMIT_SLEEP_SEC)
                continue
            raise last_err from e
    raise last_err or RuntimeError("http_json failed")


def count_old(cutoff: str) -> int:
    filt = urllib.parse.quote(f"receivedAt[lt]:{cutoff}")
    url = f"{rest_base()}/messages?limit=1&filter={filt}"
    payload = http_json("GET", url, timeout=60)
    return int(payload.get("totalCount") or payload.get("data", {}).get("totalCount") or 0)


def fetch_batch_ids(cutoff: str) -> list[str]:
    filt = urllib.parse.quote(f"receivedAt[lt]:{cutoff}")
    url = (
        f"{rest_base()}/messages?limit={BATCH}"
        f"&filter={filt}&order_by=receivedAt[AscNullsFirst]"
    )
    payload = http_json("GET", url, timeout=120)
    msgs = payload.get("data", {}).get("messages") or []
    return [m["id"] for m in msgs if m.get("id")]


def delete_ids(ids: list[str]) -> int:
    last_err: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        out = http_json(
            "POST",
            gql_url(),
            {
                "query": (
                    "mutation($filter: MessageFilterInput!) {"
                    "  deleteMessages(filter: $filter) { id }"
                    "}"
                ),
                "variables": {"filter": {"id": {"in": ids}}},
            },
        )
        if out.get("errors"):
            last_err = RuntimeError(f"GraphQL errors: {out['errors']}")
            if _is_rate_limit(out) and attempt < MAX_RETRIES:
                print(
                    f"  rate-limit GQL, sleep {RATE_LIMIT_SLEEP_SEC:.0f}s "
                    f"(attempt {attempt}/{MAX_RETRIES})",
                    flush=True,
                )
                time.sleep(RATE_LIMIT_SLEEP_SEC)
                continue
            raise last_err
        deleted = (out.get("data") or {}).get("deleteMessages") or []
        return len(deleted)
    raise last_err or RuntimeError("delete_ids failed")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cutoff", default=DEFAULT_CUTOFF)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--max-batches", type=int, default=0, help="0 = until empty")
    args = parser.parse_args()
    if not args.dry_run and not args.apply:
        print("Podaj --dry-run lub --apply", file=sys.stderr)
        sys.exit(1)

    load_dotenv_local()
    cutoff = args.cutoff
    remaining = count_old(cutoff)
    print(f"Twenty message cleanup @ {rest_base()}")
    print(f"cutoff receivedAt < {cutoff}")
    print(f"matching now: {remaining}")
    if args.dry_run:
        print("DRY-RUN — nic nie usuwam.")
        return

    deleted_total = 0
    batch_n = 0
    t0 = time.time()
    while remaining > 0:
        if args.max_batches and batch_n >= args.max_batches:
            print(f"stop: max-batches={args.max_batches}")
            break
        cycle_start = time.time()
        ids = fetch_batch_ids(cutoff)
        if not ids:
            print("brak ID do usunięcia — koniec")
            break
        n = delete_ids(ids)
        deleted_total += n
        batch_n += 1
        elapsed = time.time() - t0
        rate = deleted_total / elapsed if elapsed > 0 else 0
        eta_min = ((remaining - n) / rate / 60) if rate > 0 else 0
        print(
            f"batch {batch_n}: -{n} | deleted {deleted_total} | "
            f"~{rate:.0f}/s | ETA ~{eta_min:.0f} min",
            flush=True,
        )
        # Refresh remaining rarely (each check burns a rate-limit token).
        if batch_n % 25 == 0:
            remaining = count_old(cutoff)
            print(f"  remaining check: {remaining}", flush=True)
        else:
            remaining = max(0, remaining - n)
        sleep_for = MIN_CYCLE_SEC - (time.time() - cycle_start)
        if sleep_for > 0:
            time.sleep(sleep_for)

    final = count_old(cutoff)
    print("--- done ---")
    print(f"deleted this run: {deleted_total}")
    print(f"remaining with receivedAt < {cutoff}: {final}")


if __name__ == "__main__":
    main()
