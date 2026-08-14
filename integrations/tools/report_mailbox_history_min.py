#!/usr/bin/env python3
"""Faza 7.1 — raport MIN(receivedAt) historii maili per skrzynka (ourMailboxes).

Użycie:
  python3 integrations/tools/report_mailbox_history_min.py --run 20260804T065324Z
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pd_company_map import resolve_run  # noqa: E402
from twenty_rest import load_env, paginate  # noqa: E402

UA = "owocni-report-mailbox-history/1.0"
MAILBOXES = [
    "MARTA",
    "GOSIA",
    "MARIUSZ",
    "STUDIO",
    "LEADS",
    "COPYWRITING",
    "POMOC",
    "OBSLUGA",
    "ROBERT",
    "EWA",
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="20260804T065324Z")
    args = ap.parse_args()
    load_env()
    run = resolve_run(args.run)
    repair = run / "repair"
    repair.mkdir(parents=True, exist_ok=True)

    print("fetch all messages (receivedAt + ourMailboxes)…", flush=True)
    # Paginate by direction to cover all
    messages = []
    for direction in ("INCOMING", "OUTGOING"):
        batch = paginate(
            "messages",
            "messages",
            f"direction[eq]:{direction}",
            user_agent=UA,
            pace=0.3,
        )
        messages.extend(batch)
        print(f"  {direction}={len(batch)}", flush=True)

    mins: dict[str, str] = {}
    counts: dict[str, int] = {}
    empty_mb = 0
    for m in messages:
        boxes = m.get("ourMailboxes") or []
        received = m.get("receivedAt") or ""
        if not boxes:
            empty_mb += 1
            continue
        if not received:
            continue
        for box in boxes:
            counts[box] = counts.get(box, 0) + 1
            prev = mins.get(box)
            if not prev or received < prev:
                mins[box] = received

    rows = []
    for box in sorted(set(MAILBOXES) | set(mins) | set(counts)):
        rows.append(
            {
                "mailbox": box,
                "min_receivedAt": mins.get(box),
                "message_count": counts.get(box, 0),
            }
        )

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "decision_D3": "MAX_3_YEARS",
        "messages_scanned": len(messages),
        "messages_without_ourMailboxes": empty_mb,
        "per_mailbox": rows,
    }
    path = repair / "mailbox_history_min.json"
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2), flush=True)
    print(f"→ {path}", flush=True)


if __name__ == "__main__":
    main()
