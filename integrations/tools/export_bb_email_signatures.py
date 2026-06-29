#!/usr/bin/env python3
"""Export BB email_signature rows for E12.3 FAZA A2.4."""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

import urllib.request

REPO_ROOT = Path(__file__).resolve().parents[2]
BB_ENV = REPO_ROOT.parent / "better-bitrix-main" / ".env"
OUT_DIR = Path(__file__).resolve().parents[1] / "runbooks" / "exports" / "bb_email_templates"


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key] = value.strip().strip('"').strip("'")
    return env


def main() -> int:
    if not BB_ENV.is_file():
        print(f"Missing {BB_ENV}", file=sys.stderr)
        return 1
    env = load_env(BB_ENV)
    base = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    key = env["NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"]
    url = f"{base}/rest/v1/email_signature?select=*&order=title.asc"
    req = urllib.request.Request(
        url,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req) as resp:
        rows = json.loads(resp.read())

    stamp = date.today().isoformat()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    html_dir = OUT_DIR / f"signatures_html_{stamp}"
    html_dir.mkdir(exist_ok=True)

    for row in rows:
        title = (row.get("title") or f"sig_{row['id']}").strip()
        safe = "".join(c if c.isalnum() or c in "-_" else "-" for c in title.lower())[:50]
        (html_dir / f"{row['id']}_{safe}.html").write_text(row.get("message") or "", encoding="utf-8")

    out = OUT_DIR / f"bb_email_signatures_{stamp}.json"
    out.write_text(
        json.dumps({"exported_at": stamp, "count": len(rows), "signatures": rows}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Exported {len(rows)} signatures → {out.name}, {html_dir.name}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
