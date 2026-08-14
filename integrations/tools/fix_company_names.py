#!/usr/bin/env python3
"""Faza 3.3 — nazwy firm: URL-like name → legalName (skrócona) lub Capitalized domain label.

Domyślnie dry-run. Tylko firmy z pipedriveId.

Użycie:
  python3 integrations/tools/fix_company_names.py --run 20260804T065324Z
  python3 integrations/tools/fix_company_names.py --run 20260804T065324Z --apply
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pd_company_map import URL_NAME_RE, domain_from_urlish, display_name_from_domain, resolve_run  # noqa: E402
from twenty_rest import http_json, load_env, paginate  # noqa: E402

UA = "owocni-fix-company-names/1.0"

# Brand names that look like domains but should stay
KEEP_AS_IS = frozenset({"oponeo.pl", "allegro.pl", "olx.pl"})

LEGAL_REPLACEMENTS = [
    (re.compile(r"(?i)\bspółka\s+z\s+ograniczoną\s+odpowiedzialnością\b"), "Sp. z o.o."),
    (re.compile(r"(?i)\bspolka\s+z\s+ograniczona\s+odpowiedzialnoscia\b"), "Sp. z o.o."),
    (re.compile(r"(?i)\bsp\.\s*z\s*o\.?\s*o\.?\b"), "Sp. z o.o."),
    (re.compile(r"(?i)\bspółka\s+akcyjna\b"), "S.A."),
    (re.compile(r"(?i)\bspolka\s+akcyjna\b"), "S.A."),
    (re.compile(r"(?i)\bjednoosobowa\s+działalność\s+gospodarcza\b"), "JDG"),
]


def looks_like_url_name(name: str | None) -> bool:
    if not name:
        return False
    s = name.strip()
    if not s:
        return False
    if domain_from_urlish(s):
        return True
    return bool(URL_NAME_RE.match(s))


def shorten_legal(legal: str) -> str:
    out = legal.strip()
    for rx, repl in LEGAL_REPLACEMENTS:
        out = rx.sub(repl, out)
    out = re.sub(r"\s+", " ", out).strip()
    return out[:200]


def propose_name(company: dict) -> tuple[str | None, str]:
    """Return (new_name, reason) or (None, reason) if skip."""
    name = (company.get("name") or "").strip()
    if not looks_like_url_name(name):
        return None, "not_url"
    domain = domain_from_urlish(
        ((company.get("domainName") or {}).get("primaryLinkUrl") or "")
    ) or domain_from_urlish(name)
    if domain and domain.lower() in KEEP_AS_IS:
        return None, "keep_exception"
    legal = (company.get("legalName") or "").strip()
    if legal:
        short = shorten_legal(legal)
        if short and short.lower() != name.lower():
            return short, "legalName"
    if domain:
        label = display_name_from_domain(domain)
        if label and label.lower() != name.lower():
            return label, "domain_label"
    return None, "no_better_name"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="20260804T065324Z")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    load_env()
    run = resolve_run(args.run)
    repair = run / "repair"

    print("fetch PD companies…", flush=True)
    cos = paginate("companies", "companies", "pipedriveId[is]:NOT_NULL", user_agent=UA)
    candidates = []
    for c in cos:
        new_name, reason = propose_name(c)
        if not new_name:
            continue
        candidates.append(
            {
                "id": c["id"],
                "pipedriveId": c.get("pipedriveId"),
                "old_name": c.get("name"),
                "new_name": new_name,
                "reason": reason,
                "legalName": c.get("legalName") or "",
                "domain": ((c.get("domainName") or {}).get("primaryLinkLabel") or ""),
            }
        )
    if args.limit:
        candidates = candidates[: args.limit]
    print(f"candidates={len(candidates)}", flush=True)

    results = []
    for i, row in enumerate(candidates):
        if args.apply:
            st, res = http_json(
                "PATCH",
                f"/companies/{row['id']}",
                {"name": row["new_name"]},
                user_agent=UA,
            )
            row = {**row, "status": st, "ok": st in (200, 201)}
            if st not in (200, 201):
                row["error"] = res.get("error")
            time.sleep(0.4)
            print(
                f"[{i+1}/{len(candidates)}] {row['old_name']!r} → {row['new_name']!r} "
                f"({row['reason']}) st={st}",
                flush=True,
            )
        else:
            print(
                f"WOULD {row['old_name']!r} → {row['new_name']!r} ({row['reason']})",
                flush=True,
            )
        results.append(row)

    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "apply": args.apply,
        "processed": len(results),
        "ok": sum(1 for r in results if r.get("ok")) if args.apply else None,
        "results": results,
    }
    path = repair / ("fix_company_names_apply.json" if args.apply else "fix_company_names_dry.json")
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    csv_path = repair / "fix_company_names_manual_review.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["pipedriveId", "id", "old_name", "new_name", "reason", "legalName", "domain"],
            extrasaction="ignore",
        )
        w.writeheader()
        for r in results:
            if r.get("reason") == "domain_label":
                w.writerow(r)
    print(f"→ {path}")
    print(f"→ {csv_path} (domain_label for manual polish)")


if __name__ == "__main__":
    main()
