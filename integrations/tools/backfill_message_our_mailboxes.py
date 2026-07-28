#!/usr/bin/env python3
"""E12.5b — backfill Message.ourMailboxes from MessageParticipant handles.

Soft filter (nie ACL): MULTI_SELECT z naszych skrzynek @owocni.pl.
Źródło: uczestnicy żywych Message (nie osierocone MCMA/participants).

Usage:
  python3 integrations/tools/backfill_message_our_mailboxes.py --env sandbox --dry-run
  python3 integrations/tools/backfill_message_our_mailboxes.py --env sandbox
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
USER_AGENT = "owocni-e12.5-our-mailboxes/1.1"
BATCH = 100
PAGE = 200
SLEEP_BETWEEN_REQ_S = 0.7

ENV_URLS = {
    "sandbox": "https://api.twenty.com/graphql",
    "prod": "https://api.twenty.com/graphql",
}

HANDLE_TO_VALUE = {
    "marta@owocni.pl": "MARTA",
    "gosia@owocni.pl": "GOSIA",
    "mariusz@owocni.pl": "MARIUSZ",
    "studio@owocni.pl": "STUDIO",
    "leads@owocni.pl": "LEADS",
    "copywriting@owocni.pl": "COPYWRITING",
    "pomoc@owocni.pl": "POMOC",
    "obsluga@owocni.pl": "OBSLUGA",
}


def load_dotenv() -> None:
    for env_path in (
        REPO_ROOT / ".env.local",
        REPO_ROOT
        / "integrations"
        / "cloud-functions"
        / "twenty-crm-worker"
        / ".env.deploy",
    ):
        if not env_path.exists():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def gql(query: str, variables: dict | None = None) -> dict:
    token = os.environ.get("TWENTY_API_KEY", "").strip()
    if not token:
        print("Błąd: brak TWENTY_API_KEY", file=sys.stderr)
        sys.exit(2)
    url = os.environ.get("TWENTY_GRAPHQL_URL", ENV_URLS["sandbox"]).rstrip("/")
    body: dict = {"query": query}
    if variables:
        body["variables"] = variables
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    last_err: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                out = json.loads(resp.read().decode("utf-8"))
            if out.get("errors"):
                raise RuntimeError(json.dumps(out["errors"], ensure_ascii=False)[:1200])
            return out
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8", errors="replace")
            last_err = RuntimeError(f"HTTP {e.code}: {raw[:800]}")
            if e.code in (429, 502, 503, 504) or "LIMIT_REACHED" in raw:
                wait = 65 if e.code == 429 or "LIMIT" in raw else 15 * (attempt + 1)
                print(f"  retryable HTTP {e.code}, sleep {wait}s…", flush=True)
                time.sleep(wait)
                continue
            raise last_err from e
        except RuntimeError as e:
            last_err = e
            if "LIMIT_REACHED" in str(e) or "429" in str(e):
                print("  rate-limit, sleep 65s…", flush=True)
                time.sleep(65)
                continue
            raise
    raise last_err or RuntimeError("gql failed")


def chunks(xs: list, n: int):
    for i in range(0, len(xs), n):
        yield xs[i : i + n]


def fetch_all_message_ids() -> list[str]:
    ids: list[str] = []
    cursor = None
    page = 0
    while True:
        page += 1
        after = f', after: "{cursor}"' if cursor else ""
        q = f"""
        query {{
          messages(first: {PAGE}{after}) {{
            edges {{ node {{ id }} cursor }}
            pageInfo {{ hasNextPage endCursor }}
          }}
        }}
        """
        data = gql(q)
        conn = data["data"]["messages"]
        for e in conn["edges"]:
            ids.append(e["node"]["id"])
        print(f"  messages page {page}: total ids={len(ids)}", flush=True)
        if not conn["pageInfo"]["hasNextPage"]:
            break
        cursor = conn["pageInfo"]["endCursor"]
        time.sleep(SLEEP_BETWEEN_REQ_S)
    return ids


def mailboxes_for_message_ids(msg_ids: list[str]) -> dict[str, set[str]]:
    """For a batch of living message IDs, collect our mailbox tags from participants."""
    by_msg: dict[str, set[str]] = defaultdict(set)
    cursor = None
    while True:
        after = f', after: "{cursor}"' if cursor else ""
        # Single scan: all @owocni.pl participants in this message batch
        q = f"""
        query {{
          messageParticipants(
            first: {PAGE}
            filter: {{
              and: [
                {{ messageId: {{ in: {json.dumps(msg_ids)} }} }}
                {{ handle: {{ ilike: "%@owocni.pl" }} }}
              ]
            }}
            {after}
          ) {{
            edges {{
              node {{ messageId handle }}
              cursor
            }}
            pageInfo {{ hasNextPage endCursor }}
          }}
        }}
        """
        data = gql(q)
        conn = data["data"]["messageParticipants"]
        for e in conn["edges"]:
            n = e["node"]
            mid = n.get("messageId")
            handle = (n.get("handle") or "").strip().lower()
            val = HANDLE_TO_VALUE.get(handle)
            if mid and val:
                by_msg[mid].add(val)
        if not conn["pageInfo"]["hasNextPage"]:
            break
        cursor = conn["pageInfo"]["endCursor"]
        time.sleep(SLEEP_BETWEEN_REQ_S)
    return by_msg


def update_batch(ids: list[str], values: list[str], dry_run: bool) -> int:
    if not ids:
        return 0
    if dry_run:
        return len(ids)
    data = gql(
        """
        mutation($data: MessageUpdateInput!, $filter: MessageFilterInput!) {
          updateMessages(data: $data, filter: $filter) { id ourMailboxes }
        }
        """,
        {
            "data": {"ourMailboxes": values},
            "filter": {"id": {"in": ids}},
        },
    )
    return len(data["data"]["updateMessages"])


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", required=True, choices=("sandbox", "prod"))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit-batches", type=int, default=0)
    args = ap.parse_args()

    url = os.environ.get("TWENTY_GRAPHQL_URL", ENV_URLS[args.env])
    os.environ["TWENTY_GRAPHQL_URL"] = url
    print(f"ENV={args.env} URL={url} dry_run={args.dry_run}")

    print("1) List living messages…")
    all_ids = fetch_all_message_ids()
    print(f"   living messages: {len(all_ids)}")

    # Aggregate tags for all living messages
    by_msg: dict[str, set[str]] = defaultdict(set)
    print("2) Resolve ourMailboxes per batch of messages…")
    batch_n = 0
    for batch in chunks(all_ids, BATCH):
        batch_n += 1
        part = mailboxes_for_message_ids(batch)
        for mid, vals in part.items():
            by_msg[mid].update(vals)
        if batch_n % 10 == 0 or batch_n == 1:
            print(
                f"  msg-batch {batch_n}: scanned {min(batch_n * BATCH, len(all_ids))}/"
                f"{len(all_ids)}; tagged so far {len(by_msg)}",
                flush=True,
            )
        if args.limit_batches and batch_n >= args.limit_batches and args.dry_run:
            break

    groups: dict[frozenset[str], list[str]] = defaultdict(list)
    for mid, vals in by_msg.items():
        if vals:
            groups[frozenset(vals)].append(mid)
    untagged = len(all_ids) - len(by_msg)
    print(f"3) Tagged: {len(by_msg)}  untagged (no our handle): {untagged}")
    print(f"   Distinct value-sets: {len(groups)}")
    for fs, ids in sorted(groups.items(), key=lambda x: -len(x[1]))[:10]:
        print(f"   {sorted(fs)} → {len(ids)} msgs")

    if args.dry_run:
        print("DRY-RUN — no writes")
        return

    written = 0
    errors = 0
    batch_i = 0
    print("4) Write ourMailboxes…")
    for fs, ids in groups.items():
        values = sorted(fs)
        for batch in chunks(ids, BATCH):
            batch_i += 1
            if args.limit_batches and batch_i > args.limit_batches:
                print(f"Stop at --limit-batches={args.limit_batches}")
                print(f"DONE partial written={written} errors={errors}")
                return
            try:
                n = update_batch(batch, values, dry_run=False)
                written += n
                print(
                    f"  batch {batch_i}: {values} ×{len(batch)} → wrote {n} (cum={written})",
                    flush=True,
                )
            except Exception as e:
                errors += 1
                print(f"  ERROR batch {batch_i}: {e}", flush=True)
                time.sleep(65)
                try:
                    n = update_batch(batch, values, dry_run=False)
                    written += n
                    errors -= 1
                    print(f"  retry OK wrote {n}", flush=True)
                except Exception as e2:
                    print(f"  retry FAIL: {e2}", flush=True)
            time.sleep(SLEEP_BETWEEN_REQ_S)
    print(f"DONE written={written} errors={errors} batches={batch_i}")


if __name__ == "__main__":
    main()
