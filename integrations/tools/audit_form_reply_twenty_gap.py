#!/usr/bin/env python3
"""Sitko: BB Sent reply to @form.owocni.pl vs karty, które już są w Twenty.

Nie tworzy kart. Nie APPEND na leads@. C-Δ: parent IN w Twenty, own msgid brak.

Usage:
  python3 integrations/tools/audit_form_reply_twenty_gap.py
  python3 integrations/tools/audit_form_reply_twenty_gap.py --apply --yes
"""
from __future__ import annotations

import argparse
import imaplib
import json
import os
import re
import sys
import time
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bb_mail_cdelta_append import (  # noqa: E402
    CHIP,
    DEFAULT_FOLDER,
    FORBIDDEN,
    load_twenty_env,
)
from bb_supabase import bb_get, load_bb_env  # noqa: E402
from phase0_bb_imap_probe import (  # noqa: E402
    OWOCNI,
    build_rfc822,
    ensure_folder,
    has_body,
    imap_creds_for,
    imap_login,
    load_bb_row,
    norm_msgid,
)
from twenty_rest import load_env  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
OUT_DIR = REPO / "integrations" / "runbooks" / "exports" / "bb_sync" / "cdelta_form_leads_20260914"
INBOXES = [
    "copywriting@owocni.pl",
    "marta@owocni.pl",
    "gosia@owocni.pl",
    "mariusz@owocni.pl",
]
OPEN_STAGES = frozenset(
    {"NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "CONTRACT_SENT", "PAYING"}
)
EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+\.\w+", re.I)
GQL = "https://api.twenty.com/graphql"
UA = "owocni-form-reply-gap/1.0"


def gql(query: str, variables: dict | None = None) -> dict:
    load_twenty_env()
    key = os.environ.get("TWENTY_API_KEY", "").strip()
    if not key:
        raise SystemExit("Brak TWENTY_API_KEY")
    body: dict = {"query": query}
    if variables:
        body["variables"] = variables
    req = urllib.request.Request(
        GQL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "User-Agent": UA,
        },
        method="POST",
    )
    last_err: Exception | None = None
    for attempt in range(8):
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                out = json.loads(res.read().decode())
            if out.get("errors"):
                text = json.dumps(out["errors"], ensure_ascii=False)
                if "LIMIT_REACHED" in text or "429" in text:
                    time.sleep(65)
                    continue
                raise RuntimeError(text[:1200])
            return out
        except Exception as e:
            last_err = e
            if "429" in str(e) or "LIMIT" in str(e):
                time.sleep(65)
                continue
            wait = min(40.0, 4.0 * (2**attempt))
            time.sleep(wait)
    raise SystemExit(f"GraphQL failed: {last_err}")


def extract_emails(to_field) -> list[str]:
    parts = to_field if isinstance(to_field, list) else ([to_field] if to_field else [])
    out = []
    for p in parts:
        m = EMAIL_RE.search(str(p) or "")
        if m:
            em = m.group(0).lower()
            if not em.endswith("@owocni.pl") and not em.endswith("@form.owocni.pl"):
                out.append(em)
    return out


def paginate_form_parents() -> dict[str, dict]:
    parents: dict[str, dict] = {}
    cursor = None
    page = 0
    while True:
        page += 1
        after = f', after: "{cursor}"' if cursor else ""
        q = f"""
        query {{
          messages(
            first: 200
            filter: {{ headerMessageId: {{ ilike: "%form.owocni.pl%" }} }}
            {after}
          ) {{
            totalCount
            pageInfo {{ hasNextPage endCursor }}
            edges {{
              node {{
                id
                headerMessageId
                messageThreadId
                ourMailboxes
              }}
            }}
          }}
        }}
        """
        conn = gql(q)["data"]["messages"]
        for e in conn["edges"]:
            node = e["node"]
            mid = norm_msgid(node.get("headerMessageId"))
            if mid:
                parents[mid] = node
        print(
            f"  form parents page {page}: {len(parents)}/{conn.get('totalCount')}",
            flush=True,
        )
        if not conn["pageInfo"]["hasNextPage"]:
            break
        cursor = conn["pageInfo"]["endCursor"]
        time.sleep(0.35)
    return parents


