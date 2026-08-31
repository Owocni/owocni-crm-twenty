#!/usr/bin/env python3
"""Audit scope for BB → IMAP APPEND mail history import.

Counts email_message rows for client addresses tied to open BB leads (same
scope as sync_bb_to_twenty.py). Breaks down Sent vs inbound, body vs archived.

Usage:
  python3 integrations/tools/audit_bb_mail_import_scope.py
  python3 integrations/tools/audit_bb_mail_import_scope.py --days 30 --since 2026-01-01
  python3 integrations/tools/audit_bb_mail_import_scope.py --out exports/bb_sync/audit.json

Requires: better-bitrix-main/.env (Supabase service key) or BB_SUPABASE_* env.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bb_supabase import OWNER_LABEL, bb_get, fetch_bb_leads, load_bb_env  # noqa: E402

OWOCNI_DOMAIN = re.compile(r"@owocni\.pl", re.I)
SALES_INBOXES = [
    "marta@owocni.pl",
    "gosia@owocni.pl",
    "copywriting@owocni.pl",
    "mariusz@owocni.pl",
    "studio@owocni.pl",
    "pomoc@owocni.pl",
]


def normalize_email(raw: str) -> str:
    s = (raw or "").strip().lower()
    m = re.search(r"[\w.+-]+@[\w.-]+\.\w+", s)
    return m.group(0) if m else ""


def has_usable_body(body: str | None) -> bool:
    t = (body or "").strip()
    return bool(t) and t.lower() != "error"


def client_emails_from_leads(leads: list[dict]) -> set[str]:
    out: set[str] = set()
    for lead in leads:
        for e in lead.get("emails") or []:
            em = normalize_email(str(e))
            if em and not OWOCNI_DOMAIN.search(em):
                out.add(em)
    return out


def bb_rpc(name: str, args: dict) -> object:
    import os
    import urllib.parse
    import urllib.request

    base = os.environ.get("BB_SUPABASE_URL", "").rstrip("/")
    from bb_supabase import bb_headers

    url = f"{base}/rest/v1/rpc/{name}"
    req = urllib.request.Request(
        url,
        data=json.dumps(args).encode(),
        headers={**bb_headers(), "Content-Type": "application/json", "Prefer": "return=representation"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as res:
        return json.loads(res.read().decode())


def fetch_messages_for_email(email: str, *, limit: int = 500) -> list[dict]:
    """Paginate email_message via PostgREST — filter by participant overlap."""
    rows: list[dict] = []
    offset = 0
    page = 200
    while len(rows) < limit:
        batch = bb_get(
            "email_message",
            params={
                "select": (
                    "id,message_id,folder_path,is_archived,inbox,sent_date,from,to,body,email_thread"
                ),
                "or": f"(from.ilike.*{email}*,to.cs.{{{email}}})",
                "order": "sent_date.asc",
                "limit": str(page),
                "offset": str(offset),
            },
        )
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page:
            break
        offset += page
    return rows[:limit]


def classify_message(msg: dict, client_emails: set[str]) -> dict:
    from_em = normalize_email(msg.get("from") or "")
    to_list = [normalize_email(str(t)) for t in (msg.get("to") or [])]
    to_list = [t for t in to_list if t]
    is_outbound = bool(from_em and OWOCNI_DOMAIN.search(from_em))
    is_inbound = any(t in client_emails for t in to_list) or (
        from_em in client_emails and not is_outbound
    )
    folder = str(msg.get("folder_path") or "")
    return {
        "id": msg.get("id"),
        "message_id": msg.get("message_id"),
        "folder_path": folder,
        "is_archived": bool(msg.get("is_archived")),
        "has_body": has_usable_body(msg.get("body")),
        "is_sent_folder": folder.lower() == "sent",
        "is_outbound_owocni": is_outbound,
        "is_inbound_client": is_inbound,
        "inbox": msg.get("inbox"),
        "sent_date": msg.get("sent_date"),
        "email_thread": msg.get("email_thread"),
    }


def aggregate(messages: list[dict]) -> dict:
    stats = defaultdict(int)
    thread_ids: set[int] = set()
    for m in messages:
        thread_ids.add(m.get("email_thread") or -1)
        stats["messages_total"] += 1
        if m["has_body"]:
            stats["with_body"] += 1
        else:
            stats["without_body"] += 1
        if m["is_archived"]:
            stats["archived_flag"] += 1
        if m["is_sent_folder"] or m["is_outbound_owocni"]:
            stats["outbound_like"] += 1
            if m["has_body"]:
                stats["outbound_with_body"] += 1
        if m["is_inbound_client"]:
            stats["inbound_like"] += 1
            if m["has_body"]:
                stats["inbound_with_body"] += 1
        if (m["is_sent_folder"] or m["is_outbound_owocni"]) and m["has_body"]:
            stats["bb_only_outbound_candidate"] += 1
    stats["threads_distinct"] = len([t for t in thread_ids if t and t > 0])
    return dict(stats)


def try_rpc_total(emails: list[str]) -> int | None:
    try:
        count = bb_rpc(
            "get_emails_count",
            {"emails": emails, "inboxes": SALES_INBOXES},
        )
        return int(count)
    except Exception as err:
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit BB mail import scope")
    parser.add_argument("--days", type=int, default=30, help="BB leads modified window")
    parser.add_argument("--since", default="", help="Filter messages sent_date >= (ISO date)")
    parser.add_argument(
        "--sample-emails",
        type=int,
        default=0,
        help="Deep-fetch messages for first N client emails (slow; 0=RPC only)",
    )
    parser.add_argument("--out", default="", help="Write JSON report path")
    args = parser.parse_args()

    load_bb_env()
    leads = fetch_bb_leads(days=args.days)
    client_emails = sorted(client_emails_from_leads(leads))

    report: dict = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": {
            "bb_leads_open": len(leads),
            "client_emails_unique": len(client_emails),
            "days_window": args.days,
            "since_filter": args.since or None,
        },
        "estimates_from_cutover_doc": {
            "threads": 5900,
            "messages": 7400,
            "note": "Refined by this audit when RPC/sample completes",
        },
        "sales_inboxes": SALES_INBOXES,
    }

    if client_emails:
        rpc_count = try_rpc_total(client_emails)
        report["rpc_get_emails_count"] = rpc_count

    if args.sample_emails > 0 and client_emails:
        sample = client_emails[: args.sample_emails]
        all_msgs: list[dict] = []
        seen_ids: set[int] = set()
        for em in sample:
            for raw in fetch_messages_for_email(em, limit=300):
                mid = raw.get("id")
                if mid in seen_ids:
                    continue
                seen_ids.add(mid)
                all_msgs.append(classify_message(raw, set(client_emails)))
        if args.since:
            cutoff = args.since
            all_msgs = [m for m in all_msgs if (m.get("sent_date") or "") >= cutoff]
        report["sample"] = {
            "emails_queried": len(sample),
            "stats": aggregate(all_msgs),
            "extrapolate_factor": len(client_emails) / max(len(sample), 1),
        }
        ex = report["sample"]["extrapolate_factor"]
        st = report["sample"]["stats"]
        report["sample"]["extrapolated"] = {
            k: int(round(v * ex)) for k, v in st.items() if k != "threads_distinct"
        }

    out_path = args.out.strip()
    if out_path:
        p = Path(out_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Wrote {p}")
    else:
        print(json.dumps(report, indent=2, ensure_ascii=False))

    print(
        f"\nSummary: {len(leads)} BB leads → {len(client_emails)} client emails",
        file=sys.stderr,
    )
    if report.get("rpc_get_emails_count") is not None:
        print(f"RPC get_emails_count: {report['rpc_get_emails_count']}", file=sys.stderr)


if __name__ == "__main__":
    main()
