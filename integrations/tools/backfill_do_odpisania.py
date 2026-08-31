#!/usr/bin/env python3
"""Backfill Opportunity.isFollowUp („Do odpisania”).

1) Otwarte NEW → true (czekają na pierwszy ruch).
2) Replay MCMA od CUTOVER_AT: INCOMING → true, OUTGOING → false.
   Inne otwarte (Rozeznanie+ bez maila po cutoverze) → false.

Usage:
  python3 integrations/tools/backfill_do_odpisania.py --dry-run
  python3 integrations/tools/backfill_do_odpisania.py --new-only --apply
  python3 integrations/tools/backfill_do_odpisania.py --apply --limit 5
  python3 integrations/tools/backfill_do_odpisania.py --apply

--new-only: same NEW → true, bez replay maili (istniejące Nowy bez interakcji).
INV-6: PATCH tylko isFollowUp (bez zmiany stage → adapter SKIP_NO_RELEVANT_TRANSITION).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
USER_AGENT = "owocni-backfill-do-odpisania/1.0"
OPEN_STAGES = {"NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "CONTRACT_SENT", "PAYING"}
CLOSED = {"WON", "LOST"}
INTERNAL = "@owocni.pl"
DEFAULT_CUTOVER = "2026-08-31T00:00:00+02:00"
SLEEP_S = 0.25
GQL_BATCH = 100
GQL_SLEEP_S = 0.7


def load_env() -> None:
    for env_path in (
        REPO_ROOT / ".env.local",
        REPO_ROOT
        / "integrations"
        / "cloud-functions"
        / "twenty-crm-worker"
        / ".env.deploy",
    ):
        if not env_path.is_file():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
        return
    raise SystemExit("Brak .env.local ani twenty-crm-worker/.env.deploy")


def cutover_iso() -> str:
    raw = os.environ.get("CUTOVER_AT") or DEFAULT_CUTOVER
    try:
        datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise SystemExit(f"CUTOVER_AT nieparsowalny: {raw}") from exc
    return raw


def rest(method: str, path: str, body: dict | None = None) -> dict:
    key = os.environ.get("TWENTY_API_KEY", "").strip()
    if not key:
        raise SystemExit("Brak TWENTY_API_KEY")
    base = os.environ.get("TWENTY_REST_URL", "https://api.twenty.com/rest").rstrip("/")
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{base}{path}",
        data=data,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            raw = res.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} {path}: {err[:600]}") from e


def gql(query: str, variables: dict | None = None) -> dict:
    key = os.environ.get("TWENTY_API_KEY", "").strip()
    if not key:
        raise SystemExit("Brak TWENTY_API_KEY")
    url = os.environ.get("TWENTY_GRAPHQL_URL", "https://api.twenty.com/graphql").rstrip(
        "/"
    )
    body: dict = {"query": query}
    if variables:
        body["variables"] = variables
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            out = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GraphQL HTTP {e.code}: {err[:600]}") from e
    if out.get("errors"):
        raise RuntimeError(f"GraphQL errors: {out['errors'][:2]!r}")
    return out


def update_follow_up_batch(ids: list[str], flag: bool) -> int:
    data = gql(
        """
        mutation($data: OpportunityUpdateInput!, $filter: OpportunityFilterInput!) {
          updateOpportunities(data: $data, filter: $filter) { id }
        }
        """,
        {"data": {"isFollowUp": flag}, "filter": {"id": {"in": ids}}},
    )
    return len((data.get("data") or {}).get("updateOpportunities") or [])


def chunks(xs: list[str], n: int):
    for i in range(0, len(xs), n):
        yield xs[i : i + n]


def paginate(collection: str, filter_expr: str, limit: int = 60) -> list[dict]:
    rows: list[dict] = []
    cursor = None
    while True:
        qs: dict[str, str] = {"limit": str(limit), "filter": filter_expr}
        if cursor:
            qs["starting_after"] = cursor
        page = rest("GET", f"/{collection}?" + urllib.parse.urlencode(qs))
        batch = (page.get("data") or {}).get(collection) or []
        if not batch:
            break
        rows.extend(batch)
        paging = page.get("pageInfo") or page.get("paging") or {}
        cursor = (
            paging.get("endCursor")
            or paging.get("next_cursor")
            or paging.get("nextCursor")
        )
        if paging.get("hasNextPage") is False or not cursor or len(batch) < limit:
            break
        time.sleep(SLEEP_S)
    return rows


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def list_open_opps() -> list[dict]:
    stages = ",".join(sorted(OPEN_STAGES))
    return paginate("opportunities", f"stage[in]:{stages}")


def list_assocs_since(direction: str, since_iso: str) -> list[dict]:
    return paginate(
        "messageChannelMessageAssociations",
        f"direction[eq]:{direction},createdAt[gte]:{since_iso}",
        60,
    )


def client_person_id(message_id: str, role: str) -> str | None:
    parts = paginate(
        "messageParticipants",
        f"messageId[eq]:{message_id},role[eq]:{role}",
        5,
    )
    for part in parts:
        handle = str(part.get("handle") or "").lower()
        pid = part.get("personId") or (part.get("person") or {}).get("id")
        if not pid or INTERNAL in handle:
            continue
        return str(pid)
    return None


def newest_open_opp(person_id: str, opps_by_person: dict[str, list[dict]]) -> dict | None:
    cands = opps_by_person.get(person_id) or []
    open_cands = [
        o for o in cands if str(o.get("stage") or "").upper() not in CLOSED
    ]
    if not open_cands:
        return None
    open_cands.sort(key=lambda o: o.get("updatedAt") or o.get("createdAt") or "", reverse=True)
    return open_cands[0]


def index_opps_by_person(opps: list[dict]) -> dict[str, list[dict]]:
    by: dict[str, list[dict]] = {}
    for opp in opps:
        pid = str(
            opp.get("pointOfContactId")
            or (opp.get("pointOfContact") or {}).get("id")
            or ""
        )
        if not pid:
            continue
        by.setdefault(pid, []).append(opp)
    return by


def bool_or_none(value: object) -> bool | None:
    if value is True:
        return True
    if value is False:
        return False
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--new-only", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--owner-id", default="")
    args = parser.parse_args()
    load_env()
    cutover = cutover_iso()

    if args.new_only:
        opps = paginate("opportunities", "stage[eq]:NEW")
    else:
        opps = list_open_opps()
    if args.owner_id:
        opps = [
            o
            for o in opps
            if str(o.get("ownerId") or (o.get("owner") or {}).get("id") or "")
            == args.owner_id
        ]

    desired: dict[str, bool] = {}
    reasons: dict[str, str] = {}
    by_id = {str(o["id"]): o for o in opps if o.get("id")}
    incoming: list[dict] = []
    outgoing: list[dict] = []
    replayed = 0

    for opp in opps:
        oid = str(opp["id"])
        if args.new_only or str(opp.get("stage") or "").upper() == "NEW":
            desired[oid] = True
            reasons[oid] = "NEW"
        else:
            desired[oid] = False
            reasons[oid] = "open-not-new"

    if not args.new_only:
        by_person = index_opps_by_person(opps)
        incoming = list_assocs_since("INCOMING", cutover)
        outgoing = list_assocs_since("OUTGOING", cutover)
        events = []
        for assoc in incoming:
            events.append(("INCOMING", assoc))
        for assoc in outgoing:
            events.append(("OUTGOING", assoc))
        events.sort(key=lambda item: item[1].get("createdAt") or "")

        for direction, assoc in events:
            mid = assoc.get("messageId") or (assoc.get("message") or {}).get("id")
            if not mid:
                continue
            role = "FROM" if direction == "INCOMING" else "TO"
            pid = client_person_id(str(mid), role)
            time.sleep(SLEEP_S)
            if not pid:
                continue
            opp = newest_open_opp(pid, by_person)
            if not opp:
                continue
            oid = str(opp["id"])
            desired[oid] = direction == "INCOMING"
            reasons[oid] = f"mail-{direction.lower()}"
            replayed += 1

    plan = []
    for oid, flag in desired.items():
        opp = by_id.get(oid)
        if not opp:
            continue
        current = bool_or_none(opp.get("isFollowUp"))
        if current == flag:
            continue
        plan.append(
            {
                "id": oid,
                "name": opp.get("name"),
                "stage": opp.get("stage"),
                "from": current,
                "to": flag,
                "reason": reasons.get(oid),
            }
        )

    if args.limit:
        plan = plan[: args.limit]

    print(
        json.dumps(
            {
                "cutoverAt": cutover,
                "mode": "new-only" if args.new_only else "open+replay",
                "openScanned": len(opps),
                "mcmaIncoming": len(incoming),
                "mcmaOutgoing": len(outgoing),
                "replayed": replayed,
                "toChange": len(plan),
                "apply": bool(args.apply),
                "sample": plan[:20],
            },
            ensure_ascii=False,
            indent=2,
        )
    )

    if not args.apply:
        print("dry-run — nic nie zapisano. --apply żeby PATCH.", file=sys.stderr)
        return 0

    patched = 0
    errors: list[str] = []
    by_flag: dict[bool, list[str]] = {True: [], False: []}
    for row in plan:
        by_flag[bool(row["to"])].append(row["id"])
    for flag, ids in by_flag.items():
        for batch in chunks(ids, GQL_BATCH):
            try:
                patched += update_follow_up_batch(batch, flag)
                time.sleep(GQL_SLEEP_S)
            except RuntimeError as exc:
                errors.append(f"batch {flag} n={len(batch)}: {exc}")
    print(json.dumps({"patched": patched, "errors": errors[:20]}, ensure_ascii=False))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
