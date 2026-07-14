#!/usr/bin/env python3
"""Backfill qualifiedAt / bizSqlConfirmedAt for bizSqlConfirmed deals missing metrics."""
from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
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


def rest_get(path: str) -> dict:
    key = os.environ["TWENTY_API_KEY"]
    base = os.environ.get("TWENTY_REST_URL", "https://api.twenty.com/rest").rstrip("/")
    req = urllib.request.Request(
        f"{base}{path}",
        headers={"Authorization": f"Bearer {key}", "User-Agent": "owocni-backfill-sql/1.0"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        return json.loads(res.read().decode())


def rest_patch(opp_id: str, body: dict) -> dict:
    key = os.environ["TWENTY_API_KEY"]
    base = os.environ.get("TWENTY_REST_URL", "https://api.twenty.com/rest").rstrip("/")
    req = urllib.request.Request(
        f"{base}/opportunities/{opp_id}",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "User-Agent": "owocni-backfill-sql/1.0",
        },
        method="PATCH",
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        return json.loads(res.read().decode())


def parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def hours_to_sql(created_at: str, sql_at: str) -> float:
    delta = parse_dt(sql_at) - parse_dt(created_at)
    return round(delta.total_seconds() / 3600, 2)


def fetch_broken() -> list[dict]:
    opps: list[dict] = []
    cursor = None
    while True:
        qs = {"limit": "200"}
        if cursor:
            qs["starting_after"] = cursor
        page = rest_get("/opportunities?" + urllib.parse.urlencode(qs))
        batch = page.get("data", {}).get("opportunities", [])
        if not batch:
            break
        opps.extend(batch)
        paging = page.get("paging", {})
        cursor = paging.get("next_cursor") or paging.get("nextCursor")
        if not cursor or len(batch) < 200:
            break
    return [
        o
        for o in opps
        if o.get("bizSqlConfirmed") is True and not o.get("qualifiedAt")
    ]


def pick_sql_timestamp(opp: dict) -> str:
    if opp.get("bizSqlConfirmedAt"):
        return opp["bizSqlConfirmedAt"]
    return opp.get("updatedAt") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def main() -> int:
    load_env()
    broken = fetch_broken()
    if not broken:
        print(json.dumps({"patched": 0, "message": "nothing to backfill"}))
        return 0

    patched = []
    for opp in broken:
        sql_at = pick_sql_timestamp(opp)
        hours = hours_to_sql(opp["createdAt"], sql_at)
        body = {
            "qualifiedAt": sql_at,
            "hoursToQualified": hours,
            "bizSqlConfirmedAt": sql_at,
        }
        rest_patch(opp["id"], body)
        patched.append(
            {
                "id": opp["id"],
                "name": opp.get("name"),
                "qualifiedAt": sql_at,
                "hoursToQualified": hours,
            }
        )

    print(json.dumps({"patched": len(patched), "records": patched}, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
