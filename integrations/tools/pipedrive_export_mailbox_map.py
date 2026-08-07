#!/usr/bin/env python3
"""Krok 12: mapa mail↔deal z Pipedrive (B1) → staging + drafty Note.

Źródło: GET /v1/deals/{id}/mailMessages (działa cross-owner; folder mailbox
tokena bywa pusty — nie polegamy na /mailbox/mailThreads).

Wejście: run eksportu z deals/page_*.json (in_age_window).
Wyjście w tym samym runie:
  mailbox/deal_{id}.json       — surowe wiadomości per deal
  mailbox/map.jsonl            — jedna linia na deal z metadanymi
  mailbox/note_drafts.jsonl    — tekst Note (opcja B) do późniejszego loadu
  mailbox/summary.json

Użycie:
  python3 integrations/tools/pipedrive_export_mailbox_map.py
  python3 integrations/tools/pipedrive_export_mailbox_map.py --run 20260804T065324Z
  python3 integrations/tools/pipedrive_export_mailbox_map.py --max-deals 20  # smoke

Wymaga PIPEDRIVE_API_TOKEN w .env.local.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
RUNS = REPO_ROOT / "integrations" / "pipedrive-staging" / "runs"
USER_AGENT = "owocni-pipedrive-mailbox-map/1.0"
DEFAULT_CUTOFF = "2023-08-04T00:00:00Z"
NOTE_SUBJECT_CAP = 5


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
        raise SystemExit("Brak runów w pipedrive-staging/runs/")
    return runs[0]


def pd_get(path: str, params: dict | None = None) -> dict:
    params = dict(params or {})
    params["api_token"] = token()
    url = f"https://api.pipedrive.com/v1{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": USER_AGENT},
        method="GET",
    )
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=90) as res:
                return json.loads(res.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:300]
            if e.code == 429 and attempt < 5:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"GET {path} HTTP {e.code}: {body}") from e
    raise RuntimeError("retries exhausted")


def load_in_scope_deals(run_dir: Path) -> list[dict]:
    deals: list[dict] = []
    for page in sorted((run_dir / "deals").glob("page_*.json")):
        payload = json.loads(page.read_text(encoding="utf-8"))
        for row in payload.get("data") or []:
            exp = row.get("_export") or {}
            if not exp.get("in_age_window"):
                continue
            deals.append(
                {
                    "id": row.get("id"),
                    "title": row.get("title"),
                    "owner_id": row.get("owner_id"),
                    "add_time": row.get("add_time"),
                    "owner_map": exp.get("owner_map"),
                }
            )
    return deals


def fetch_deal_mails(deal_id: int) -> list[dict]:
    out: list[dict] = []
    start = 0
    limit = 50
    while True:
        raw = pd_get(f"/deals/{deal_id}/mailMessages", {"start": start, "limit": limit})
        rows = raw.get("data") or []
        for item in rows:
            data = item.get("data") if isinstance(item, dict) and "data" in item else item
            if isinstance(data, dict):
                out.append(data)
        more = (raw.get("additional_data") or {}).get("pagination") or {}
        if not more.get("more_items_in_collection"):
            # some responses use different shape
            if len(rows) < limit:
                break
            start += limit
            continue
        start = more.get("next_start", start + limit)
        time.sleep(0.05)
    return out


def in_window(ts: str | None, cutoff: str) -> bool:
    if not ts:
        return False
    return ts[:19] >= cutoff[:19]


def compact_message(m: dict) -> dict:
    def party(lst):
        return [
            {"email": p.get("email_address"), "name": p.get("name")}
            for p in (lst or [])[:5]
        ]

    return {
        "id": m.get("id"),
        "mail_thread_id": m.get("mail_thread_id"),
        "subject": m.get("subject"),
        "snippet": (m.get("snippet") or "")[:240],
        "message_time": m.get("message_time") or m.get("add_time"),
        "sent_flag": m.get("sent_flag"),
        "from": party(m.get("from")),
        "to": party(m.get("to")),
        "user_id": m.get("user_id"),
        "mua_message_id": m.get("mua_message_id"),
        "has_attachments_flag": m.get("has_attachments_flag"),
    }


def build_note(deal: dict, messages: list[dict]) -> str:
    """Krótka Note (opcja B) — bez pełnych treści."""
    threads: dict[int | str, dict] = {}
    for m in messages:
        tid = m.get("mail_thread_id") or m.get("id")
        prev = threads.get(tid)
        mt = m.get("message_time") or ""
        if not prev or mt > (prev.get("message_time") or ""):
            threads[tid] = m
    ordered = sorted(
        threads.values(),
        key=lambda x: x.get("message_time") or "",
        reverse=True,
    )
    lines = [
        "Pipedrive — powiązane maile (metadane migracji)",
        f"Deal PD #{deal['id']}: {deal.get('title') or ''}".strip(),
        f"Liczba wiadomości: {len(messages)} · wątków (unique thread): {len(threads)}",
        "",
    ]
    for m in ordered[:NOTE_SUBJECT_CAP]:
        subj = (m.get("subject") or "(bez tematu)").replace("\n", " ")
        when = (m.get("message_time") or "")[:19].replace("T", " ")
        direction = "→ wysłane" if m.get("sent_flag") else "← odebrane"
        lines.append(f"- {when} {direction}: {subj[:120]}")
    if len(ordered) > NOTE_SUBJECT_CAP:
        lines.append(f"… +{len(ordered) - NOTE_SUBJECT_CAP} starszych wątków")
    lines.append("")
    lines.append("(Treści maili: skrzynka IMAP w Twenty; to tylko mapa z Pipedrive.)")
    return "\n".join(lines)


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", default=None, help="Run id (domyślnie najnowszy)")
    parser.add_argument("--cutoff", default=DEFAULT_CUTOFF)
    parser.add_argument("--max-deals", type=int, default=None)
    parser.add_argument("--sleep", type=float, default=0.08)
    args = parser.parse_args()

    run_dir = RUNS / args.run if args.run else latest_run()
    if not run_dir.is_dir():
        raise SystemExit(f"Brak runu: {run_dir}")
    print(f"Run: {run_dir.name}")
    print(f"Cutoff message_time >= {args.cutoff}")

    deals = load_in_scope_deals(run_dir)
    if args.max_deals:
        deals = deals[: args.max_deals]
    print(f"In-scope deals: {len(deals)}")

    out_dir = run_dir / "mailbox"
    out_dir.mkdir(parents=True, exist_ok=True)
    map_path = out_dir / "map.jsonl"
    notes_path = out_dir / "note_drafts.jsonl"
    # fresh files
    map_path.write_text("", encoding="utf-8")
    notes_path.write_text("", encoding="utf-8")

    deals_with_mail = 0
    messages_total = 0
    messages_in_window = 0
    errors = 0

    for i, deal in enumerate(deals, 1):
        did = deal["id"]
        try:
            raw_mails = fetch_deal_mails(int(did))
        except Exception as e:
            errors += 1
            print(f"  FAIL deal {did}: {e}", file=sys.stderr)
            continue

        compact = [compact_message(m) for m in raw_mails]
        windowed = [m for m in compact if in_window(m.get("message_time"), args.cutoff)]
        # keep raw page for audit
        raw_file = out_dir / f"deal_{did}.json"
        payload = {
            "deal_id": did,
            "title": deal.get("title"),
            "owner_id": deal.get("owner_id"),
            "owner_map": deal.get("owner_map"),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "message_count": len(compact),
            "message_count_in_window": len(windowed),
            "messages": windowed,
        }
        raw = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        raw_file.write_bytes(raw)

        map_row = {
            "deal_id": did,
            "title": deal.get("title"),
            "owner_id": deal.get("owner_id"),
            "message_count": len(windowed),
            "thread_ids": sorted(
                {m.get("mail_thread_id") for m in windowed if m.get("mail_thread_id")}
            ),
            "subjects": [
                {"message_time": m.get("message_time"), "subject": m.get("subject"), "sent_flag": m.get("sent_flag")}
                for m in sorted(windowed, key=lambda x: x.get("message_time") or "", reverse=True)[:NOTE_SUBJECT_CAP]
            ],
            "sha256": hashlib.sha256(raw).hexdigest(),
        }
        with map_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(map_row, ensure_ascii=False) + "\n")

        if windowed:
            deals_with_mail += 1
            note = {
                "deal_id": did,
                "title": deal.get("title"),
                "owner_map": deal.get("owner_map"),
                "body": build_note(deal, windowed),
            }
            with notes_path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(note, ensure_ascii=False) + "\n")

        messages_total += len(compact)
        messages_in_window += len(windowed)

        if i % 50 == 0 or i == len(deals):
            print(
                f"  [{i}/{len(deals)}] with_mail={deals_with_mail} "
                f"msgs_window={messages_in_window} errors={errors}"
            )
        time.sleep(args.sleep)

    summary = {
        "run_id": run_dir.name,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "cutoff": args.cutoff,
        "deals_scanned": len(deals),
        "deals_with_mail_in_window": deals_with_mail,
        "messages_raw_total": messages_total,
        "messages_in_window": messages_in_window,
        "errors": errors,
        "files": {
            "map": "mailbox/map.jsonl",
            "note_drafts": "mailbox/note_drafts.jsonl",
            "per_deal": "mailbox/deal_*.json",
        },
        "token_user_note": (
            "Token PD = użytkownik z /users/me; mapa budowana przez "
            "/deals/{id}/mailMessages (cross-owner), nie przez prywatny folder mailbox."
        ),
    }
    (out_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("\n=== DONE ===")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
