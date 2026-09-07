#!/usr/bin/env python3
"""RETIRE Twenty MANUAL workflow: Biorę.

2026-09-04 — no longer creates or activates the button.
Running this script deactivates any existing workflow named Biorę.

Usage:
  export TWENTY_API_KEY=...
  python3 integrations/tools/deploy_workflow_lead_ack.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
WORKFLOW_NAME = "Biorę"


def load_dotenv_local() -> None:
    for name in (".env.local", ".env"):
        env_path = REPO_ROOT / name
        if not env_path.is_file():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))

    deploy_env = (
        REPO_ROOT
        / "integrations"
        / "cloud-functions"
        / "twenty-crm-worker"
        / ".env.deploy"
    )
    if deploy_env.is_file():
        for line in deploy_env.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def gql(api_key: str, query: str, variables: dict | None = None) -> dict:
    body: dict = {"query": query}
    if variables:
        body["variables"] = variables
    req = urllib.request.Request(
        "https://api.twenty.com/graphql",
        data=json.dumps(body).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        payload = json.loads(res.read().decode())
    if payload.get("errors"):
        raise RuntimeError(json.dumps(payload["errors"], indent=2))
    return payload


def main() -> int:
    load_dotenv_local()
    api_key = os.environ.get("TWENTY_API_KEY", "").strip()
    if not api_key:
        print("TWENTY_API_KEY required", file=sys.stderr)
        return 1

    data = gql(
        api_key,
        """
        query {
          workflows(filter: { name: { eq: "%s" } }, first: 5) {
            edges {
              node {
                id
                name
                statuses
                lastPublishedVersionId
                versions(first: 5) {
                  edges { node { id status } }
                }
              }
            }
          }
        }
        """
        % WORKFLOW_NAME,
    )
    edges = data.get("data", {}).get("workflows", {}).get("edges") or []
    if not edges:
        print(json.dumps({"ok": True, "skipped": "no_biore_workflow"}))
        return 0

    deactivated = []
    for edge in edges:
        node = edge["node"]
        version_ids = []
        published = node.get("lastPublishedVersionId")
        if published:
            version_ids.append(published)
        for vedge in (node.get("versions") or {}).get("edges") or []:
            vid = vedge["node"]["id"]
            if vid not in version_ids:
                version_ids.append(vid)
        for version_id in version_ids:
            try:
                gql(
                    api_key,
                    """
                    mutation Deactivate($id: ID!) {
                      deactivateWorkflowVersion(id: $id) { id status }
                    }
                    """,
                    {"id": version_id},
                )
                deactivated.append(version_id)
            except RuntimeError as err:
                # Already inactive is fine.
                if "ACTIVE" not in str(err) and "active" not in str(err).lower():
                    print(f"WARN deactivate {version_id}: {err}", file=sys.stderr)

    print(
        json.dumps(
            {
                "ok": True,
                "retired": True,
                "workflowId": edges[0]["node"]["id"],
                "deactivatedVersionIds": deactivated,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
