#!/usr/bin/env python3
"""Generate local HTML assistant for Twenty UI template import (E12.3 A2.2)."""
from __future__ import annotations

import html
import json
from pathlib import Path

STAMP = "2026-06-16"
EXPORT_DIR = Path(__file__).resolve().parents[1] / "runbooks" / "exports" / "bb_email_templates"


def main() -> None:
    data = json.loads((EXPORT_DIR / f"bb_email_templates_migration_{STAMP}.json").read_text(encoding="utf-8"))
    templates = sorted(
        data["templates"],
        key=lambda r: (0 if r["migration_priority"] == "MUST" else 1, r["id"]),
    )

    items = []
    for i, row in enumerate(templates, 1):
        html_file = EXPORT_DIR / f"html_{STAMP}" / f"{row['id']}_{slug(row.get('title') or 'untitled')}.html"
        body = html_file.read_text(encoding="utf-8") if html_file.is_file() else ""
        html_rel = f"html_{STAMP}/{html_file.name}"
        items.append(
            f"""
<section class="card" id="t{row['id']}">
  <header>
    <span class="num">{i}/19</span>
    <span class="pri {row['migration_priority'].lower()}">{row['migration_priority']}</span>
    <h2>{html.escape(row['twenty_name'])}</h2>
  </header>
  <dl>
    <dt>BB id</dt><dd>{row['id']}</dd>
    <dt>Subject (Twenty)</dt><dd><code id="subj-{row['id']}">{html.escape(row.get('subject') or '')}</code>
      <button type="button" onclick="copyText('subj-{row['id']}')">Kopiuj</button></dd>
    <dt>Plik HTML</dt><dd><a href="{html_rel}">{html_rel}</a></dd>
  </dl>
  <details>
    <summary>Treść HTML (do wklejenia w edytor Twenty)</summary>
    <textarea readonly id="body-{row['id']}" rows="12">{html.escape(body)}</textarea>
    <button type="button" onclick="copyText('body-{row['id']}')">Kopiuj treść</button>
  </details>
  <label><input type="checkbox" data-id="{row['id']}"> Zaimportowano w Twenty</label>
</section>
"""
        )

    out = EXPORT_DIR / f"twenty_import_assistant_{STAMP}.html"
    out.write_text(
        f"""<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <title>Twenty import — BB szablony {STAMP}</title>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; }}
    .card {{ border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; }}
    .num {{ font-weight: bold; margin-right: .5rem; }}
    .pri {{ font-size: .75rem; padding: .15rem .4rem; border-radius: 4px; }}
    .must {{ background: #ffe0e0; }}
    .nice {{ background: #e8f0ff; }}
    textarea {{ width: 100%; font-family: monospace; font-size: 12px; }}
    code {{ word-break: break-all; }}
    .steps {{ background: #f6f6f6; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; }}
  </style>
</head>
<body>
  <h1>Import szablonów BB → Twenty</h1>
  <div class="steps">
    <p><strong>Twenty:</strong> Settings → Email → Templates → + New Template</p>
    <ol>
      <li>Wklej <strong>Name</strong> z nagłówka karty (np. <code>[BB 38] Sprzedaż — …</code>)</li>
      <li>Wklej <strong>Subject</strong> (przycisk Kopiuj)</li>
      <li>Wklej treść HTML w body (duże szablony: otwórz plik .html obok)</li>
      <li>Zaznacz checkbox po zapisaniu</li>
    </ol>
    <p>Kolejność: MUST (9) → NICE (10). Brak API Twenty — tylko UI.</p>
  </div>
  {''.join(items)}
  <script>
    function copyText(id) {{
      const el = document.getElementById(id);
      const text = el.tagName === 'TEXTAREA' ? el.value : el.textContent;
      navigator.clipboard.writeText(text);
    }}
  </script>
</body>
</html>
""",
        encoding="utf-8",
    )
    print(f"Wrote {out}")


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


if __name__ == "__main__":
    main()
