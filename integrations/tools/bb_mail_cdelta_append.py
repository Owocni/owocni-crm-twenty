#!/usr/bin/env python3
"""C-Δ same-mailbox: BB Sent (Supabase-only) → IMAP APPEND → Twenty Email Sync.

Only appends when:
  - body exists, not internal @owocni.pl
  - Message-ID not already on IMAP or in Twenty
  - In-Reply-To parent exists in Twenty AND ourMailboxes contains this mailbox chip
  - mailbox is not leads@ / studio@

Usage:
  python3 integrations/tools/bb_mail_cdelta_append.py discover --mailbox copywriting@owocni.pl
  python3 integrations/tools/bb_mail_cdelta_append.py apply --mailbox copywriting@owocni.pl --limit 10 --yes
"""
from __future__ import annotations

import argparse
import imaplib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bb_supabase import bb_get, load_bb_env  # noqa: E402
from phase0_bb_imap_probe import (  # noqa: E402
    OWOCNI,
    build_rfc822,
    ensure_folder,
    fetch_sent_candidates,
    has_body,
    imap_creds_for,
    imap_list_folders,
    imap_login,
    load_bb_row,
    norm_msgid,
    search_msgid_anywhere,
)

REPO = Path(__file__).resolve().parents[2]
FORBIDDEN = frozenset({"leads@owocni.pl", "studio@owocni.pl", "kontakt@owocni.pl"})
CHIP = {
    "marta@owocni.pl": "MARTA",
    "gosia@owocni.pl": "GOSIA",
    "copywriting@owocni.pl": "COPYWRITING",
    "maciejwysocki@owocni.pl": "MACIEJ",
    "mariusz@owocni.pl": "MARIUSZ",
    "pomoc@owocni.pl": "POMOC",
}
DEFAULT_FOLDER = "BB Archive"
REST_PACE_SEC = 1.5
RATE_SLEEP_SEC = 65.0


def load_twenty_env() -> None:
    for p in (
        REPO / ".env.local",
        REPO / "integrations" / "cloud-functions" / "twenty-crm-worker" / ".env.deploy",
    ):
        if not p.is_file():
            continue
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def twenty_get_messages_by_msgid(msgid: str) -> list[dict]:
    load_twenty_env()
    key = os.environ.get("TWENTY_API_KEY", "").strip()
    base = os.environ.get("TWENTY_REST_URL", "https://api.twenty.com/rest").rstrip("/")
    if not key:
        raise SystemExit("Brak TWENTY_API_KEY")
    filt = f'headerMessageId[eq]:"{msgid}"'
    url = f"{base}/messages?{urllib.parse.urlencode({'filter': filt, 'limit': '5'})}"
    headers = {
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "User-Agent": "owocni-cdelta/1.0",
    }
    last_err: Exception | None = None
    for attempt in range(8):
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=90) as res:
                data = json.loads(res.read().decode())
            time.sleep(REST_PACE_SEC)
            return (data.get("data") or {}).get("messages") or []
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code == 429:
                print(f"Twenty REST 429 — sleep {RATE_SLEEP_SEC}s", flush=True)
                time.sleep(RATE_SLEEP_SEC)
                continue
            raise
        except (TimeoutError, urllib.error.URLError, OSError) as e:
            last_err = e
            wait = min(90.0, 8.0 * (2**attempt))
            print(
                f"Twenty REST timeout ({type(e).__name__}) attempt {attempt + 1}/8 "
                f"— sleep {wait:.0f}s",
                flush=True,
            )
            time.sleep(wait)
            continue
    raise SystemExit(f"Twenty REST failed: {last_err}")


