#!/usr/bin/env python3
"""Unattended C-Δ same-mailbox loop (one mailbox at a time).

Queue: gosia → marta → mariusz. Never leads@ / studio@. Sitko stays in apply.

Stop:
  touch integrations/runbooks/exports/bb_sync/cdelta_weekend_20260905/STOP

Watch:
  tail -f integrations/runbooks/exports/bb_sync/cdelta_weekend_20260905/weekend_loop.log
"""
from __future__ import annotations

import imaplib
import json
import os
import sys
import time
import traceback
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bb_mail_cdelta_append import (  # noqa: E402
    REPO,
    REST_PACE_SEC,
    load_twenty_env,
    run_apply,
    twenty_get_messages_by_msgid,
)

OUT = (
    REPO
    / "integrations"
    / "runbooks"
    / "exports"
    / "bb_sync"
    / "cdelta_weekend_20260905"
)
STATE_PATH = OUT / "weekend_loop_state.json"
STOP_PATH = OUT / "STOP"
LOG_PATH = OUT / "weekend_loop.log"
FOLDER = "BB Archive"
MAILBOXES = ["gosia@owocni.pl", "marta@owocni.pl", "mariusz@owocni.pl"]
BB_LIMIT = 400
APPEND_LIMIT = 25
SYNC_WAIT_SEC = 10 * 60
RATE_WAIT_SEC = 15 * 60
BASELINE = {"people": 28429, "companies": 1529, "opportunities": 3970}
ALLOWED_OPP_SRC = frozenset({"OWOCNI_SORTOWNIA"})


def log(msg: str) -> None:
    line = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} {msg}"
    OUT.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")
    if sys.stdout.isatty():
        print(line, flush=True)


def save_state(state: dict) -> None:
    STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def load_state() -> dict:
    if STATE_PATH.is_file():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {
        "mailboxes": MAILBOXES,
        "mailbox_index": 0,
        "offset": 735,
        "append_limit": APPEND_LIMIT,
        "baseline": dict(BASELINE),
        "totals": {"appended": 14, "pakas": 0, "qa_pass": 13, "qa_fail": 0},
        "pending_qa": [
            {
                "bb_id": 2052535,
                "own": "<e6a13e39-7f26-f948-7821-2833ae5c552c@owocni.pl>",
                "parent_thread": "6082140d-7d09-43d4-998a-49e4fa7b5ccb",
                "sent_date": "2026-06-29T08:14:30.183+00:00",
                "subject": "Re: Nowa strona firmowa - konsultacja ze specjalistą",
            }
        ],
        "stop_reason": None,
        "finished": False,
    }


def want_stop() -> str | None:
    if STOP_PATH.is_file():
        return f"STOP file {STOP_PATH}"
    return None


def rest_headers() -> dict[str, str]:
    load_twenty_env()
    key = os.environ.get("TWENTY_API_KEY", "").strip()
    return {
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "User-Agent": "owocni-cdelta/1.0",
    }


def rest_get(path_q: str) -> dict:
    base = os.environ.get("TWENTY_REST_URL", "https://api.twenty.com/rest").rstrip("/")
    last_err: Exception | None = None
    for attempt in range(8):
        req = urllib.request.Request(f"{base}/{path_q}", headers=rest_headers())
        try:
            with urllib.request.urlopen(req, timeout=90) as res:
                data = json.loads(res.read().decode())
            time.sleep(REST_PACE_SEC)
            return data
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code == 429:
                log(f"sitko REST 429 — sleep {RATE_WAIT_SEC}s")
                time.sleep(RATE_WAIT_SEC)
                continue
            raise
        except (TimeoutError, urllib.error.URLError, OSError) as e:
            last_err = e
            wait = min(90.0, 8.0 * (2**attempt))
            log(f"sitko REST timeout ({type(e).__name__}) — sleep {wait:.0f}s")
            time.sleep(wait)
    raise SystemExit(f"Twenty REST failed: {last_err}")


def rest_collection_count(name: str) -> int:
    return int(rest_get(f"{name}?limit=1")["totalCount"])


def rest_created_since(collection: str, since_iso: str) -> list[dict]:
    filt = f'createdAt[gte]:"{since_iso}"'
    q = urllib.parse.urlencode(
        {"filter": filt, "limit": "50", "orderBy": "createdAt[DescNullsLast]"}
    )
    data = rest_get(f"{collection}?{q}")
    rows = (data.get("data") or {}).get(collection)
    if rows is None:
        rows = data.get(collection) or data.get("data") or []
    if isinstance(rows, dict):
        rows = [e.get("node", e) for e in (rows.get("edges") or [])]
    return list(rows)


def person_emails(person: dict) -> set[str]:
    em = person.get("emails") or {}
    out: list[str] = []
    if isinstance(em, dict):
        out.append(str(em.get("primaryEmail") or ""))
        out.extend(str(x) for x in (em.get("additionalEmails") or []))
    return {x.strip().lower() for x in out if x and x.strip()}


