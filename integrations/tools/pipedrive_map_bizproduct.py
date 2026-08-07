#!/usr/bin/env python3
"""Krok 13: mapa produktów Pipedrive → Twenty bizProduct.

1) Pobiera line-itemy GET /api/v2/deals/products dla deali in_age_window.
2) Mapuje nazwę produktu → WEB|LOGO|NAME|MARKETING|COPYWRITING|OPAKOWANIE|INNE
   według reguł słownikowych (plik JSON + funkcja).
3) Zapisuje w runie stagingu:
   - products/catalog.json
   - products/deal_products.jsonl
   - products/bizproduct_map.jsonl   (deal_id → bizProduct + evidence)
   - products/summary.json
   - products/MAPPING.md            (czytelne reguły)

Użycie:
  python3 integrations/tools/pipedrive_map_bizproduct.py
  python3 integrations/tools/pipedrive_map_bizproduct.py --run 20260804T065324Z
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
RUNS = REPO_ROOT / "integrations" / "pipedrive-staging" / "runs"
USER_AGENT = "owocni-pipedrive-bizproduct/1.0"

# (bizProduct, list of regex / substrings on normalized name) — first match wins
# Kolejność = priorytet (węższe przed szerszymi).
RULES: list[tuple[str, list[str]]] = [
    ("LOGO", [r"\blogo\b", r"rebranding", r"branding"]),
    ("NAME", [r"\bnaming\b", r"\bnazwa\b", r"slogan"]),
    ("COPYWRITING", [r"copywriting", r"\bcopy\b", r"\btekst", r"scenariusz", r"newsletter"]),
    ("OPAKOWANIE", [r"opakowan", r"\bulotk", r"\bfolder\b"]),
    ("WEB", [
        r"\bstron", r"landing", r"webflow", r"framer", r"\bsklep\b",
        r"wordpress", r"makiet", r"one.?pager", r"hosting", r"\bux\b",
        r"indeksowan", r"wizytówk",
    ]),
    ("MARKETING", [
        r"strateg", r"google", r"meta", r"facebook", r"\bfb\b", r"tik.?tok",
        r"linkedin", r"\bseo\b", r"social", r"kampan", r"remarketing",
        r"performance", r"\bads\b", r"marketing", r"\bsm\b", r"organic",
        r"prowadzenie", r"obsługa", r"obsluga", r"dosprzedaż", r"dosprzedaz",
    ]),
]


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


def token() -> str:
    t = os.environ.get("PIPEDRIVE_API_TOKEN", "").strip()
    if not t:
        raise SystemExit("Brak PIPEDRIVE_API_TOKEN")
    return t


def latest_run() -> Path:
    runs = sorted([p for p in RUNS.iterdir() if p.is_dir()], reverse=True)
    if not runs:
        raise SystemExit("Brak runów")
    return runs[0]


def pd_get(path: str, params: dict | None = None) -> dict:
    params = dict(params or {})
    params["api_token"] = token()
    url = f"https://api.pipedrive.com/api/v2{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(
        url, headers={"Accept": "application/json", "User-Agent": USER_AGENT}, method="GET"
    )
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=90) as res:
                return json.loads(res.read().decode())
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:300]
            if e.code == 429 and attempt < 5:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"HTTP {e.code}: {body}") from e
    raise RuntimeError("retries exhausted")


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def map_product_name(name: str) -> tuple[str, str]:
    """Return (bizProduct, matched_rule)."""
    n = norm(name)
    for target, patterns in RULES:
        for pat in patterns:
            if re.search(pat, n, flags=re.IGNORECASE):
                return target, pat
    return "INNE", "fallback"


def pick_deal_bizproduct(items: list[dict]) -> dict:
    """Wybierz jedno bizProduct dla deala z wielu line-itemów."""
    mapped = []
    for it in items:
        bp, rule = map_product_name(it.get("name") or "")
        mapped.append({**it, "bizProduct": bp, "match_rule": rule})
    # prefer non-INNE; among them prefer WEB/MARKETING by amount if present
    non_inne = [m for m in mapped if m["bizProduct"] != "INNE"]
    pool = non_inne or mapped
    def sort_key(m):
        amt = m.get("sum") or m.get("item_price") or 0
        try:
            amt = float(amt)
        except (TypeError, ValueError):
            amt = 0.0
        priority = {"WEB": 0, "MARKETING": 1, "COPYWRITING": 2, "LOGO": 3, "NAME": 4, "OPAKOWANIE": 5, "INNE": 9}
        return (priority.get(m["bizProduct"], 8), -amt)

    best = sorted(pool, key=sort_key)[0]
    return {
        "bizProduct": best["bizProduct"],
        "match_rule": best["match_rule"],
        "source_product_name": best.get("name"),
        "source_product_id": best.get("product_id"),
        "line_items": [
            {"name": m.get("name"), "product_id": m.get("product_id"), "bizProduct": m["bizProduct"]}
            for m in mapped
        ],
        "mapping_status": "mapped_from_products",
    }


def load_in_scope_deal_ids(run_dir: Path) -> list[int]:
    ids: list[int] = []
    for page in sorted((run_dir / "deals").glob("page_*.json")):
        for row in json.loads(page.read_text(encoding="utf-8"))["data"]:
            if (row.get("_export") or {}).get("in_age_window"):
                ids.append(int(row["id"]))
    return ids


def fetch_all_products_catalog() -> list[dict]:
    out: list[dict] = []
    cursor = None
    while True:
        p: dict = {"limit": 100}
        if cursor:
            p["cursor"] = cursor
        raw = pd_get("/products", p)
        rows = raw.get("data") or []
        out.extend(rows)
        cursor = (raw.get("additional_data") or {}).get("next_cursor")
        if not cursor or not rows:
            break
        time.sleep(0.05)
    return out


def fetch_deal_products(deal_ids: list[int]) -> list[dict]:
    out: list[dict] = []
    for i in range(0, len(deal_ids), 100):
        chunk = deal_ids[i : i + 100]
        cursor = None
        while True:
            p: dict = {"deal_ids": ",".join(map(str, chunk)), "limit": 100}
            if cursor:
                p["cursor"] = cursor
            raw = pd_get("/deals/products", p)
            rows = raw.get("data") or []
            out.extend(rows)
            cursor = (raw.get("additional_data") or {}).get("next_cursor")
            if not cursor or not rows:
                break
            time.sleep(0.05)
        if (i // 100) % 5 == 0:
            print(f"  deal_products chunks {i}-{i+len(chunk)} … items so far {len(out)}")
        time.sleep(0.05)
    return out


def write_mapping_md(path: Path) -> None:
    lines = [
        "# Pipedrive product → Twenty `bizProduct`",
        "",
        "Twenty enum: `WEB` · `LOGO` · `NAME` · `MARKETING` · `COPYWRITING` · `OPAKOWANIE` · `INNE`",
        "",
        "## Reguły (pierwszy match wygrywa)",
        "",
    ]
    for target, pats in RULES:
        lines.append(f"### {target}")
        for p in pats:
            lines.append(f"- `{p}`")
        lines.append("")
    lines += [
        "## Brak produktów na dealu",
        "",
        "Jeśli deal nie ma line-itemów → `bizProduct = null` przy imporcie.",
        "Metryka HIG: rekordy `srcSystem=PIPEDRIVE_LEGACY` **wykluczone** (patch `verify_metrics_pf5.py`),",
        "żeby null nie inflował hig.",
        "",
        "## Wiele produktów na dealu",
        "",
        "Wybieramy jeden: preferuj nie-`INNE`, potem WEB/MARKETING…, potem wyższa kwota.",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", default=None)
    args = parser.parse_args()
    run_dir = RUNS / args.run if args.run else latest_run()
    out = run_dir / "products"
    out.mkdir(parents=True, exist_ok=True)

    print(f"Run: {run_dir.name}")
    catalog = fetch_all_products_catalog()
    (out / "catalog.json").write_text(
        json.dumps({"count": len(catalog), "products": catalog}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Catalog products: {len(catalog)}")

    # catalog mapping preview
    cat_map = Counter()
    for p in catalog:
        bp, _ = map_product_name(p.get("name") or "")
        cat_map[bp] += 1
    print("Catalog → bizProduct:", dict(cat_map))

    deal_ids = load_in_scope_deal_ids(run_dir)
    print(f"In-scope deals: {len(deal_ids)}")
    items = fetch_deal_products(deal_ids)
    print(f"Line-items fetched: {len(items)}")

    by_deal: dict[int, list[dict]] = {}
    with (out / "deal_products.jsonl").open("w", encoding="utf-8") as f:
        for it in items:
            f.write(json.dumps(it, ensure_ascii=False) + "\n")
            did = it.get("deal_id")
            if did is not None:
                by_deal.setdefault(int(did), []).append(it)

    status_c = Counter()
    bp_c = Counter()
    with (out / "bizproduct_map.jsonl").open("w", encoding="utf-8") as f:
        for did in deal_ids:
            if did in by_deal:
                row = {"deal_id": did, **pick_deal_bizproduct(by_deal[did])}
            else:
                row = {
                    "deal_id": did,
                    "bizProduct": None,
                    "mapping_status": "no_products",
                    "line_items": [],
                }
            status_c[row["mapping_status"]] += 1
            bp_c[str(row.get("bizProduct"))] += 1
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    write_mapping_md(out / "MAPPING.md")
    summary = {
        "run_id": run_dir.name,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "catalog_count": len(catalog),
        "catalog_bizProduct_dist": dict(cat_map),
        "deals_in_scope": len(deal_ids),
        "deals_with_products": len(by_deal),
        "line_items": len(items),
        "mapping_status": dict(status_c),
        "bizProduct_dist": dict(bp_c),
        "twenty_enum": ["WEB", "LOGO", "NAME", "MARKETING", "COPYWRITING", "OPAKOWANIE", "INNE"],
        "null_policy": "no_products → bizProduct null; HIG excludes PIPEDRIVE_LEGACY",
    }
    (out / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\n=== DONE ===")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
