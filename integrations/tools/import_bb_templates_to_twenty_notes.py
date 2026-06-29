#!/usr/bin/env python3
"""DEPRECATED — spike odrzucony 2026-06-16. Zobacz E12_3_EMAIL_TEMPLATE_STRATEGY.md."""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
EXPORT_DIR = REPO_ROOT / "integrations" / "runbooks" / "exports" / "bb_email_templates"
STAMP = "2026-06-16"
REST_URL = os.environ.get("TWENTY_REST_URL", "https://api.twenty.com/rest")
USER_AGENT = "owocni-import-bb-templates-notes/1.0"
MAX_BODY_CHARS = 120_000


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


def api_request(method: str, path: str, payload: dict | None = None) -> dict:
    key = os.environ.get("TWENTY_API_KEY", "").strip()
    if not key:
        print("Brak TWENTY_API_KEY w .env.local", file=sys.stderr)
        sys.exit(2)
    headers = {
        "Authorization": f"Bearer {key}",
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
    }
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(f"{REST_URL.rstrip('/')}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = resp.read().decode()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode()[:800]
        raise RuntimeError(f"{method} {path} -> HTTP {exc.code}: {detail}") from exc


def list_existing_bb_notes() -> dict[int, str]:
    out: dict[int, str] = {}
    cursor = None
    while True:
        path = "/notes?limit=60"
        if cursor:
            path += f"&starting_after={cursor}"
        data = api_request("GET", path)
        for note in data.get("data", {}).get("notes", []):
            title = note.get("title") or ""
            if title.startswith("[BB ") and "]" in title[4:]:
                try:
                    bb_id = int(title[4 : title.index("]")])
                    out[bb_id] = note["id"]
                except ValueError:
                    pass
        page = data.get("pageInfo") or {}
        if not page.get("hasNextPage"):
            break
        cursor = page.get("endCursor")
    return out


def build_markdown(row: dict, html: str) -> str:
    subject = (row.get("subject") or "").strip()
    cats = ", ".join(row.get("category_labels") or []) or "—"
    header = [
        "# Szablon maila (migracja z better-bitrix)",
        "",
        f"- **BB id:** {row['id']}",
        f"- **Priorytet:** {row.get('migration_priority', '—')}",
        f"- **Kategoria BB:** {cats}",
        f"- **Subject:** {subject or '(pusty — uzupełnij w composerze)'}",
        "",
        "## Treść HTML",
        "",
        "Skopiuj poniżej do edytora maila w Twenty (tryb HTML / wklej ze schowka).",
        "",
    ]
    if len(html) > MAX_BODY_CHARS:
        header.append(
            f"> Uwaga: treść obcięta do {MAX_BODY_CHARS} znaków. Pełny plik: "
            f"`exports/bb_email_templates/html_{STAMP}/{row['id']}_*.html`"
        )
        header.append("")
        html = html[:MAX_BODY_CHARS] + "\n<!-- truncated -->"
    header.append(f"```html\n{html}\n```")
    return "\n".join(header)


def import_templates(*, dry_run: bool, only_must: bool) -> int:
    src = EXPORT_DIR / f"bb_email_templates_migration_{STAMP}.json"
    if not src.is_file():
        print(f"Brak {src} — uruchom prepare_bb_template_migration.py", file=sys.stderr)
        return 1

    rows = json.loads(src.read_text(encoding="utf-8"))["templates"]
    if only_must:
        rows = [r for r in rows if r.get("migration_priority") == "MUST"]

    existing = list_existing_bb_notes() if not dry_run else {}
    created = updated = skipped = 0
    mapping: list[dict] = []

    for row in rows:
        bb_id = row["id"]
        title = row["twenty_name"]
        html_path = EXPORT_DIR / f"html_{STAMP}" / f"{bb_id}_{slug(row.get('title') or 'untitled')}.html"
        html = html_path.read_text(encoding="utf-8") if html_path.is_file() else (row.get("message") or "")
        markdown = build_markdown(row, html)

        if dry_run:
            print(f"DRY {bb_id}: {title} ({len(html)} chars)")
            continue

        payload = {"title": title, "bodyV2": {"markdown": markdown}}
        if bb_id in existing:
            note_id = existing[bb_id]
            api_request("PATCH", f"/notes/{note_id}", payload)
            updated += 1
            mapping.append({"bb_id": bb_id, "twenty_note_id": note_id, "action": "updated"})
            print(f"UPDATE {bb_id} -> {note_id}")
        else:
            resp = api_request("POST", "/notes", payload)
            note_id = resp["data"]["createNote"]["id"]
            created += 1
            mapping.append({"bb_id": bb_id, "twenty_note_id": note_id, "action": "created"})
            print(f"CREATE {bb_id} -> {note_id}")
        time.sleep(0.25)

    if not dry_run:
        out = EXPORT_DIR / f"twenty_notes_mapping_{STAMP}.json"
        out.write_text(json.dumps({"mapping": mapping}, indent=2), encoding="utf-8")
        print(f"Done: created={created} updated={updated} skipped={skipped}")
        print(f"Mapping: {out}")
    return 0


def slug(title: str) -> str:
    out = []
    for ch in title.lower():
        if ch.isalnum():
            out.append(ch)
        elif ch in " -_":
            out.append("-")
    s = "".join(out).strip("-")
    while "--" in s:
        s = s.replace("--", "-")
    return (s[:60] or "untitled").strip("-")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only-must", action="store_true", help="Import tylko 9 MUST")
    args = parser.parse_args()
    load_env()
    return import_templates(dry_run=args.dry_run, only_must=args.only_must)


if __name__ == "__main__":
    raise SystemExit(main())