def fetch_bb_form_replies() -> list[dict]:
    load_bb_env()
    rows: list[dict] = []
    offset = 0
    page = 200
    while True:
        batch = bb_get(
            "email_message",
            params={
                "select": (
                    "id,inbox,sent_date,subject,from,to,message_id,in_reply_to,"
                    "folder_path,body"
                ),
                "folder_path": "eq.Sent",
                "in_reply_to": "ilike.*form.owocni.pl*",
                "inbox": f"in.({','.join(INBOXES)})",
                "order": "sent_date.desc",
                "limit": str(page),
                "offset": str(offset),
            },
        )
        if not batch:
            break
        rows.extend(batch)
        print(f"  BB Sent form-replies {len(rows)}", flush=True)
        if len(batch) < page:
            break
        offset += page
        if offset > 8000:
            break
    return rows


def messages_exist(msgids: list[str]) -> set[str]:
    found: set[str] = set()
    uniq = [m for m in dict.fromkeys(msgids) if m]
    for i in range(0, len(uniq), 40):
        chunk = uniq[i : i + 40]
        quoted = ", ".join(json.dumps(m) for m in chunk)
        q = f"""
        query {{
          messages(first: 100, filter: {{ headerMessageId: {{ in: [{quoted}] }} }}) {{
            edges {{ node {{ headerMessageId }} }}
          }}
        }}
        """
        edges = gql(q)["data"]["messages"]["edges"]
        for e in edges:
            found.add(norm_msgid(e["node"].get("headerMessageId")))
        print(f"  own msgid lookup {min(i + 40, len(uniq))}/{len(uniq)} hit={len(found)}", flush=True)
        time.sleep(0.3)
    return found


def fetch_twenty_opps() -> list[dict]:
    load_env()
    opps: list[dict] = []
    cursor = None
    page = 0
    while True:
        page += 1
        after = f', after: "{cursor}"' if cursor else ""
        q = f"""
        query {{
          opportunities(first: 100{after}) {{
            totalCount
            pageInfo {{ hasNextPage endCursor }}
            edges {{
              node {{
                id
                name
                stage
                bitrixDealId
                bizCardEmail
                ownerId
                pointOfContact {{ emails {{ primaryEmail }} }}
              }}
            }}
          }}
        }}
        """
        conn = gql(q)["data"]["opportunities"]
        for e in conn["edges"]:
            opps.append(e["node"])
        print(
            f"  Twenty opps page {page}: {len(opps)}/{conn.get('totalCount')}",
            flush=True,
        )
        if not conn["pageInfo"]["hasNextPage"]:
            break
        cursor = conn["pageInfo"]["endCursor"]
        time.sleep(0.3)
    return opps


def index_opps(opps: list[dict]) -> dict[str, list[dict]]:
    by_email: dict[str, list[dict]] = defaultdict(list)
    for o in opps:
        emails = []
        em = (o.get("bizCardEmail") or "").strip().lower()
        if em:
            emails.append(em)
        poc = o.get("pointOfContact") or {}
        pe = ((poc.get("emails") or {}).get("primaryEmail") or "").strip().lower()
        if pe:
            emails.append(pe)
        slim = {
            "id": o.get("id"),
            "name": (o.get("name") or "")[:80],
            "stage": o.get("stage"),
            "bitrixDealId": o.get("bitrixDealId"),
            "ownerId": o.get("ownerId"),
            "bizCardEmail": em,
        }
        for e in dict.fromkeys(emails):
            by_email[e].append(slim)
    return by_email


