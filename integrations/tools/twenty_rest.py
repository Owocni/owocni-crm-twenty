#!/usr/bin/env python3
"""Minimal Twenty REST helpers for repair scripts (cursor pagination)."""
from __future__ import annotations

import json
import os
import time
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
        os.environ[key.strip()] = value.strip().strip('"').strip("'")


def rest_base() -> str:
    return os.environ.get("TWENTY_REST_URL", "https://api.twenty.com/rest").rstrip("/")


def headers(user_agent: str) -> dict[str, str]:
    key = os.environ.get("TWENTY_API_KEY", "").strip()
    if not key:
        raise SystemExit("Brak TWENTY_API_KEY")
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "User-Agent": user_agent,
        "Accept": "application/json",
    }


def http_json(
    method: str,
    path: str,
    body: dict | None = None,
    *,
    user_agent: str = "owocni-twenty-rest/1.0",
) -> tuple[int, dict]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    for attempt in range(8):
        req = urllib.request.Request(
            f"{rest_base()}{path}",
            data=data,
            headers=headers(user_agent),
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                raw = res.read().decode("utf-8")
                return res.status, (json.loads(raw) if raw else {})
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", errors="replace")
            if e.code == 429:
                time.sleep(min(60.0, 5.0 * (2**attempt)))
                continue
            return e.code, {"error": err[:600]}
    return 429, {"error": "rate limit"}


def paginate(
    collection: str,
    list_key: str,
    filter_q: str,
    *,
    user_agent: str = "owocni-twenty-rest/1.0",
    limit: int = 100,
    pace: float = 0.4,
    max_pages: int = 500,
) -> list[dict]:
    """Cursor pagination via starting_after (offset is broken / duplicates pages)."""
    out: list[dict] = []
    seen: set[str] = set()
    cursor: str | None = None
    pages = 0
    while True:
        pages += 1
        if pages > max_pages:
            raise SystemExit(
                f"paginate {collection} exceeded {max_pages} pages — abort (have {len(out)})"
            )
        qs: dict[str, str] = {"limit": str(limit), "filter": filter_q}
        if cursor:
            qs["starting_after"] = cursor
        path = f"/{collection}?{urllib.parse.urlencode(qs)}"
        st, payload = http_json("GET", path, user_agent=user_agent)
        if st != 200:
            raise SystemExit(f"paginate {collection} fail {st} {payload}")
        batch = (payload.get("data") or {}).get(list_key) or []
        before = len(seen)
        for row in batch:
            rid = row.get("id")
            if rid and rid in seen:
                continue
            if rid:
                seen.add(rid)
            out.append(row)
        pi = payload.get("pageInfo") or {}
        if not pi.get("hasNextPage"):
            break
        next_cursor = pi.get("endCursor")
        if not next_cursor or not batch or next_cursor == cursor or len(seen) == before:
            break
        cursor = next_cursor
        time.sleep(pace)
    return out
