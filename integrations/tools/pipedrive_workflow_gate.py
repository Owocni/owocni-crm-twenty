#!/usr/bin/env python3
"""Krok 15: inventory + OFF/ON workflowów przed loadem Pipedrive.

Domyślnie: dry-run (wypisuje MUST_OFF).
  --apply-off   → deactivate_workflow_version (MCP/REST nie — tu GraphQL via Twenty MCP nie;
                   używamy REST PATCH status jeśli dostępne, inaczej instrukcja MCP)

Użycie:
  python3 integrations/tools/pipedrive_workflow_gate.py --run 20260804T065324Z
  python3 integrations/tools/pipedrive_workflow_gate.py --apply-off   # TYLKO za GO przed loadem
  python3 integrations/tools/pipedrive_workflow_gate.py --apply-on    # po loadzie

Uwaga: skrypt deaktywuje przez Twenty MCP-compatible REST nie zawsze działa;
preferuj `deactivate_workflow_version` / `activate_workflow_version` w Twenty MCP
z listą z gate/must_off.json.
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
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
RUNS = REPO_ROOT / "integrations" / "pipedrive-staging" / "runs"
USER_AGENT = "owocni-pipedrive-workflow-gate/1.0"

# Manual — zostają ACTIVE (nie odpalają się przy REST create)
KEEP_MANUAL = True

# MCMA / mail — nie potrzebne OFF przy samym loadzie people/companies/opps
OPTIONAL_MAIL = {
    "First Outbound Response v2",
}


def load_env() -> None:
    env_path = REPO_ROOT / ".env.local"
    if not env_path.is_file():
        raise SystemExit(f"Missing {env_path}")
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def rest_base() -> str:
    return os.environ.get("TWENTY_REST_URL", "https://api.twenty.com/rest").rstrip("/")


def headers() -> dict[str, str]:
    key = os.environ.get("TWENTY_API_KEY", "").strip()
    if not key:
        raise SystemExit("Brak TWENTY_API_KEY")
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }


def http_json(method: str, path: str, body: dict | None = None) -> dict | list:
    data = None if body is None else json.dumps(body).encode("utf-8")
    for attempt in range(8):
        req = urllib.request.Request(
            f"{rest_base()}{path}",
            data=data,
            headers=headers(),
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                raw = res.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", errors="replace")[:400]
            if e.code == 429:
                time.sleep(min(60.0, 5.0 * (2**attempt)))
                continue
            raise RuntimeError(f"{method} {path} → HTTP {e.code}: {err}") from e
    raise RuntimeError(f"{method} {path} failed")


def fetch_all(collection: str) -> list[dict]:
    out: list[dict] = []
    cursor: str | None = None
    while True:
        qs: dict[str, str] = {"limit": "60"}
        if cursor:
            qs["starting_after"] = cursor
        page = http_json("GET", f"/{collection}?" + urllib.parse.urlencode(qs))
        assert isinstance(page, dict)
        batch = (page.get("data") or {}).get(collection) or []
        out.extend(batch)
        page_info = page.get("pageInfo") or {}
        if page_info.get("hasNextPage"):
            cursor = page_info.get("endCursor")
        else:
            cursor = None
        if not cursor or len(batch) < 60:
            break
        time.sleep(1.2)
    return out


def resolve_run(run_id: str | None) -> Path:
    if run_id:
        path = RUNS / run_id
        if not path.is_dir():
            raise SystemExit(f"Brak runu {path}")
        return path
    runs = sorted([p for p in RUNS.iterdir() if p.is_dir()], reverse=True)
    if not runs:
        raise SystemExit("Brak runów")
    return runs[0]


def classify(w: dict, active_ver: dict | None) -> dict:
    statuses = w.get("statuses") or []
    st = statuses[0] if statuses else "?"
    ttype = trig = event = fields = None
    version_id = None
    if active_ver:
        version_id = active_ver.get("id")
        t = active_ver.get("trigger") or {}
        ttype = t.get("type")
        trig = t.get("name")
        settings = t.get("settings") or {}
        event = settings.get("eventName") or settings.get("event")
        fields = settings.get("fields")
    name = w.get("name") or ""
    risk = "ok_keep"
    reason = ""
    ev = (event or "").lower()
    if st != "ACTIVE":
        risk = "inactive"
        reason = "not ACTIVE"
    elif name in OPTIONAL_MAIL:
        risk = "optional_mail"
        reason = f"MCMA/mail — opcjonalne OFF przy loadzie CRM ({event})"
    elif ttype == "MANUAL":
        risk = "ok_keep_manual"
        reason = "MANUAL"
    elif any(x in ev for x in ["opportunity.created", "person.created", "company.created"]):
        risk = "MUST_OFF"
        reason = f"create {event}"
    elif "opportunity.updated" in ev or "person.updated" in ev or "company.updated" in ev:
        risk = "MUST_OFF"
        reason = f"update {event} fields={fields}"
    elif ttype == "DATABASE_EVENT":
        risk = "MUST_OFF"
        reason = f"DATABASE_EVENT {event or trig}"
    else:
        risk = "review"
        reason = f"type={ttype} event={event}"
    return {
        "id": w["id"],
        "name": name,
        "status": st,
        "version_id": version_id,
        "trigger_type": ttype,
        "trigger_name": trig,
        "eventName": event,
        "fields": fields,
        "risk": risk,
        "reason": reason,
    }


def gql_deactivate(version_id: str) -> None:
    """Try Metadata GraphQL deactivate — may 403 on API key; then use MCP."""
    gql = os.environ.get("TWENTY_GRAPHQL_URL", "https://api.twenty.com/graphql")
    query = """
      mutation Deactivate($id: UUID!) {
        deactivateWorkflowVersion(workflowVersionId: $id) { id status }
      }
    """
    body = json.dumps({"query": query, "variables": {"id": version_id}}).encode()
    req = urllib.request.Request(
        gql,
        data=body,
        headers=headers(),
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        payload = json.loads(res.read().decode())
    if payload.get("errors"):
        raise RuntimeError(str(payload["errors"])[:400])


def gql_activate(version_id: str) -> None:
    gql = os.environ.get("TWENTY_GRAPHQL_URL", "https://api.twenty.com/graphql")
    query = """
      mutation Activate($id: UUID!) {
        activateWorkflowVersion(workflowVersionId: $id) { id status }
      }
    """
    body = json.dumps({"query": query, "variables": {"id": version_id}}).encode()
    req = urllib.request.Request(
        gql,
        data=body,
        headers=headers(),
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        payload = json.loads(res.read().decode())
    if payload.get("errors"):
        raise RuntimeError(str(payload["errors"])[:400])


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", default=None)
    parser.add_argument("--apply-off", action="store_true")
    parser.add_argument("--apply-on", action="store_true")
    parser.add_argument("--include-mail", action="store_true", help="OFF też First Outbound")
    args = parser.parse_args()
    if args.apply_off and args.apply_on:
        raise SystemExit("Wybierz --apply-off XOR --apply-on")

    run = resolve_run(args.run)
    gate = run / "gate"
    gate.mkdir(parents=True, exist_ok=True)

    print("Fetching workflows…")
    workflows = fetch_all("workflows")
    versions = fetch_all("workflowVersions")
    active_ver = {v["workflowId"]: v for v in versions if v.get("status") == "ACTIVE"}

    rows = [classify(w, active_ver.get(w["id"])) for w in workflows]
    must = [r for r in rows if r["risk"] == "MUST_OFF"]
    if args.include_mail:
        must = must + [r for r in rows if r["risk"] == "optional_mail" and r["status"] == "ACTIVE"]

    # webhooks (array response)
    try:
        wh_raw = http_json("GET", "/webhooks?limit=50")
        webhooks = wh_raw if isinstance(wh_raw, list) else (wh_raw.get("data") or [])
    except Exception as e:  # noqa: BLE001
        webhooks = [{"error": str(e)}]

    wh_safe = []
    for h in webhooks if isinstance(webhooks, list) else []:
        if not isinstance(h, dict):
            continue
        wh_safe.append(
            {
                "id": h.get("id"),
                "targetUrl": h.get("targetUrl"),
                "operations": h.get("operations"),
                "description": h.get("description"),
                # secret redacted
            }
        )

    inventory = {
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "workflows": rows,
        "must_off": [
            {"id": r["id"], "version_id": r["version_id"], "name": r["name"], "reason": r["reason"]}
            for r in must
        ],
        "webhooks": wh_safe,
        "policy": {
            "workflows_off_before_load": True,
            "manual_keep": True,
            "inbound_skip_legacy": "SKIP_LEGACY_IMPORT (deploy twenty-inbound-webhook)",
            "ops_log": "OPS_NOTES §5.3 no_emit=TAK",
        },
    }
    (gate / "workflows_inventory.json").write_text(
        json.dumps(inventory, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (gate / "must_off.json").write_text(
        json.dumps(inventory["must_off"], indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    print(f"\nMUST_OFF ({len(must)}):")
    for r in must:
        print(f"  - {r['name']}")
        print(f"      version={r['version_id']}  {r['reason']}")

    print("\nACTIVE keep:")
    for r in sorted(rows, key=lambda x: x["name"]):
        if r["status"] == "ACTIVE" and r["risk"] != "MUST_OFF":
            if r["risk"] == "optional_mail" and args.include_mail:
                continue
            print(f"  [{r['risk']}] {r['name']}")

    print("\nWebhooks (Stape = no_emit guard via SKIP_LEGACY_IMPORT po deploy):")
    for h in wh_safe:
        print(f"  - {h.get('description')}: {h.get('operations')}")

    if not args.apply_off and not args.apply_on:
        print("\nDry-run only. Artefakty:", gate)
        print("OFF przed loadem: --apply-off  (wymaga GO) albo Twenty MCP deactivate_workflow_version")
        return 0

    targets = inventory["must_off"]
    if args.apply_on:
        # reactivate from snapshot file if present
        snap = gate / "deactivated_snapshot.json"
        if snap.is_file():
            snap_data = json.loads(snap.read_text(encoding="utf-8"))
            if isinstance(snap_data, dict) and "workflows" in snap_data:
                targets = snap_data["workflows"]
            elif isinstance(snap_data, list):
                targets = snap_data
            else:
                raise SystemExit(f"Nieznany format snapshotu: {snap}")
        action = "activate"
        fn = gql_activate
    else:
        action = "deactivate"
        fn = gql_deactivate
        (gate / "deactivated_snapshot.json").write_text(
            json.dumps(
                {
                    "deactivated_at": datetime.now(timezone.utc).isoformat(),
                    "method": "pipedrive_workflow_gate.py --apply-off",
                    "workflows": targets,
                },
                indent=2,
                ensure_ascii=False,
            )
            + "\n",
            encoding="utf-8",
        )

    print(f"\nAPPLY {action} × {len(targets)} …")
    ok = fail = 0
    for t in targets:
        vid = t.get("version_id")
        if not vid:
            print(f"  SKIP (no version_id): {t.get('name')}")
            fail += 1
            continue
        try:
            fn(vid)
            print(f"  OK {action} {t.get('name')}")
            ok += 1
        except Exception as e:  # noqa: BLE001
            print(f"  FAIL {t.get('name')}: {e}", file=sys.stderr)
            print("  → użyj Twenty MCP: deactivate_workflow_version / activate_workflow_version")
            fail += 1
        time.sleep(0.5)

    print(f"\nDONE ok={ok} fail={fail}")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