def pick_opp(cands: list[dict]) -> dict:
    open_c = [c for c in cands if c.get("stage") in OPEN_STAGES]
    pool = open_c or cands
    pool = sorted(pool, key=lambda c: (0 if c.get("bitrixDealId") else 1, c.get("stage") or ""))
    return pool[0]


def audit() -> dict:
    print("1/4 Twenty form parents", flush=True)
    parents = paginate_form_parents()
    print("2/4 BB Sent form-replies", flush=True)
    sent = fetch_bb_form_replies()
    print("3/4 Twenty opportunities", flush=True)
    opps = fetch_twenty_opps()
    by_email = index_opps(opps)

    candidates = []
    skip = Counter()
    for row in sent:
        inbox = (row.get("inbox") or "").lower()
        rec = {
            "bb_id": row.get("id"),
            "inbox": inbox,
            "subject": (row.get("subject") or "")[:80],
            "sent_date": row.get("sent_date"),
            "own": norm_msgid(row.get("message_id")),
            "parent": norm_msgid(row.get("in_reply_to") or ""),
        }
        if inbox in FORBIDDEN:
            skip["skip_forbidden_inbox"] += 1
            continue
        if inbox not in CHIP:
            skip["skip_unknown_inbox"] += 1
            continue
        if not rec["own"] or not has_body(row.get("body")):
            skip["skip_no_body"] += 1
            continue
        tos = [str(t).lower() for t in (row.get("to") or [])]
        if tos and all(OWOCNI.search(t) for t in tos):
            skip["skip_internal"] += 1
            continue
        if rec["parent"] not in parents:
            skip["skip_parent_not_in_twenty"] += 1
            continue
        emails = extract_emails(row.get("to"))
        rec["client_emails"] = emails
        matched = []
        for e in emails:
            matched.extend(by_email.get(e, []))
        if not matched:
            skip["skip_no_twenty_card"] += 1
            continue
        opp = pick_opp(matched)
        rec["opp_id"] = opp["id"]
        rec["opp_name"] = opp["name"]
        rec["opp_stage"] = opp["stage"]
        rec["opp_open"] = opp.get("stage") in OPEN_STAGES
        rec["bitrixDealId"] = opp.get("bitrixDealId")
        rec["parent_mailboxes"] = parents[rec["parent"]].get("ourMailboxes") or []
        rec["parent_thread"] = parents[rec["parent"]].get("messageThreadId")
        rec["chip"] = CHIP[inbox]
        rec["other_channel"] = rec["chip"] not in rec["parent_mailboxes"]
        candidates.append(rec)

    print(f"4/4 own msgid in Twenty ({len(candidates)} matched cards)", flush=True)
    own_found = messages_exist([r["own"] for r in candidates])
    eligible_open = []
    eligible_closed = []
    already = 0
    for rec in candidates:
        if rec["own"] in own_found:
            already += 1
            rec["status"] = "skip_in_twenty"
            continue
        rec["status"] = "eligible"
        if rec["opp_open"]:
            eligible_open.append(rec)
        else:
            eligible_closed.append(rec)

    skip["skip_in_twenty"] = already
    skip["skip_parent_not_in_twenty"] = skip.get("skip_parent_not_in_twenty", 0)
    report = {
        "form_parents_in_twenty": len(parents),
        "bb_form_reply_sent": len(sent),
        "twenty_opportunities": len(opps),
        "matched_existing_card_missing_or_present": len(candidates),
        "already_in_twenty": already,
        "eligible_open": len(eligible_open),
        "eligible_closed": len(eligible_closed),
        "skip": dict(skip),
        "open_by_inbox": dict(Counter(r["inbox"] for r in eligible_open)),
        "open_by_stage": dict(Counter(r["opp_stage"] for r in eligible_open)),
        "open_other_channel": sum(1 for r in eligible_open if r["other_channel"]),
        "closed_by_inbox": dict(Counter(r["inbox"] for r in eligible_closed)),
        "eligible_open_rows": eligible_open,
        "eligible_closed_rows": eligible_closed,
    }
    return report


