#!/usr/bin/env python3
"""Backfill CallTranscript.personId („Rozmówca") from participants / lead POC.

Sources (in order):
  A) callTranscriptParticipants — client side (personId set, no workspaceMemberId)
  B) opportunity.pointOfContactId — fallback for older records

Idempotent: skips rows that already have personId.
Conflict (2 different personIds on participants) → SKIP + log.
UNMATCHED without source → leave empty (parking stays correct).

Usage:
  python3 integrations/tools/backfill_call_transcript_rozmowca.py --dry-run
  python3 integrations/tools/backfill_call_transcript_rozmowca.py
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
USER_AGENT = "owocni-backfill-rozmowca/1.0"
PAGE = 50
SLEEP_S = 0.7


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
    url = os.environ.get(
        "TWENTY_GRAPHQL_URL", "https://api.twenty.com/graphql"
    ).rstrip("/")
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
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                out = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8", errors="replace")
            last_err = RuntimeError(f"HTTP {e.code}: {raw[:800]}")
            if e.code == 429 or "LIMIT_REACHED" in raw:
                print(
                    f"  rate-limit HTTP, sleep 65s (attempt {attempt + 1})…",
                    flush=True,
                )
                time.sleep(65)
                continue
            raise last_err from e
        if out.get("errors"):
            err_txt = json.dumps(out["errors"], ensure_ascii=False)
            if "LIMIT_REACHED" in err_txt:
                print(
                    f"  rate-limit GQL, sleep 65s (attempt {attempt + 1})…",
                    flush=True,
                )
                time.sleep(65)
                last_err = RuntimeError(err_txt[:1200])
                continue
            raise RuntimeError(err_txt[:1200])
        return out
    raise last_err or RuntimeError("gql failed after retries")


def fetch_all_transcripts() -> list[dict]:
    rows: list[dict] = []
    cursor = None
    while True:
        after = f', after: "{cursor}"' if cursor else ""
        q = f"""
        query {{
          callTranscripts(first: {PAGE}{after}) {{
            edges {{
              node {{
                id
                name
                matchStatus
                personId
                opportunityId
              }}
              cursor
            }}
            pageInfo {{ hasNextPage endCursor }}
          }}
        }}
        """
        data = gql(q)
        conn = data["data"]["callTranscripts"]
        for edge in conn["edges"]:
            rows.append(edge["node"])
        if not conn["pageInfo"]["hasNextPage"]:
            break
        cursor = conn["pageInfo"]["endCursor"]
        time.sleep(SLEEP_S)
    return rows


def fetch_client_person_ids(transcript_id: str) -> set[str]:
    """Person IDs from client participants (no workspaceMemberId)."""
    q = """
    query Parts($tid: UUID!) {
      callTranscriptParticipants(
        first: 50
        filter: { callTranscriptId: { eq: $tid } }
      ) {
        edges {
          node { personId workspaceMemberId }
        }
      }
    }
    """
    data = gql(q, {"tid": transcript_id})
    ids: set[str] = set()
    for edge in data["data"]["callTranscriptParticipants"]["edges"]:
        node = edge["node"]
        if node.get("workspaceMemberId"):
            continue
        pid = node.get("personId")
        if pid:
            ids.add(pid)
    return ids


def fetch_opp_poc(opportunity_id: str) -> str | None:
    q = """
    query Opp($id: UUID!) {
      opportunity(filter: { id: { eq: $id } }) {
        edges { node { pointOfContactId } }
      }
    }
    """
    data = gql(q, {"id": opportunity_id})
    edges = data["data"]["opportunity"]["edges"]
    if not edges:
        return None
    return edges[0]["node"].get("pointOfContactId")


def patch_person(transcript_id: str, person_id: str) -> None:
    q = """
    mutation Patch($id: UUID!, $personId: UUID) {
      updateCallTranscript(id: $id, data: { personId: $personId }) {
        id
        personId
      }
    }
    """
    gql(q, {"id": transcript_id, "personId": person_id})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    load_dotenv()

    rows = fetch_all_transcripts()
    print(f"transcripts total={len(rows)} dry_run={args.dry_run}")

    already = 0
    patched = 0
    skipped_conflict = 0
    no_source = 0

    for row in rows:
        tid = row["id"]
        if row.get("personId"):
            already += 1
            continue

        source = None
        person_id = None

        try:
            pids = fetch_client_person_ids(tid)
            time.sleep(SLEEP_S)
        except Exception as e:
            print(f"  FAIL participants {tid}: {e}")
            continue

        if len(pids) > 1:
            skipped_conflict += 1
            print(f"  SKIP conflict {tid} persons={sorted(pids)}")
            continue
        if len(pids) == 1:
            person_id = next(iter(pids))
            source = "participant"
        elif row.get("opportunityId"):
            try:
                poc = fetch_opp_poc(row["opportunityId"])
                time.sleep(SLEEP_S)
            except Exception as e:
                print(f"  FAIL opp {tid}: {e}")
                continue
            if poc:
                person_id = poc
                source = "opportunity_poc"

        if not person_id:
            no_source += 1
            print(
                f"  bez_źródła {tid} status={row.get('matchStatus')} "
                f"name={row.get('name')}"
            )
            continue

        print(f"  PATCH {tid} personId={person_id} source={source}")
        if not args.dry_run:
            try:
                patch_person(tid, person_id)
                time.sleep(SLEEP_S)
            except Exception as e:
                print(f"  FAIL patch {tid}: {e}")
                continue
        patched += 1

    print(
        json.dumps(
            {
                "already": already,
                "patched": patched,
                "skipped_conflict": skipped_conflict,
                "bez_źródła": no_source,
                "dry_run": args.dry_run,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
