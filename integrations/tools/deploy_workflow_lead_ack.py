#!/usr/bin/env python3
"""Deploy Twenty MANUAL workflow: Biorę (bizAckAt via worker lead_ack).

Usage:
  export TWENTY_API_KEY=...
  export TWENTY_CRM_WORKER_URL=https://twenty-crm-worker-sandbox-....run.app/
  python3 integrations/tools/deploy_workflow_lead_ack.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ERR = {"retryOnFailure": {"value": False}, "continueOnFailure": {"value": False}}

STEP_HTTP = "d7000001-1111-4111-8111-111111111101"
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


def worker_url() -> str:
    raw = (
        os.environ.get("TWENTY_CRM_WORKER_URL")
        or os.environ.get("WORKER_URL")
        or ""
    ).strip()
    if not raw:
        raise SystemExit(
            "Ustaw TWENTY_CRM_WORKER_URL (URL twenty-crm-worker po deploy.sh)"
        )
    return raw if raw.endswith("/") else f"{raw}/"


def build_workflow(url: str):
    trigger = {
        "name": "Biorę",
        "type": "MANUAL",
        "nextStepIds": [STEP_HTTP],
        "settings": {
            "icon": "IconHandStop",
            "isPinned": True,
            "objectType": "opportunity",
            "availability": {
                "type": "SINGLE_RECORD",
                "objectNameSingular": "opportunity",
            },
            "outputSchema": {},
        },
    }

    steps = [
        {
            "id": STEP_HTTP,
            "name": "POST lead_ack",
            "type": "HTTP_REQUEST",
            "valid": True,
            "nextStepIds": None,
            "settings": {
                "input": {
                    "url": url,
                    "method": "POST",
                    "headers": {"Content-Type": "application/json"},
                    "body": (
                        '{"action":"lead_ack","environment":"sandbox","data":{'
                        '"opportunityId":"{{trigger.payload.id}}"'
                        "}}"
                    ),
                },
                "outputSchema": {
                    "body": {"type": "string"},
                    "statusCode": {"type": "number"},
                },
                "errorHandlingOptions": {
                    "retryOnFailure": {"value": False},
                    "continueOnFailure": {"value": False},
                },
            },
        },
    ]
    return trigger, steps


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


def find_existing_workflow(api_key: str) -> str | None:
    data = gql(
        api_key,
        """
        query {
          workflows(filter: { name: { eq: "%s" } }, first: 5) {
            edges { node { id name statuses } }
          }
        }
        """
        % WORKFLOW_NAME,
    )
    edges = data.get("data", {}).get("workflows", {}).get("edges") or []
    if edges:
        return edges[0]["node"]["id"]
    return None


def main() -> int:
    load_dotenv_local()
    api_key = os.environ.get("TWENTY_API_KEY", "").strip()
    if not api_key:
        print("TWENTY_API_KEY required", file=sys.stderr)
        return 1

    url = worker_url()
    trigger, steps = build_workflow(url)
    existing = find_existing_workflow(api_key)
    if existing:
        print(f"Workflow {WORKFLOW_NAME} już istnieje id={existing} — pomijam create")
        print(json.dumps({"workflowId": existing, "skipped": True, "workerUrl": url}))
        return 0

    create_result = gql(
        api_key,
        """
        mutation CreateWf($input: CreateWorkflowInput!) {
          createWorkflow(data: $input) { id }
        }
        """,
        {"input": {"name": WORKFLOW_NAME, "statuses": ["DRAFT"]}},
    )
    workflow_id = create_result["data"]["createWorkflow"]["id"]

    version_result = gql(
        api_key,
        """
        mutation CreateVersion($input: CreateWorkflowVersionInput!) {
          createWorkflowVersion(data: $input) { id }
        }
        """,
        {"input": {"workflowId": workflow_id, "trigger": trigger, "steps": steps}},
    )
    version_id = version_result["data"]["createWorkflowVersion"]["id"]

    gql(
        api_key,
        """
        mutation Activate($id: ID!) {
          activateWorkflowVersion(id: $id) { id status }
        }
        """,
        {"id": version_id},
    )

    print(json.dumps({"workflowId": workflow_id, "workflowVersionId": version_id, "workerUrl": url}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