def apply_rows(rows: list[dict], folder: str = DEFAULT_FOLDER) -> dict:
    by_box: dict[str, list[dict]] = defaultdict(list)
    for rec in rows:
        by_box[rec["inbox"]].append(rec)
    appended: list[dict] = []
    failed: list[dict] = []
    skipped_imap: list[dict] = []
    for inbox in INBOXES:
        group = by_box.get(inbox) or []
        if not group:
            continue
        print(f"APPLY {inbox} n={len(group)}", flush=True)
        user, password = imap_creds_for(inbox)
        imap = imap_login(user, password)
        try:
            ensure_folder(imap, folder)
            for rec in group:
                own = rec["own"]
                typ, _ = imap.select(f'"{folder}"', readonly=True)
                typ, data = imap.search(None, "HEADER", "Message-ID", own)
                if typ == "OK" and data and data[0]:
                    rec["status"] = "skip_on_imap"
                    skipped_imap.append(rec)
                    print(f"  skip_on_imap bb:{rec['bb_id']}", flush=True)
                    continue
                full = load_bb_row(int(rec["bb_id"]))
                raw, dt = build_rfc822(full)
                internal = imaplib.Time2Internaldate(dt)
                try:
                    typ, resp = imap.append(f'"{folder}"', r"(\Seen)", internal, raw)
                except (imaplib.IMAP4.abort, OSError, TimeoutError) as e:
                    print(f"  IMAP reconnect {type(e).__name__}: {e}", flush=True)
                    try:
                        imap.logout()
                    except Exception:
                        pass
                    time.sleep(8)
                    imap = imap_login(user, password)
                    ensure_folder(imap, folder)
                    typ, resp = imap.append(f'"{folder}"', r"(\Seen)", internal, raw)
                if typ != "OK":
                    rec["status"] = f"append_fail:{typ}"
                    rec["imap_resp"] = str(resp)[:200]
                    failed.append(rec)
                    print("  APPEND FAIL", rec["bb_id"], typ, resp, flush=True)
                    continue
                rec["status"] = "appended"
                rec["folder"] = folder
                rec["bytes"] = len(raw)
                rec["other_channel_override"] = True
                appended.append(rec)
                print(
                    f"  APPEND bb:{rec['bb_id']} {rec['opp_stage']} {(rec['subject'] or '')[:50]!r}",
                    flush=True,
                )
                time.sleep(0.4)
        finally:
            try:
                imap.logout()
            except Exception:
                pass
    return {
        "appended": appended,
        "failed": failed,
        "skipped_imap": skipped_imap,
        "counts": {
            "appended": len(appended),
            "failed": len(failed),
            "skipped_imap": len(skipped_imap),
        },
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--apply", action="store_true")
    p.add_argument("--yes", action="store_true")
    p.add_argument("--include-closed", action="store_true")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--from-audit", default="")
    args = p.parse_args()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    if args.from_audit:
        report = json.loads(Path(args.from_audit).read_text(encoding="utf-8"))
        print("loaded audit", args.from_audit)
    else:
        report = audit()
        audit_path = OUT_DIR / f"audit_{stamp}.json"
        audit_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(
            "AUDIT",
            json.dumps(
                {k: v for k, v in report.items() if not k.endswith("_rows")},
                ensure_ascii=False,
                indent=2,
            ),
        )
        print("wrote", audit_path)
    if not args.apply:
        return
    if not args.yes:
        raise SystemExit("Brak --yes")
    rows = list(report["eligible_open_rows"])
    if args.include_closed:
        rows.extend(report["eligible_closed_rows"])
    if args.limit:
        rows = rows[: args.limit]
    result = apply_rows(rows)
    apply_path = OUT_DIR / f"apply_{stamp}.json"
    apply_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("APPLY", json.dumps(result["counts"], ensure_ascii=False))
    print("wrote", apply_path)


if __name__ == "__main__":
    main()
