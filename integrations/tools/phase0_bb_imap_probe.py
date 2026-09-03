#!/usr/bin/env python3
"""Phase-0 probe: BB Sent (Supabase-only) → IMAP folder that Twenty should NOT sync.

Does NOT enable Twenty folder sync. Rollback = delete the probe folder.

Usage:
  python3 integrations/tools/phase0_bb_imap_probe.py discover
  python3 integrations/tools/phase0_bb_imap_probe.py append --bb-id ID
  python3 integrations/tools/phase0_bb_imap_probe.py verify --bb-id ID
  python3 integrations/tools/phase0_bb_imap_probe.py rollback

Mailbox: mariusz@ (not leads@ / not salesperson INBOX).
Folder: BB Archive Phase0
"""
from __future__ import annotations

import argparse
import email.message
import email.policy
import email.utils
import imaplib
import json
import os
import re
import ssl
import sys
from datetime import datetime, timezone
from email.header import Header
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bb_supabase import bb_get, load_bb_env  # noqa: E402

IMAP_HOST = "d28.thecamels.org"
IMAP_PORT = 993
PROBE_FOLDER = "BB Archive Phase0"
PROBE_MAILBOX = "mariusz@owocni.pl"
SMTP_USER_KEY = "SMTP_USER_MARIUSZ"
SMTP_PASS_KEY = "STMP_PASSWORD_MARIUSZ"
BB_ROOT = Path(__file__).resolve().parents[2].parent / "better-bitrix-main"
OWOCNI = re.compile(r"@owocni\.pl", re.I)
SAFE_INBOXES = (
    "mariusz@owocni.pl",
    "copywriting@owocni.pl",
    "pomoc@owocni.pl",
)


def load_bb_dotenv_passwords() -> None:
    env_path = BB_ROOT / ".env"
    if not env_path.is_file():
        raise SystemExit(f"Missing {env_path}")
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def imap_login(user: str, password: str) -> imaplib.IMAP4_SSL:
    ctx = ssl.create_default_context()
    # Same as BB fetchEmailById (thecamels cert).
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    imap = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT, ssl_context=ctx)
    imap.login(user, password)
    return imap


def imap_creds_for(inbox: str) -> tuple[str, str]:
    load_bb_dotenv_passwords()
    mapping = {
        "mariusz@owocni.pl": ("SMTP_USER_MARIUSZ", "STMP_PASSWORD_MARIUSZ"),
        "copywriting@owocni.pl": ("SMTP_USER_MACIEJ", "STMP_PASSWORD_MACIEJ"),
        "pomoc@owocni.pl": ("SMTP_USER_POMOC", "STMP_PASSWORD_POMOC"),
        "marta@owocni.pl": ("SMTP_USER_MARTA", "STMP_PASSWORD_MARTA"),
        "gosia@owocni.pl": ("SMTP_USER_GOSIA", "STMP_PASSWORD_GOSIA"),
        "studio@owocni.pl": ("SMTP_USER_STUDIO", "STMP_PASSWORD_STUDIO"),
    }
    uk, pk = mapping[inbox.lower()]
    user = os.environ.get(uk, "").strip()
    password = os.environ.get(pk, "").strip()
    if not user or not password:
        raise SystemExit(f"Brak IMAP creds dla {inbox}")
    return user, password


def norm_msgid(raw: str | None) -> str:
    s = (raw or "").strip()
    if not s:
        return ""
    if not s.startswith("<"):
        s = f"<{s}>"
    return s


def has_body(body: str | None) -> bool:
    t = (body or "").strip()
    return bool(t) and t.lower() != "error"


def fetch_sent_candidates(*, inbox: str, limit: int = 15) -> list[dict]:
    load_bb_env()
    rows = bb_get(
        "email_message",
        params={
            "select": (
                "id,message_id,in_reply_to,references,subject,from,to,cc,"
                "sent_date,folder_path,inbox,body,is_archived"
            ),
            "folder_path": "eq.Sent",
            "inbox": f"eq.{inbox}",
            "order": "sent_date.desc",
            "limit": str(limit),
        },
    )
    out = []
    for r in rows:
        if not has_body(r.get("body")):
            continue
        if not r.get("message_id"):
            continue
        tos = [str(t).lower() for t in (r.get("to") or [])]
        if tos and all(OWOCNI.search(t) for t in tos):
            continue
        out.append(r)
    return out


def imap_list_folders(imap: imaplib.IMAP4_SSL) -> list[str]:
    typ, data = imap.list()
    if typ != "OK" or not data:
        return []
    names = []
    for raw in data:
        if not raw:
            continue
        line = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else str(raw)
        # Last quoted token is the folder name.
        m = re.search(r' "([^"]+)"$| ([^\s]+)$', line)
        if m:
            names.append(m.group(1) or m.group(2))
        else:
            names.append(line)
    return names


def imap_search_msgid(imap: imaplib.IMAP4_SSL, folder: str, msgid: str) -> list[bytes]:
    typ, _ = imap.select(f'"{folder}"', readonly=True)
    if typ != "OK":
        return []
    # SEARCH HEADER Message-ID <...>
    typ, data = imap.search(None, "HEADER", "Message-ID", msgid)
    if typ != "OK" or not data or not data[0]:
        return []
    return data[0].split()


