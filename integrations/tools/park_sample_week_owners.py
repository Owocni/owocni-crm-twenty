#!/usr/bin/env python3
"""Park open Opportunities from Marta/Gosia/Maciej onto holding (owocni@gmail.com).

For sample-week testing: clear their „Moje” queues while keeping a restore map.

Usage:
  python3 integrations/tools/park_sample_week_owners.py dry-run
  python3 integrations/tools/park_sample_week_owners.py apply
  python3 integrations/tools/park_sample_week_owners.py restore --run 20260904T062700Z

Only OPEN stages (not WON/LOST). Stamps bizRoutingRule = PARKED-SAMPLE-WEEK:{slug}.
Manifest keeps prior owner + prior bizRoutingRule for restore.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from twenty_rest import http_json, load_env, paginate  # noqa: E402

UA = "owocni-park-sample-week/1.0"
OPEN_STAGES = {
    "NEW",
    "CONTACTED",
    "QUALIFIED",
    "PROPOSAL",
    "CONTRACT_SENT",
    "PAYING",
}
HOLDING_ID = "2d65d0e6-8a7f-4e6b-868f-07a6c4fd1f7d"
OWNERS = {
    "marta": "4704e0c0-8d77-4640-ad1e-1875294294df",
    "gosia": "ccac533d-a34b-4cfc-a036-9e75ee3f8910",
    "maciej": "7fddba1d-e443-47d4-97b7-a3a829efd8c1",
}
ID_TO_SLUG = {v: k for k, v in OWNERS.items()}
EXPORTS = (
    Path(__file__).resolve().parents[1]
    / "runbooks"
    / "exports"
    / "sample_week_park"
)
GQL_BATCH = 40
GQL_SLEEP_S = 0.8
STAMP_PREFIX = "PARKED-SAMPLE-WEEK:"


def run_dir(run_id: str) -> Path:
    d = EXPORTS / run_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def gql(query: str, variables: dict | None = None) -> dict:
    import os

    key = os.environ.get("TWENTY_API_KEY", "").strip()
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
            "User-Agent": UA,
        },
        method="POST",
    )
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                out = json.loads(res.read().decode("utf-8"))
            if out.get("errors"):
                raise RuntimeError(f"GraphQL errors: {out['errors'][:2]!r}")
            return out
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", errors="replace")
            if e.code == 429:
                time.sleep(min(60.0, 5.0 * (2**attempt)))
                continue
            raise RuntimeError(f"GraphQL HTTP {e.code}: {err[:600]}") from e
    raise RuntimeError("GraphQL rate limit")


def update_batch(ids: list[str], data: dict) -> int:
    out = gql(
        """
        mutation($data: OpportunityUpdateInput!, $filter: OpportunityFilterInput!) {
          updateOpportunities(data: $data, filter: $filter) { id }
        }
        """,
        {"data": data, "filter": {"id": {"in": ids}}},
    )
    return len((out.get("data") or {}).get("updateOpportunities") or [])


def chunks(xs: list, n: int):
    for i in range(0, len(xs), n):
        yield xs[i : i + n]


def collect_open() -> list[dict]:
    rows: list[dict] = []
    for slug, oid in OWNERS.items():
        batch = paginate(
            "opportunities",
            "opportunities",
            f"ownerId[eq]:{oid}",
            user_agent=UA,
            pace=0.25,
        )
        for o in batch:
            stage = str(o.get("stage") or "")
            if stage not in OPEN_STAGES:
                continue
            rows.append(
                {
                    "id": o.get("id"),
                    "name": o.get("name"),
                    "stage": stage,
                    "ownerId": oid,
                    "ownerSlug": slug,
                    "priorBizRoutingRule": o.get("bizRoutingRule") or "",
                    "srcSystem": o.get("srcSystem") or "",
                    "idOid": o.get("idOid") or "",
                    "bbRef": (o.get("name") or "") if "bb:" in str(o.get("name") or "").lower() else "",
                    "createdAt": o.get("createdAt") or "",
                }
            )
    return rows


def write_manifest(path: Path, rows: list[dict]) -> None:
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    csv_path = path.with_suffix(".csv")
    fields = [
        "id",
        "name",
        "stage",
        "ownerId",
        "ownerSlug",
        "priorBizRoutingRule",
        "srcSystem",
        "idOid",
        "createdAt",
    ]
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)
    print(f"manifest: {path}")
    print(f"csv:      {csv_path}")


def cmd_dry_run(args: argparse.Namespace) -> None:
    load_env()
    run_id = args.run or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    rows = collect_open()
    by = {}
    for r in rows:
        by[r["ownerSlug"]] = by.get(r["ownerSlug"], 0) + 1
    print("dry-run open to park:", by, "total=", len(rows))
    out = run_dir(run_id) / "park_manifest.json"
    write_manifest(out, rows)
    summary = {
        "run": run_id,
        "holdingOwnerId": HOLDING_ID,
        "counts": by,
        "total": len(rows),
        "mode": "dry-run",
    }
    (run_dir(run_id) / "summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )
    print("run=", run_id)


def cmd_apply(args: argparse.Namespace) -> None:
    load_env()
    run_id = args.run or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    d = run_dir(run_id)
    manifest_path = d / "park_manifest.json"
    if manifest_path.is_file() and not args.refresh:
        rows = json.loads(manifest_path.read_text(encoding="utf-8"))
        print(f"using existing manifest ({len(rows)})")
    else:
        rows = collect_open()
        write_manifest(manifest_path, rows)

    if args.limit:
        rows = rows[: args.limit]
        print(f"limit={args.limit} → {len(rows)}")

    # group by prior owner slug for stamp
    by_slug: dict[str, list[str]] = {}
    for r in rows:
        if not r.get("id"):
            continue
        by_slug.setdefault(r["ownerSlug"], []).append(r["id"])

    applied = 0
    errors: list[dict] = []
    for slug, ids in by_slug.items():
        stamp = f"{STAMP_PREFIX}{slug}"
        print(f"apply {slug}: {len(ids)} → holding + {stamp}")
        for chunk in chunks(ids, GQL_BATCH):
            try:
                n = update_batch(
                    chunk,
                    {
                        "ownerId": HOLDING_ID,
                        "bizRoutingRule": stamp,
                    },
                )
                applied += n
                print(f"  batch {len(chunk)} ok (returned {n})")
            except Exception as exc:  # noqa: BLE001
                print(f"  FAIL batch: {exc}")
                errors.append({"slug": slug, "ids": chunk, "error": str(exc)})
            time.sleep(GQL_SLEEP_S)

    summary = {
        "run": run_id,
        "holdingOwnerId": HOLDING_ID,
        "applied": applied,
        "planned": len(rows),
        "errors": errors,
        "mode": "apply",
        "finishedAt": datetime.now(timezone.utc).isoformat(),
    }
    (d / "apply_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    if errors:
        raise SystemExit(1)


def cmd_restore(args: argparse.Namespace) -> None:
    load_env()
    if not args.run:
        raise SystemExit("--run required")
    path = run_dir(args.run) / "park_manifest.json"
    if not path.is_file():
        raise SystemExit(f"brak manifestu: {path}")
    rows = json.loads(path.read_text(encoding="utf-8"))
    if args.limit:
        rows = rows[: args.limit]

    # restore one-by-one batches grouped by (ownerId, priorRule)
    groups: dict[tuple[str, str], list[str]] = {}
    for r in rows:
        key = (r["ownerId"], r.get("priorBizRoutingRule") or "")
        groups.setdefault(key, []).append(r["id"])

    restored = 0
    errors: list[dict] = []
    for (owner_id, prior_rule), ids in groups.items():
        data: dict = {"ownerId": owner_id}
        # empty string → clear stamp; restore prior if any
        data["bizRoutingRule"] = prior_rule if prior_rule else None
        print(f"restore owner={ID_TO_SLUG.get(owner_id, owner_id)} rule={prior_rule!r} n={len(ids)}")
        for chunk in chunks(ids, GQL_BATCH):
            try:
                # GraphQL may reject null — use "" for clear
                payload = {
                    "ownerId": owner_id,
                    "bizRoutingRule": prior_rule or "",
                }
                n = update_batch(chunk, payload)
                restored += n
                print(f"  batch {len(chunk)} ok (returned {n})")
            except Exception as exc:  # noqa: BLE001
                print(f"  FAIL: {exc}")
                errors.append({"ownerId": owner_id, "ids": chunk, "error": str(exc)})
            time.sleep(GQL_SLEEP_S)

    summary = {
        "run": args.run,
        "restored": restored,
        "planned": len(rows),
        "errors": errors,
        "mode": "restore",
        "finishedAt": datetime.now(timezone.utc).isoformat(),
    }
    (run_dir(args.run) / "restore_summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )
    print(json.dumps(summary, indent=2))
    if errors:
        raise SystemExit(1)


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_dry = sub.add_parser("dry-run")
    p_dry.add_argument("--run", default=None)
    p_dry.set_defaults(func=cmd_dry_run)

    p_apply = sub.add_parser("apply")
    p_apply.add_argument("--run", default=None)
    p_apply.add_argument("--limit", type=int, default=0)
    p_apply.add_argument(
        "--refresh",
        action="store_true",
        help="Przelicz manifest nawet jeśli istnieje",
    )
    p_apply.set_defaults(func=cmd_apply)

    p_rest = sub.add_parser("restore")
    p_rest.add_argument("--run", required=True)
    p_rest.add_argument("--limit", type=int, default=0)
    p_rest.set_defaults(func=cmd_restore)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
