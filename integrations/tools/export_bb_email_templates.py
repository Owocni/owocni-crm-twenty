#!/usr/bin/env python3
"""Export better-bitrix email_template rows from Supabase (E12.3 FAZA A1)."""
from __future__ import annotations

import csv
import json
import sys
from datetime import date
from pathlib import Path

import urllib.request

REPO_ROOT = Path(__file__).resolve().parents[2]
BB_ENV = REPO_ROOT.parent / "better-bitrix-main" / ".env"
OUT_DIR = Path(__file__).resolve().parents[1] / "runbooks" / "exports" / "bb_email_templates"

CRM_CATEGORIES = {
    "sales",
    "contact",
    "reminder",
    "customer_service",
    "texts",
    "project_start",
    "website",
    "packaging",
    "name",
    "logo",
    "invoice",
    "packages",
}


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


def fetch_templates(env: dict[str, str]) -> list[dict]:
    base = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    key = env["NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"]
    url = (
        f"{base}/rest/v1/email_template"
        "?select=id,title,subject,message,category,created_at"
        "&order=title.asc"
    )
    req = urllib.request.Request(
        url,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def classify(categories: list[str] | None) -> str:
    cats = set(categories or [])
    if not cats:
        return "needs_review"
    if cats <= {"helpdesk"}:
        return "helpdesk"
    if cats & {"helpdesk"}:
        return "mixed"
    if cats <= CRM_CATEGORIES:
        return "crm"
    return "other"


def main() -> int:
    if not BB_ENV.is_file():
        print(f"Missing {BB_ENV}", file=sys.stderr)
        return 1

    env = load_env(BB_ENV)
    rows = fetch_templates(env)
    stamp = date.today().isoformat()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    enriched = []
    for row in rows:
        cats = row.get("category") or []
        enriched.append(
            {
                **row,
                "export_scope": classify(cats),
                "category_labels": cats,
            }
        )

    json_path = OUT_DIR / f"bb_email_templates_{stamp}.json"
    csv_path = OUT_DIR / f"bb_email_templates_{stamp}.csv"
    md_path = OUT_DIR / f"bb_email_templates_{stamp}.md"
    html_dir = OUT_DIR / f"html_{stamp}"
    html_dir.mkdir(exist_ok=True)

    json_path.write_text(
        json.dumps(
            {
                "exported_at": stamp,
                "source": "better-bitrix email_template (Supabase)",
                "count": len(enriched),
                "templates": enriched,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "id",
                "title",
                "subject",
                "category",
                "export_scope",
                "message_chars",
                "html_file",
            ],
        )
        writer.writeheader()
        for row in enriched:
            html_file = f"{row['id']}_{slug(row['title'] or 'untitled')}.html"
            (html_dir / html_file).write_text(row.get("message") or "", encoding="utf-8")
            writer.writerow(
                {
                    "id": row["id"],
                    "title": row.get("title") or "",
                    "subject": row.get("subject") or "",
                    "category": "|".join(row.get("category_labels") or []),
                    "export_scope": row["export_scope"],
                    "message_chars": len(row.get("message") or ""),
                    "html_file": html_file,
                }
            )

    md_path.write_text(render_markdown(enriched, stamp, html_dir.name), encoding="utf-8")

    counts: dict[str, int] = {}
    for row in enriched:
        counts[row["export_scope"]] = counts.get(row["export_scope"], 0) + 1

    print(f"Exported {len(enriched)} templates to {OUT_DIR}")
    for scope, n in sorted(counts.items()):
        print(f"  {scope}: {n}")
    print(f"  JSON: {json_path.name}")
    print(f"  CSV:  {csv_path.name}")
    print(f"  MD:   {md_path.name}")
    print(f"  HTML: {html_dir.name}/")
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


def render_markdown(rows: list[dict], stamp: str, html_dir: str) -> str:
    lines = [
        f"# BB email templates — export {stamp}",
        "",
        f"**Count:** {len(rows)} (wszystkie, w tym helpdesk — decyzja migracji do Twenty)",
        "",
        "| id | title | subject | category | scope | HTML |",
        "|----|-------|---------|----------|-------|------|",
    ]
    for row in rows:
        cats = ", ".join(row.get("category_labels") or []) or "—"
        html_file = f"{row['id']}_{slug(row.get('title') or 'untitled')}.html"
        subj = (row.get("subject") or "").replace("|", "\\|")[:80]
        title = (row.get("title") or "").replace("|", "\\|")
        lines.append(
            f"| {row['id']} | {title} | {subj} | {cats} | {row['export_scope']} | `{html_dir}/{html_file}` |"
        )
    lines.extend(
        [
            "",
            "## Następny krok (FAZA A2)",
            "",
            "1. Oznacz MUST / NICE / ARCHIWUM (kolumna w CSV lub komentarz w Twenty).",
            "2. Utwórz Message templates w Twenty sandbox — wklej treść z `html_*/`.",
            "3. Uzupełnij mapowanie BB id → Twenty name w `E12_EMAIL_SYNC_EVIDENCE.md` §E12.3.",
            "",
        ]
    )
    return "\n".join(lines)


if __name__ == "__main__":
    raise SystemExit(main())