def search_msgid_anywhere(imap: imaplib.IMAP4_SSL, folders: list[str], msgid: str) -> list[str]:
    hits = []
    for folder in folders:
        try:
            uids = imap_search_msgid(imap, folder, msgid)
        except imaplib.IMAP4.error:
            continue
        if uids:
            hits.append(folder)
    return hits


def html_to_plain(html: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", html)
    text = re.sub(r"(?s)<br\s*/?>", "\n", text)
    text = re.sub(r"(?s)</p>", "\n\n", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() or "(pusta treść po zdjęciu HTML)"


def build_rfc822(row: dict) -> tuple[bytes, datetime]:
    msgid = norm_msgid(row.get("message_id"))
    in_reply = norm_msgid(row.get("in_reply_to")) if row.get("in_reply_to") else ""
    refs = row.get("references") or []
    if isinstance(refs, str):
        refs = [refs]
    ref_s = " ".join(norm_msgid(r) for r in refs if r)

    sent = row.get("sent_date") or ""
    dt = datetime.now(timezone.utc)
    try:
        dt = datetime.fromisoformat(str(sent).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
    except ValueError:
        pass

    msg = email.message.EmailMessage(policy=email.policy.SMTP)
    msg["From"] = row.get("from") or PROBE_MAILBOX
    tos = row.get("to") or []
    if tos:
        msg["To"] = ", ".join(str(t) for t in tos)
    ccs = row.get("cc") or []
    if ccs:
        msg["Cc"] = ", ".join(str(c) for c in ccs if c)
    msg["Subject"] = str(row.get("subject") or "(bez tematu)")
    msg["Message-ID"] = msgid
    msg["Date"] = email.utils.format_datetime(dt)
    if in_reply:
        msg["In-Reply-To"] = in_reply
    if ref_s:
        msg["References"] = ref_s
    msg["X-Owocni-Phase0"] = "bb-imap-probe-2026-09-03"
    msg["X-Owocni-BB-Id"] = str(row.get("id"))

    body = row.get("body") or ""
    if "<" in body and ">" in body:
        msg.set_content(html_to_plain(body), subtype="plain", charset="utf-8")
        msg.add_alternative(body, subtype="html", charset="utf-8")
    else:
        msg.set_content(body, charset="utf-8")
    return msg.as_bytes(), dt


def cmd_discover(args: argparse.Namespace) -> None:
    load_bb_dotenv_passwords()
    report: dict = {
        "probe_mailbox": PROBE_MAILBOX,
        "probe_folder": PROBE_FOLDER,
        "imap_host": IMAP_HOST,
        "candidates": [],
        "folders": [],
    }
    user, password = imap_creds_for(PROBE_MAILBOX)
    imap = imap_login(user, password)
    try:
        folders = imap_list_folders(imap)
        report["folders"] = folders
        print(f"IMAP {PROBE_MAILBOX}: {len(folders)} folders")
        for name in folders:
            print(f"  - {name}")

        for inbox in SAFE_INBOXES:
            rows = fetch_sent_candidates(inbox=inbox, limit=12)
            print(f"\nBB Sent {inbox}: {len(rows)} with body (non-internal)")
            for r in rows[:5]:
                msgid = norm_msgid(r.get("message_id"))
                hits = search_msgid_anywhere(imap, folders, msgid) if inbox == PROBE_MAILBOX else []
                # Searching mariusz IMAP for copywriting Message-ID is still useful (shouldn't hit).
                if inbox != PROBE_MAILBOX:
                    hits = search_msgid_anywhere(imap, folders, msgid)
                item = {
                    "bb_id": r.get("id"),
                    "inbox": inbox,
                    "sent_date": r.get("sent_date"),
                    "subject": (r.get("subject") or "")[:80],
                    "to": (r.get("to") or [])[:3],
                    "message_id": msgid,
                    "in_reply_to": norm_msgid(r.get("in_reply_to") or "")[:80],
                    "imap_hits_on_mariusz": hits,
                    "body_len": len(r.get("body") or ""),
                }
                report["candidates"].append(item)
                print(
                    f"  bb:{r.get('id')} {r.get('sent_date')} "
                    f"imap_on_mariusz={hits or 'NONE'} "
                    f"subj={(r.get('subject') or '')[:50]!r}"
                )
    finally:
        try:
            imap.logout()
        except Exception:
            pass

    out = Path(args.out) if args.out else Path("/tmp/phase0_bb_imap_discover.json")
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nWrote {out}")


def load_bb_row(bb_id: int) -> dict:
    load_bb_env()
    rows = bb_get(
        "email_message",
        params={
            "select": (
                "id,message_id,in_reply_to,references,subject,from,to,cc,"
                "sent_date,folder_path,inbox,body,is_archived"
            ),
            "id": f"eq.{bb_id}",
            "limit": "1",
        },
    )
    if not rows:
        raise SystemExit(f"Brak email_message id={bb_id}")
    return rows[0]


def ensure_folder(imap: imaplib.IMAP4_SSL, name: str) -> None:
    typ, data = imap.list('""', f'"{name}"')
    exists = bool(data and data[0])
    if exists:
        return
    typ, resp = imap.create(f'"{name}"')
    if typ != "OK":
        raise SystemExit(f"CREATE {name} fail: {typ} {resp}")


def cmd_append(args: argparse.Namespace) -> None:
    row = load_bb_row(args.bb_id)
    inbox = (row.get("inbox") or "").lower()
    if inbox not in SAFE_INBOXES:
        raise SystemExit(f"APPEND tylko z bezpiecznych skrzynek, nie {inbox!r}")
    if inbox != PROBE_MAILBOX:
        raise SystemExit(
            f"Phase0 APPEND tylko na {PROBE_MAILBOX} (wiersz jest z {inbox}). "
            "Wybierz bb_id z inbox=mariusz@."
        )
    if row.get("folder_path") != "Sent":
        raise SystemExit("Nie Sent — odmawiam")
    if not has_body(row.get("body")):
        raise SystemExit("Brak body")

    msgid = norm_msgid(row.get("message_id"))
    user, password = imap_creds_for(PROBE_MAILBOX)
    imap = imap_login(user, password)
    try:
        folders = imap_list_folders(imap)
        hits = search_msgid_anywhere(imap, folders, msgid)
        if hits:
            raise SystemExit(f"Message-ID już na IMAP w {hits} — nie APPEND (duplikat)")
        ensure_folder(imap, PROBE_FOLDER)
        raw, dt = build_rfc822(row)
        internal = imaplib.Time2Internaldate(dt)
        typ, resp = imap.append(f'"{PROBE_FOLDER}"', r"(\Seen)", internal, raw)
        if typ != "OK":
            raise SystemExit(f"APPEND fail: {typ} {resp}")
        print(f"APPEND OK bb:{args.bb_id} → {PROBE_MAILBOX}/{PROBE_FOLDER}")
        print(f"  Message-ID: {msgid}")
        print(f"  Date: {dt.isoformat()}  bytes: {len(raw)}")
        print(f"  Subject: {(row.get('subject') or '')[:80]}")
        hits2 = search_msgid_anywhere(imap, [PROBE_FOLDER], msgid)
        print(f"  IMAP confirm: {hits2 or 'MISSING — FAIL'}")
    finally:
        try:
            imap.logout()
        except Exception:
            pass


def cmd_verify(args: argparse.Namespace) -> None:
    row = load_bb_row(args.bb_id)
    msgid = norm_msgid(row.get("message_id"))
    user, password = imap_creds_for(PROBE_MAILBOX)
    imap = imap_login(user, password)
    try:
        folders = imap_list_folders(imap)
        hits = search_msgid_anywhere(imap, folders, msgid)
        print(json.dumps({
            "bb_id": args.bb_id,
            "message_id": msgid,
            "sent_date": row.get("sent_date"),
            "subject": (row.get("subject") or "")[:80],
            "imap_folders_with_id": hits,
            "probe_folder_present": PROBE_FOLDER in folders or any(
                PROBE_FOLDER.lower() in f.lower() for f in folders
            ),
        }, indent=2, ensure_ascii=False))
    finally:
        try:
            imap.logout()
        except Exception:
            pass


def cmd_rollback(_args: argparse.Namespace) -> None:
    user, password = imap_creds_for(PROBE_MAILBOX)
    imap = imap_login(user, password)
    try:
        folders = imap_list_folders(imap)
        match = [f for f in folders if f == PROBE_FOLDER or f.rstrip("/") == PROBE_FOLDER]
        if not match:
            print(f"Folder {PROBE_FOLDER!r} nie istnieje — nic do cofnięcia")
            return
        # Move messages to Trash then delete folder, or just delete folder.
        typ, resp = imap.select(f'"{PROBE_FOLDER}"')
        if typ != "OK":
            raise SystemExit(f"SELECT fail {resp}")
        typ, data = imap.search(None, "ALL")
        uids = (data[0].split() if data and data[0] else [])
        for uid in uids:
            imap.store(uid, "+FLAGS", r"(\Deleted)")
        if uids:
            imap.expunge()
        imap.close()
        typ, resp = imap.delete(f'"{PROBE_FOLDER}"')
        print(f"Rollback: flagged {len(uids)} msg, DELETE folder → {typ} {resp}")
    finally:
        try:
            imap.logout()
        except Exception:
            pass


def main() -> None:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("discover")
    d.add_argument("--out", default="")
    a = sub.add_parser("append")
    a.add_argument("--bb-id", type=int, required=True)
    v = sub.add_parser("verify")
    v.add_argument("--bb-id", type=int, required=True)
    sub.add_parser("rollback")
    args = p.parse_args()
    if args.cmd == "discover":
        cmd_discover(args)
    elif args.cmd == "append":
        cmd_append(args)
    elif args.cmd == "verify":
        cmd_verify(args)
    elif args.cmd == "rollback":
        cmd_rollback(args)


if __name__ == "__main__":
    main()