def classify_row(
    row: dict,
    *,
    inbox: str,
    imap,
    folders: list[str],
    allow_other_channel: bool = False,
) -> dict:
    chip = CHIP[inbox]
    own = norm_msgid(row.get("message_id"))
    parent = norm_msgid(row.get("in_reply_to") or "")
    rec = {
        "bb_id": row.get("id"),
        "inbox": inbox,
        "subject": (row.get("subject") or "")[:80],
        "sent_date": row.get("sent_date"),
        "own": own,
        "parent": parent,
        "status": "",
        "parent_thread": None,
        "parent_mailboxes": [],
    }
    if not own or not has_body(row.get("body")):
        rec["status"] = "skip_no_body"
        return rec
    tos = [str(t).lower() for t in (row.get("to") or [])]
    if tos and all(OWOCNI.search(t) for t in tos):
        rec["status"] = "skip_internal"
        return rec
    own_msgs = twenty_get_messages_by_msgid(own)
    if own_msgs:
        rec["status"] = "skip_in_twenty"
        return rec
    if search_msgid_anywhere(imap, folders, own):
        rec["status"] = "skip_on_imap"
        return rec
    if not parent:
        rec["status"] = "skip_no_parent"
        return rec
    parent_msgs = twenty_get_messages_by_msgid(parent)
    if not parent_msgs:
        rec["status"] = "skip_parent_not_in_twenty"
        return rec
    boxes = parent_msgs[0].get("ourMailboxes") or []
    rec["parent_mailboxes"] = boxes
    rec["parent_thread"] = parent_msgs[0].get("messageThreadId")
    if chip not in boxes:
        if allow_other_channel:
            rec["status"] = "eligible"
            rec["other_channel_override"] = True
            return rec
        rec["status"] = "skip_other_channel"
        return rec
    rec["status"] = "eligible"
    return rec


def assert_mailbox(raw: str) -> str:
    inbox = raw.strip().lower()
    if inbox in FORBIDDEN:
        raise SystemExit(f"Zakaz: {inbox}")
    if inbox not in CHIP:
        raise SystemExit(f"Nieobsługiwana skrzynka: {inbox}")
    return inbox


def cmd_discover(args: argparse.Namespace) -> None:
    inbox = assert_mailbox(args.mailbox)
    load_bb_env()
    rows = fetch_sent_candidates(
        inbox=inbox,
        limit=args.bb_limit,
        offset=args.bb_offset,
        since=args.since or None,
    )
    user, password = imap_creds_for(inbox)
    imap = imap_login(user, password)
    classified: list[dict] = []
    try:
        folders = imap_list_folders(imap)
        print(
            f"{inbox}: IMAP folders={len(folders)} BB Sent candidates={len(rows)} "
            f"offset={args.bb_offset}"
        )
        for i, row in enumerate(rows, 1):
            rec = classify_row(
                row,
                inbox=inbox,
                imap=imap,
                folders=folders,
                allow_other_channel=bool(getattr(args, "allow_other_channel", False)),
            )
            classified.append(rec)
            print(f"  {i}/{len(rows)} bb:{rec['bb_id']} {rec['status']} {(rec['subject'] or '')[:50]!r}")
    finally:
        try:
            imap.logout()
        except Exception:
            pass
    counts: dict[str, int] = {}
    for rec in classified:
        counts[rec["status"]] = counts.get(rec["status"], 0) + 1
    report = {
        "mailbox": inbox,
        "chip": CHIP[inbox],
        "counts": counts,
        "eligible": [r for r in classified if r["status"] == "eligible"],
        "all": classified,
    }
    if args.out:
        p = Path(args.out)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Wrote {p}")
    print("counts", json.dumps(counts, ensure_ascii=False))