def crm_counts() -> dict[str, int]:
    return {
        "people": rest_collection_count("people"),
        "companies": rest_collection_count("companies"),
        "opportunities": rest_collection_count("opportunities"),
    }


def sitko_counts(state: dict) -> str | None:
    now = crm_counts()
    state["last_counts"] = now
    base = state["baseline"]
    bumps = [k for k in ("people", "companies", "opportunities") if now[k] > base[k]]
    log(f"counts people={now['people']} companies={now['companies']} opp={now['opportunities']}")
    if not bumps:
        state["sitko_since"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        return None

    since = state.get("sitko_since") or datetime.now(timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%S.000Z"
    )
    opps = rest_created_since("opportunities", since)
    people = rest_created_since("people", since)
    companies = rest_created_since("companies", since)
    log(
        f"sitko delta {','.join(f'{k} {base[k]}→{now[k]}' for k in bumps)} "
        f"new opp={len(opps)} people={len(people)} companies={len(companies)}"
    )

    bad: list[str] = []
    sortownia_emails: set[str] = set()
    sortownia_company_ids: set[str] = set()
    sortownia_n = 0
    for opp in opps:
        src = opp.get("srcSystem") or ""
        name = (opp.get("name") or "")[:60]
        if src in ALLOWED_OPP_SRC:
            sortownia_n += 1
            email = (opp.get("bizCardEmail") or "").strip().lower()
            if email:
                sortownia_emails.add(email)
            cid = opp.get("companyId") or (opp.get("company") or {}).get("id")
            if cid:
                sortownia_company_ids.add(str(cid))
            log(f"sitko allow opp {name!r} src={src}")
        else:
            bad.append(f"opp:{name}:src={src or 'EMPTY'}")

    for person in people:
        emails = person_emails(person)
        label = next(iter(emails), person.get("id", "?"))
        if emails and emails & sortownia_emails:
            log(f"sitko allow person {label}")
            continue
        bad.append(f"person:{label}")

    for company in companies:
        cid = str(company.get("id") or "")
        name = (company.get("name") or cid)[:60]
        if cid and cid in sortownia_company_ids:
            log(f"sitko allow company {name!r}")
            continue
        if sortownia_n and not bad:
            log(f"sitko allow company (Sortownia window) {name!r}")
            continue
        bad.append(f"company:{name}")

    if not opps and not people and not companies:
        return "new_cards_unexplained:" + ",".join(
            f"{k} {base[k]}→{now[k]}" for k in bumps
        )
    if bad:
        return "new_cards_not_sortownia:" + ",".join(bad)

    state["baseline"] = dict(now)
    state["sitko_since"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    log("sitko: Sortownia only — baseline bumped, import continues")
    return None


def qa_one(rec: dict) -> str:
    own = rec.get("own") or ""
    sent = (rec.get("sent_date") or "")[:10]
    today = datetime.now(timezone.utc).date().isoformat()
    msgs = twenty_get_messages_by_msgid(own)
    if not msgs:
        return "missing"
    m = msgs[0]
    rec_date = (m.get("receivedAt") or "")[:10]
    direction = m.get("direction")
    thread = m.get("messageThreadId")
    parent_thread = rec.get("parent_thread")
    if rec_date == today:
        return "date_today"
    if sent and rec_date != sent:
        return f"date_mismatch:{rec_date}!={sent}"
    if not direction:
        return "direction_warn"
    if direction != "OUTGOING":
        return f"direction:{direction}"
    if parent_thread and thread != parent_thread:
        return "stitch_warn"
    return "pass"


def _qa_record(state: dict, rec: dict, status: str) -> None:
    bb = rec.get("bb_id")
    log(f"QA bb:{bb} {status} {(rec.get('subject') or '')[:50]!r}")
    if status == "pass":
        state["totals"]["qa_pass"] = state["totals"].get("qa_pass", 0) + 1
    elif status == "stitch_warn":
        state["totals"]["stitch_warn"] = state["totals"].get("stitch_warn", 0) + 1
        log(
            f"QA stitch_warn bb:{bb} — mail in Twenty (date/OUT OK), "
            "new thread. continue"
        )
    elif status == "direction_warn":
        state["totals"]["sync_warn"] = state["totals"].get("sync_warn", 0) + 1
        log(f"QA direction_warn bb:{bb} — in Twenty, direction still empty. continue")
    elif status == "missing":
        state["totals"]["sync_warn"] = state["totals"].get("sync_warn", 0) + 1
        log(f"QA sync_warn bb:{bb} — not in Twenty yet, IMAP has it. continue")
    else:
        state["totals"]["qa_fail"] = state["totals"].get("qa_fail", 0) + 1
    save_state(state)


def _sleep_interruptible(seconds: float) -> str | None:
    deadline = time.time() + seconds
    while time.time() < deadline:
        reason = want_stop()
        if reason:
            return reason
        time.sleep(min(30, max(0.0, deadline - time.time())))
    return None


def qa_batch(state: dict, recs: list[dict], *, wait: bool) -> str | None:
    if not recs:
        return None
    if wait:
        log(f"Email Sync wait {SYNC_WAIT_SEC}s for {len(recs)} APPEND")
        reason = _sleep_interruptible(SYNC_WAIT_SEC)
        if reason:
            return reason

    statuses: list[tuple[dict, str]] = [(rec, qa_one(rec)) for rec in recs]
    retryable = {"missing", "direction_warn"}
    pending = [rec for rec, st in statuses if st in retryable]
    if pending:
        log(f"Email Sync extra wait {SYNC_WAIT_SEC}s for {len(pending)} not ready")
        reason = _sleep_interruptible(SYNC_WAIT_SEC)
        if reason:
            return reason
        retried: list[tuple[dict, str]] = []
        for rec, st in statuses:
            if st not in retryable:
                retried.append((rec, st))
                continue
            retried.append((rec, qa_one(rec)))
        statuses = retried

    for rec, status in statuses:
        _qa_record(state, rec, status)
        if status.startswith("date_") or status.startswith("direction:"):
            return f"qa_{status}:bb:{rec.get('bb_id')}"
    return None


def halt(state: dict, reason: str) -> None:
    state["stop_reason"] = reason
    state["finished"] = True
    save_state(state)
    log(f"STOP: {reason}")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    state = load_state()
    save_state(state)
    log(
        f"loop start mailbox={state['mailboxes'][state['mailbox_index']]} "
        f"offset={state['offset']} limit={state.get('append_limit', APPEND_LIMIT)}"
    )
    reason = want_stop()
    if reason:
        halt(state, reason)
        return 1

    pending = list(state.get("pending_qa") or [])
    if pending:
        reason = qa_batch(state, pending, wait=True)
        if reason:
            halt(state, reason)
            return 1
        state["pending_qa"] = []
        save_state(state)
        reason = sitko_counts(state)
        if reason:
            halt(state, reason)
            return 1

    rate_retries = 0
    while True:
        reason = want_stop()
        if reason:
            halt(state, reason)
            return 1
        mailboxes = state["mailboxes"]
        idx = state["mailbox_index"]
        if idx >= len(mailboxes):
            halt(state, "queue_done")
            log("C-Δ same-mailbox queue finished (gosia → marta → mariusz).")
            return 0
        inbox = mailboxes[idx]
        offset = int(state["offset"])
        limit = int(state.get("append_limit", APPEND_LIMIT))
        log(f"paka {inbox} offset={offset} limit={limit}")
        try:
            result = run_apply(
                mailbox=inbox,
                limit=limit,
                bb_limit=BB_LIMIT,
                bb_offset=offset,
                folder=FOLDER,
                manifest_dir=OUT,
            )
        except SystemExit as e:
            msg = str(e)
            if ("429" in msg or "REST failed" in msg) and rate_retries < 5:
                rate_retries += 1
                save_state(state)
                log(f"API {msg} — wait {RATE_WAIT_SEC}s then retry same offset ({rate_retries}/5)")
                time.sleep(RATE_WAIT_SEC)
                continue
            halt(state, f"apply_exit:{msg}")
            return 1
        except (TimeoutError, urllib.error.URLError, OSError, imaplib.IMAP4.abort) as e:
            if rate_retries < 5:
                rate_retries += 1
                save_state(state)
                log(
                    f"transient {type(e).__name__}: {e} — wait 60s then retry same offset ({rate_retries}/5)"
                )
                time.sleep(60)
                continue
            halt(state, f"apply_timeout:{type(e).__name__}")
            log(traceback.format_exc())
            return 1
        except Exception:
            halt(state, "apply_exception")
            log(traceback.format_exc())
            return 1

        rate_retries = 0
        state["append_limit"] = APPEND_LIMIT
        state["last_manifest"] = result.get("manifest")
        state["totals"]["pakas"] = state["totals"].get("pakas", 0) + 1
        n_app = len(result.get("appended") or [])
        state["totals"]["appended"] = state["totals"].get("appended", 0) + n_app
        log(
            f"paka done appended={n_app} rows={result['rows']} scanned={result['scanned']} "
            f"window_done={result['window_done']} skip={result.get('skip_counts')}"
        )
        save_state(state)

        if result.get("append_fail"):
            halt(state, "append_fail")
            return 1

        if n_app:
            reason = qa_batch(state, result["appended"], wait=True)
            if reason:
                halt(state, reason)
                return 1
        reason = sitko_counts(state)
        if reason:
            halt(state, reason)
            return 1

        if result["rows"] == 0:
            log(f"{inbox} exhausted (empty window at offset={offset})")
            state["mailbox_index"] = idx + 1
            state["offset"] = 0
            save_state(state)
            continue

        if result["window_done"]:
            nxt = offset + int(result["rows"])
            log(f"{inbox} next offset {offset} → {nxt}")
            state["offset"] = nxt
            save_state(state)
            continue

        log(f"{inbox} hit limit — same offset {offset} again")
        save_state(state)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        log("interrupted")
        raise SystemExit(130)
