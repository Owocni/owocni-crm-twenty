#!/usr/bin/env python3
"""E12.5 — backfill Message.direction from MCMA (firm rule).

Reguła (§5.2): OUTGOING jeśli JAKAKOLWIEK asocjacja ma OUTGOING; inaczej INCOMING.
Hurtowo: updateMessages(filter:{id:{in:[...]}}, data:{direction:...}) — cap 100.

Usage:
  python3 integrations/tools/backfill_message_direction.py --env sandbox --dry-run
  python3 integrations/tools/backfill_message_direction.py --env sandbox
  python3 integrations/tools/backfill_message_direction.py --env sandbox --oq2-test

ENV: TWENTY_API_KEY; opcjonalnie TWENTY_GRAPHQL_URL (default https://api.twenty.com/graphql).
Env-guard: --env sandbox|prod wymagany; walidowany wobec URL.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
USER_AGENT = "owocni-e12.5-message-direction/1.0"
BATCH = 100
PAGE = 200
# LONG rate limit: 100 req/min (API key) — stay under
SLEEP_BETWEEN_REQ_S = 0.7

ENV_URLS = {
    "sandbox": "https://api.twenty.com/graphql",
    "prod": "https://api.twenty.com/graphql",  # same cloud host; key scopes workspace
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
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            out = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {raw[:800]}") from e
    if out.get("errors"):
        raise RuntimeError(json.dumps(out["errors"], ensure_ascii=False)[:1200])
    return out


def fetch_mcma_message_ids(direction: str) -> set[str]:
    """Paginate MCMA filtered by platform direction → set of messageId."""
    ids: set[str] = set()
    cursor = None
    page = 0
    while True:
        page += 1
        after = f', after: "{cursor}"' if cursor else ""
        q = f"""
        query {{
          messageChannelMessageAssociations(
            first: {PAGE}
            filter: {{ direction: {{ eq: {direction} }} }}
            {after}
          ) {{
            edges {{
              node {{ messageId }}
              cursor
            }}
            pageInfo {{ hasNextPage endCursor }}
          }}
        }}
        """
        # retry once on 429
        for attempt in range(2):
            try:
                data = gql(q)
                break
            except RuntimeError as e:
                if "LIMIT_REACHED" in str(e) or "429" in str(e):
                    print(f"  rate-limit on page {page}, sleep 65s…", flush=True)
                    time.sleep(65)
                    continue
                raise
        else:
            raise RuntimeError(f"rate limit persisted on {direction} page {page}")
        conn = data["data"]["messageChannelMessageAssociations"]
        for e in conn["edges"]:
            mid = e["node"].get("messageId")
            if mid:
                ids.add(mid)
        print(
            f"  MCMA {direction} page {page}: +{len(conn['edges'])} (unique msgs {len(ids)})",
            flush=True,
        )
        if not conn["pageInfo"]["hasNextPage"]:
            break
        cursor = conn["pageInfo"]["endCursor"]
        time.sleep(SLEEP_BETWEEN_REQ_S)
    return ids


def count_messages_without_direction_sample(limit: int = 50) -> int:
    q = """
    query {
      messages(first: %d, filter: { direction: { is: NULL } }) {
        edges { node { id } }
      }
    }
    """ % limit
    try:
        data = gql(q)
        return len(data["data"]["messages"]["edges"])
    except Exception as e:
        print(f"  (sample empty direction query skipped: {e})", flush=True)
        return -1


def update_batch(ids: list[str], direction: str, dry_run: bool) -> int:
    if not ids:
        return 0
    if dry_run:
        return len(ids)
    data = gql(
        """
        mutation($data: MessageUpdateInput!, $filter: MessageFilterInput!) {
          updateMessages(data: $data, filter: $filter) { id direction }
        }
        """,
        {
            "data": {"direction": direction},
            "filter": {"id": {"in": ids}},
        },
    )
    return len(data["data"]["updateMessages"])


def chunks(xs: list[str], n: int):
    for i in range(0, len(xs), n):
        yield xs[i : i + n]


def oq2_test() -> None:
    """1 updateMany on 2 messages — custom field on system object."""
    print("OQ-2: pick 2 messages with known MCMA…")
    data = gql(
        """
        query {
          messageChannelMessageAssociations(first: 20) {
            edges { node { messageId direction } }
          }
        }
        """
    )
    pairs = []
    seen = set()
    for e in data["data"]["messageChannelMessageAssociations"]["edges"]:
        n = e["node"]
        mid = n["messageId"]
        if mid in seen:
            continue
        seen.add(mid)
        pairs.append((mid, "OUTGOING" if n["direction"] == "OUTGOING" else "INCOMING"))
        if len(pairs) >= 2:
            break
    if len(pairs) < 2:
        raise RuntimeError("OQ-2: za mało MCMA do testu")
    ids = [p[0] for p in pairs]
    # Use firm rule on these two via their directions independently
    for mid, d in pairs:
        n = update_batch([mid], d, dry_run=False)
        print(f"  updated {mid[:8]}… → {d} (n={n})")
        time.sleep(0.3)
    # verify
    data = gql(
        """
        query($ids: [UUID!]!) {
          messages(filter: { id: { in: $ids } }, first: 10) {
            edges { node { id direction } }
          }
        }
        """,
        {"ids": ids},
    )
    for e in data["data"]["messages"]["edges"]:
        print("  VERIFY", e["node"]["id"][:8], e["node"].get("direction"))
    print("OQ-2 PASS")


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", required=True, choices=("sandbox", "prod"))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--oq2-test", action="store_true")
    ap.add_argument("--limit-batches", type=int, default=0, help="0=all; >0 for rate-limit probe")
    args = ap.parse_args()

    expected = ENV_URLS[args.env]
    url = os.environ.get("TWENTY_GRAPHQL_URL", expected)
    if args.env == "sandbox" and "twenty.com" not in url:
        print(f"Env-guard FAIL: --env sandbox ale URL={url}", file=sys.stderr)
        sys.exit(2)
    os.environ["TWENTY_GRAPHQL_URL"] = url
    print(f"ENV={args.env} URL={url} dry_run={args.dry_run}")

    if args.oq2_test:
        oq2_test()
        return

    print("1) Fetch OUTGOING MCMA messageIds…")
    outgoing_set = fetch_mcma_message_ids("OUTGOING")
    print(f"   unique OUTGOING msgs: {len(outgoing_set)}")
    print("2) Fetch INCOMING MCMA messageIds…")
    incoming_raw = fetch_mcma_message_ids("INCOMING")
    print(f"   unique INCOMING msgs (raw): {len(incoming_raw)}")
    conflicts = len(outgoing_set & incoming_raw)
    incoming = sorted(incoming_raw - outgoing_set)
    outgoing = sorted(outgoing_set)
    with_mcma = len(outgoing_set | incoming_raw)
    print(f"3) After firm rule:")
    print(f"   Messages with MCMA: {with_mcma}")
    print(f"   OUTGOING: {len(outgoing)}")
    print(f"   INCOMING: {len(incoming)}")
    print(f"   Conflicts (both dirs): {conflicts}")
    print("   (OQ-8: messages without any MCMA — not in this set; check 🔧 after backfill)")

    if args.dry_run:
        print("DRY-RUN — no writes. Sample OUTGOING:", outgoing[:3])
        print("DRY-RUN — sample INCOMING:", incoming[:3])
        empty_sample = count_messages_without_direction_sample()
        print(f"   Sample messages with empty direction (up to 50): {empty_sample}")
        return

    written = 0
    errors = 0
    batch_i = 0

    def run_side(ids: list[str], direction: str) -> None:
        nonlocal written, errors, batch_i
        for batch in chunks(ids, BATCH):
            batch_i += 1
            if args.limit_batches and batch_i > args.limit_batches:
                print(f"Stop at --limit-batches={args.limit_batches}")
                return
            try:
                n = update_batch(batch, direction, dry_run=False)
                written += n
                print(
                    f"  batch {batch_i}: {direction} ×{len(batch)} → wrote {n} (cum={written})",
                    flush=True,
                )
            except Exception as e:
                errors += 1
                print(f"  ERROR batch {batch_i} {direction}: {e}", flush=True)
                if "429" in str(e) or "LIMIT_REACHED" in str(e):
                    print("  429 — sleep 65s and retry once…", flush=True)
                    time.sleep(65)
                    try:
                        n = update_batch(batch, direction, dry_run=False)
                        written += n
                        errors -= 1
                        print(f"  retry OK wrote {n}", flush=True)
                    except Exception as e2:
                        print(f"  retry FAIL: {e2}", flush=True)
            time.sleep(SLEEP_BETWEEN_REQ_S)

    print("4) Write OUTGOING…")
    run_side(outgoing, "OUTGOING")
    if args.limit_batches and batch_i >= args.limit_batches:
        print(f"DONE partial written={written} errors={errors}")
        return
    print("5) Write INCOMING…")
    run_side(incoming, "INCOMING")
    print(f"DONE written={written} errors={errors} batches={batch_i}")
    print("Weryfikacja: /objects/messages → filtr Kierunek is empty ≈ maile bez MCMA")


if __name__ == "__main__":
    main()