def run_apply(
    *,
    mailbox: str,
    limit: int,
    bb_limit: int,
    bb_offset: int,
    folder: str,
    manifest_dir: Path,
    since: str | None = None,
    allow_other_channel: bool = False,
) -> dict:
    inbox = assert_mailbox(mailbox)
    folder = folder or DEFAULT_FOLDER
    load_bb_env()
    rows = fetch_sent_candidates(
        inbox=inbox, limit=bb_limit, offset=bb_offset, since=since or None
    )
    print(
        f"{inbox}: BB window offset={bb_offset} fetch={bb_limit} "
        f"rows={len(rows)} target_append={limit}",
        flush=True,
    )
    user, password = imap_creds_for(inbox)
    imap = imap_login(user, password)
    appended: list[dict] = []
    skipped: list[dict] = []
    append_fail = False
    try:
        folders = imap_list_folders(imap)
        ensure_folder(imap, folder)
        folders = imap_list_folders(imap)
        for i, row in enumerate(rows, 1):
            if len(appended) >= limit:
                break
            rec = classify_row(
                row,
                inbox=inbox,
                imap=imap,
                folders=folders,
                allow_other_channel=allow_other_channel,
            )
            if rec["status"] != "eligible":
                skipped.append(rec)
                if i % 25 == 0:
                    print(
                        f"  scanned {i}/{len(rows)} appended={len(appended)} last={rec['status']}",
                        flush=True,
                    )
                continue
            full = load_bb_row(int(row["id"]))
            raw, dt = build_rfc822(full)
            internal = imaplib.Time2Internaldate(dt)
            try:
                typ, resp = imap.append(f'"{folder}"', r"(\Seen)", internal, raw)
            except (imaplib.IMAP4.abort, OSError, TimeoutError) as e:
                print(f"IMAP reconnect after {type(e).__name__}: {e}", flush=True)
                try:
                    imap.logout()
                except Exception:
                    pass
                time.sleep(8)
                imap = imap_login(user, password)
                ensure_folder(imap, folder)
                folders = imap_list_folders(imap)
                typ, resp = imap.append(f'"{folder}"', r"(\Seen)", internal, raw)
            if typ != "OK":
                rec["status"] = f"append_fail:{typ}"
                skipped.append(rec)
                append_fail = True
                print("APPEND FAIL", rec["bb_id"], typ, resp, flush=True)
                break
            rec["status"] = "appended"
            rec["folder"] = folder
            rec["bytes"] = len(raw)
            appended.append(rec)
            print(
                f"APPEND bb:{rec['bb_id']} → {inbox}/{folder} {rec['subject']!r}",
                flush=True,
            )
            time.sleep(0.4)
    finally:
        try:
            imap.logout()
        except Exception:
            pass
    skip_counts: dict[str, int] = {}
    for rec in skipped:
        skip_counts[rec["status"]] = skip_counts.get(rec["status"], 0) + 1
    scanned = len(skipped) + len(appended)
    hit_limit = len(appended) >= limit
    window_done = (not append_fail) and scanned >= len(rows)
    out_dir = Path(manifest_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    path = out_dir / f"apply_{inbox.split('@')[0]}_{stamp}.json"
    result = {
        "mailbox": inbox,
        "folder": folder,
        "bb_offset": bb_offset,
        "bb_limit": bb_limit,
        "rows": len(rows),
        "scanned": scanned,
        "hit_limit": hit_limit,
        "window_done": window_done,
        "append_fail": append_fail,
        "skip_counts": skip_counts,
        "appended": appended,
        "skipped_sample": skipped[-20:],
    }
    path.write_text(
        json.dumps(result, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    result["manifest"] = str(path)
    print(
        f"appended={len(appended)} skipped_seen={len(skipped)} manifest={path}",
        flush=True,
    )
    print(
        "Czekaj 10 min, potem sprawdź 2 Message-ID w Twenty (ten sam wątek co parent).",
        flush=True,
    )
    return result


def cmd_apply(args: argparse.Namespace) -> None:
    if not args.yes:
        raise SystemExit("Brak --yes (dry apply zabroniony — użyj discover)")
    run_apply(
        mailbox=args.mailbox,
        limit=args.limit,
        bb_limit=args.bb_limit,
        bb_offset=args.bb_offset,
        folder=args.folder or DEFAULT_FOLDER,
        manifest_dir=Path(args.manifest_dir),
        since=args.since or None,
        allow_other_channel=bool(args.allow_other_channel),
    )


def main() -> None:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("discover")
    d.add_argument("--mailbox", required=True)
    d.add_argument("--bb-limit", type=int, default=60)
    d.add_argument("--bb-offset", type=int, default=0)
    d.add_argument(
        "--since",
        default="",
        help="ISO sent_date >= (np. 2026-09-06T07:21:00Z)",
    )
    d.add_argument("--out", default="")
    d.add_argument(
        "--allow-other-channel",
        action="store_true",
        help="APPEND gdy parent IN jest w Twenty, nawet na chipie LEADS",
    )
    a = sub.add_parser("apply")
    a.add_argument("--mailbox", required=True)
    a.add_argument("--limit", type=int, default=10)
    a.add_argument("--bb-limit", type=int, default=80)
    a.add_argument("--bb-offset", type=int, default=0)
    a.add_argument(
        "--since",
        default="",
        help="ISO sent_date >= (np. 2026-09-06T07:21:00Z)",
    )
    a.add_argument("--folder", default=DEFAULT_FOLDER)
    a.add_argument("--yes", action="store_true")
    a.add_argument(
        "--allow-other-channel",
        action="store_true",
        help="APPEND gdy parent IN jest w Twenty, nawet na chipie LEADS",
    )
    a.add_argument(
        "--manifest-dir",
        default=str(
            REPO
            / "integrations"
            / "runbooks"
            / "exports"
            / "bb_sync"
            / "cdelta_weekend_20260905"
        ),
    )
    args = p.parse_args()
    if args.cmd == "discover":
        cmd_discover(args)
    else:
        cmd_apply(args)


if __name__ == "__main__":
    main()
