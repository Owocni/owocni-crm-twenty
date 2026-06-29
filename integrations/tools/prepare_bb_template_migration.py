#!/usr/bin/env python3
"""E12.3 FAZA A1.3–A1.4: priorytety migracji + mapowanie kategorii BB→Twenty."""
from __future__ import annotations

import csv
import json
from datetime import date
from pathlib import Path

EXPORT_DIR = Path(__file__).resolve().parents[1] / "runbooks" / "exports" / "bb_email_templates"
STAMP = "2026-06-16"

BB_TO_TWENTY_CATEGORY = {
    "sales": "Sprzedaż",
    "contact": "Kontakt",
    "reminder": "Przypominajka",
    "customer_service": "Obsługa",
    "helpdesk": "Helpdesk",
    "texts": "Teksty",
    "project_start": "Uruchomienie projektu",
    "website": "Strona",
    "packaging": "Opakowania",
    "name": "Nazwa",
    "logo": "Logo",
    "invoice": "Faktura",
    "packages": "Pakiety",
}

# Heurystyka A1.3 (do weryfikacji ze sprzedażą); wszystkie idą do Twenty.
PRIORITY_RULES: list[tuple[str, str]] = [
    ("sales", "MUST"),
    ("website", "MUST"),
    ("helpdesk", "MUST"),
    ("invoice", "MUST"),
    ("logo", "NICE"),
    ("name", "NICE"),
    ("", "NICE"),  # brak kategorii — typowe oferty produktowe
]


def twenty_name(row: dict) -> str:
    cats = row.get("category_labels") or []
    prefix = BB_TO_TWENTY_CATEGORY.get(cats[0], "Ogólne") if cats else "Ogólne"
    title = (row.get("title") or "Bez tytułu").strip()
    return f"[BB {row['id']}] {prefix} — {title}"


def priority(row: dict) -> str:
    cats = set(row.get("category_labels") or [])
    for tag, pri in PRIORITY_RULES:
        if tag in cats or (tag == "" and not cats):
            return pri
    return "NICE"


def main() -> None:
    src = EXPORT_DIR / f"bb_email_templates_{STAMP}.json"
    data = json.loads(src.read_text(encoding="utf-8"))
    rows = data["templates"]

    enriched = []
    for row in rows:
        pri = priority(row)
        enriched.append(
            {
                **row,
                "migration_priority": pri,
                "twenty_name": twenty_name(row),
                "twenty_category": (
                    BB_TO_TWENTY_CATEGORY.get((row.get("category_labels") or [""])[0], "Ogólne")
                    if row.get("category_labels")
                    else "Ogólne"
                ),
            }
        )

    out_json = EXPORT_DIR / f"bb_email_templates_migration_{STAMP}.json"
    out_csv = EXPORT_DIR / f"bb_email_templates_migration_{STAMP}.csv"
    out_md = EXPORT_DIR / f"bb_email_templates_migration_{STAMP}.md"

    out_json.write_text(
        json.dumps(
            {
                "prepared_at": date.today().isoformat(),
                "note": "A1.3 priorytety heurystyczne — weryfikacja sprzedaż opcjonalna; migracja = wszystkie 19",
                "bb_to_twenty_category": BB_TO_TWENTY_CATEGORY,
                "templates": enriched,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    with out_csv.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "id",
                "title",
                "twenty_name",
                "subject",
                "category",
                "twenty_category",
                "migration_priority",
                "export_scope",
                "html_file",
            ],
        )
        w.writeheader()
        for row in enriched:
            html = f"html_{STAMP}/{row['id']}_{slug(row.get('title') or 'untitled')}.html"
            w.writerow(
                {
                    "id": row["id"],
                    "title": row.get("title") or "",
                    "twenty_name": row["twenty_name"],
                    "subject": row.get("subject") or "",
                    "category": "|".join(row.get("category_labels") or []),
                    "twenty_category": row["twenty_category"],
                    "migration_priority": row["migration_priority"],
                    "export_scope": row.get("export_scope", ""),
                    "html_file": html,
                }
            )

    counts: dict[str, int] = {}
    for row in enriched:
        counts[row["migration_priority"]] = counts.get(row["migration_priority"], 0) + 1

    lines = [
        f"# Migracja BB → Twenty — plan {STAMP}",
        "",
        "## A1.4 Mapowanie kategorii",
        "",
        "| BB tag | Etykieta Twenty (w nazwie szablonu) |",
        "|--------|-----------------------------------|",
    ]
    for k, v in sorted(BB_TO_TWENTY_CATEGORY.items()):
        lines.append(f"| `{k}` | {v} |")
    lines.extend(
        [
            "",
            "Konwencja nazwy w Twenty: `[BB {id}] {kategoria} — {tytuł}` (zastępuje folder „Owocni — z BB”).",
            "",
            "## A1.3 Priorytety",
            "",
            f"| MUST | {counts.get('MUST', 0)} |",
            f"| NICE | {counts.get('NICE', 0)} |",
            "",
            "| id | twenty_name | priority | subject |",
            "|----|-------------|----------|---------|",
        ]
    )
    for row in enriched:
        subj = (row.get("subject") or "—").replace("|", "\\|")[:60]
        lines.append(
            f"| {row['id']} | {row['twenty_name'].replace('|', '\\|')} | {row['migration_priority']} | {subj} |"
        )
    out_md.write_text("\n".join(lines), encoding="utf-8")

    print(f"Wrote {out_json.name}, {out_csv.name}, {out_md.name}")
    print("Priorities:", counts)


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
