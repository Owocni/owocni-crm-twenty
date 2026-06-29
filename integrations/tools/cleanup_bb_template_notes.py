#!/usr/bin/env python3
"""Remove BB template spike Notes from Twenty sandbox (E12.3 cleanup)."""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
MAPPING = (
    REPO_ROOT
    / "integrations/runbooks/exports/bb_email_templates/twenty_notes_mapping_2026-06-16.json"
)
REST_URL = os.environ.get("TWENTY_REST_URL", "https://api.twenty.com/rest")


def load_env() -> None:
    env_path = REPO_ROOT / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def api(method: str, path: str) -> None:
    key = os.environ.get("TWENTY_API_KEY", "").strip()
    req = urllib.request.Request(
        f"{REST_URL.rstrip('/')}{path}",
        headers={
            "Authorization": f"Bearer {key}",
            "User-Agent": "owocni-cleanup-bb-notes/1.0",
        },
        method=method,
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        resp.read()


def main() -> int:
    load_env()
    ids: list[str] = []
    if MAPPING.is_file():
        data = json.loads(MAPPING.read_text(encoding="utf-8"))
        ids.extend(row["twenty_note_id"] for row in data.get("mapping", []))

    deleted = failed = 0
    for note_id in ids:
        try:
            api("DELETE", f"/notes/{note_id}")
            deleted += 1
            print(f"DELETE {note_id}")
            time.sleep(0.15)
        except urllib.error.HTTPError as exc:
            failed += 1
            print(f"FAIL {note_id}: HTTP {exc.code}", file=sys.stderr)

    print(f"Done: deleted={deleted} failed={failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
