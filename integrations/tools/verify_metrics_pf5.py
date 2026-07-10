#!/usr/bin/env python3
"""PF-5: ręczne przeliczenie metryk vs dane REST Twenty (sandbox).

Użycie:
  python3 integrations/tools/verify_metrics_pf5.py
  python3 integrations/tools/verify_metrics_pf5.py --window-days 90

Wymaga TWENTY_API_KEY w .env.local (repo root).
Wynik: stdout z liczbami do porównania z dashboardem Sprzedaż — Zespół (90d).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
USER_AGENT = "owocni-verify-metrics-pf5/1.0"
TERMINAL = {"WON", "LOST"}
LEGACY = "BETTER_BITRIX_LEGACY"


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
        headers={"Authorization": f"Bearer {key}", "User-Agent": USER_AGENT},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        return json.loads(res.read().decode())


def fetch_all_opportunities() -> list[dict]:
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
    return opps


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def avg(values: list[float]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 2)


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser(description="PF-5 metrics verification")
    parser.add_argument("--window-days", type=int, default=90)
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=args.window_days)

    opps = fetch_all_opportunities()
    open_opps = [o for o in opps if o.get("stage") not in TERMINAL]
    closed = [o for o in opps if o.get("stage") in TERMINAL and o.get("stageClosedAt")]
    cohort_closed = [
        o
        for o in closed
        if (dt := parse_dt(o.get("stageClosedAt"))) and dt >= window_start
    ]

    m9 = len(open_opps)
    m7 = len([o for o in open_opps if o.get("qualifiedAt")])
    m6 = len(
        [
            o
            for o in open_opps
            if (dt := parse_dt(o.get("createdAt"))) and dt >= window_start
        ]
    )
    hig = len([o for o in opps if not o.get("bizProduct")])

    won_cohort = [o for o in cohort_closed if o.get("stage") == "WON"]
    m4_wr = (
        round(100 * len(won_cohort) / len(cohort_closed), 2)
        if cohort_closed
        else None
    )

    m1_vals = [
        float(o["daysToClose"])
        for o in won_cohort
        if o.get("daysToClose") is not None and o.get("srcSystem") != LEGACY
    ]
    m2_vals = [
        float(o["hoursToFirstResponse"])
        for o in opps
        if o.get("hoursToFirstResponse") is not None
        and (dt := parse_dt(o.get("createdAt")))
        and dt >= window_start
    ]
    m3_vals = [
        float(o["hoursToQualified"])
        for o in opps
        if o.get("qualifiedAt")
        and o.get("hoursToQualified") is not None
        and o.get("srcSystem") != LEGACY
        and (dt := parse_dt(o.get("qualifiedAt")))
        and dt >= window_start
    ]

    report = {
        "fetched": len(opps),
        "window_days": args.window_days,
        "M9_open_pipeline": m9,
        "M7_sql_pipeline": m7,
        "M6_fresh_open_window": m6,
        "HIG_no_bizProduct": hig,
        "M4_win_rate_pct": m4_wr,
        "M4_denominator": len(cohort_closed),
        "M4_numerator_won": len(won_cohort),
        "M1_avg_days_to_close": avg(m1_vals),
        "M1_n": len(m1_vals),
        "M2_avg_hours_first_response": avg(m2_vals),
        "M2_n": len(m2_vals),
        "M3_avg_hours_to_sql": avg(m3_vals),
        "M3_n": len(m3_vals),
        "sample_won": [
            {
                "id": o.get("id"),
                "name": o.get("name"),
                "daysToClose": o.get("daysToClose"),
                "hoursToFirstResponse": o.get("hoursToFirstResponse"),
                "stageClosedAt": o.get("stageClosedAt"),
            }
            for o in won_cohort[:5]
        ],
    }

    print(json.dumps(report, indent=2, ensure_ascii=False))
    print("\nPorównaj z dashboardem Sprzedaż — Zespół (filtry 90d gdzie dotyczy).")
    if m4_wr is not None and len(cohort_closed) < 5:
        print(
            f"UWAGA: mała próba M4 (n={len(cohort_closed)}) — pełna weryfikacja wymaga więcej deali.",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
