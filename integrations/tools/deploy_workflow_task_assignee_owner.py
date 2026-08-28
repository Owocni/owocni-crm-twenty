#!/usr/bin/env python3
"""Deploy Twenty workflow: task linked to Opp → assignee = Opp owner (if empty).

Robert UX (2026-08): tworzenie zadania z karty leada bez ręcznego Assignee.
Uzupełnia „Task Create Assignee Me v1” (creator) — ten workflow wygrywa po powiązaniu z Opp.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ERR = {"retryOnFailure": {"value": False}, "continueOnFailure": {"value": False}}

WORKFLOW_NAME = "Task · Assignee = Owner lead v2"

# Live (2026-08-28): workflowId=b52a0aee-78a6-4560-b377-14b53afddfe1
# versionId=38f5ba59-4d1f-485e-a3da-c51957de994f — deploy via Twenty MCP create_complete_workflow
# (GraphQL api.twenty.com → 403 z REST key). v1 DEACTIVATED (broken trigger path).

STEP_FIND_TT = "c8020000-1111-4111-8111-111111111000"
STEP_FILTER_OPP = "c8020001-1111-4111-8111-111111111001"
STEP_FIND_OPP = "c8020001-1111-4111-8111-111111111002"
STEP_FILTER_OWNER = "c8010001-1111-4111-8111-111111111003"
STEP_FIND_TASK = "c8010001-1111-4111-8111-111111111004"
STEP_FILTER_ASG = "c8010001-1111-4111-8111-111111111005"
STEP_UPDATE = "c8010001-1111-4111-8111-111111111006"

# metadata/fields (workspace zany-maroon-panther)
F_OPP_ID = "d021f69a-4e08-416b-b9b1-27c0a1b3f0ef"
F_TASK_ID = "bcc715f6-2fa2-4b44-b6a0-7ea1b181dbdb"


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


def build_workflow():
    trigger = {
        "name": "TaskTarget → Opp",
        "type": "DATABASE_EVENT",
        "nextStepIds": [STEP_FILTER_OPP],
        "settings": {
            "eventName": "taskTarget.created",
            "fields": ["id", "taskId", "targetOpportunityId"],
            "outputSchema": {},
        },
    }

    steps = [
        {
            "id": STEP_FILTER_OPP,
            "name": "Powiązane z Opp",
            "type": "FILTER",
            "valid": True,
            "nextStepIds": [STEP_FIND_OPP],
            "settings": {
                "input": {
                    "stepFilterGroups": [{"id": "fg-tt-opp", "logicalOperator": "AND"}],
                    "stepFilters": [
                        {
                            "id": "sf-tt-opp",
                            "type": "uuid",
                            "operand": "IS_NOT_EMPTY",
                            "value": "",
                            "stepOutputKey": "{{trigger.properties.after.targetOpportunityId}}",
                            "stepFilterGroupId": "fg-tt-opp",
                            "positionInStepFilterGroup": 0,
                        }
                    ],
                },
                "outputSchema": {},
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_FIND_OPP,
            "name": "Pobierz Opp",
            "type": "FIND_RECORDS",
            "valid": True,
            "nextStepIds": [STEP_FILTER_OWNER],
            "settings": {
                "input": {
                    "objectName": "opportunity",
                    "limit": 1,
                    "filter": {
                        "recordFilterGroups": [{"id": "fg-find-opp", "logicalOperator": "AND"}],
                        "recordFilters": [
                            {
                                "id": "rf-opp-id",
                                "type": "UUID",
                                "operand": "IS",
                                "value": f"{{{{{STEP_FIND_TT}.first.targetOpportunityId}}}}",
                                "fieldMetadataId": F_OPP_ID,
                                "recordFilterGroupId": "fg-find-opp",
                                "positionInRecordFilterGroup": 0,
                            }
                        ],
                    },
                },
                "outputSchema": {},
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_FILTER_OWNER,
            "name": "Owner ustawiony",
            "type": "FILTER",
            "valid": True,
            "nextStepIds": [STEP_FIND_TASK],
            "settings": {
                "input": {
                    "stepFilterGroups": [{"id": "fg-owner", "logicalOperator": "AND"}],
                    "stepFilters": [
                        {
                            "id": "sf-owner",
                            "type": "uuid",
                            "operand": "IS_NOT_EMPTY",
                            "value": "",
                            "stepOutputKey": f"{{{{{STEP_FIND_OPP}.first.ownerId}}}}",
                            "stepFilterGroupId": "fg-owner",
                            "positionInStepFilterGroup": 0,
                        }
                    ],
                },
                "outputSchema": {},
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_FIND_TASK,
            "name": "Pobierz task",
            "type": "FIND_RECORDS",
            "valid": True,
            "nextStepIds": [STEP_FILTER_ASG],
            "settings": {
                "input": {
                    "objectName": "task",
                    "limit": 1,
                    "filter": {
                        "recordFilterGroups": [{"id": "fg-find-task", "logicalOperator": "AND"}],
                        "recordFilters": [
                            {
                                "id": "rf-task-id",
                                "type": "UUID",
                                "operand": "IS",
                                "value": "{{trigger.properties.after.taskId}}",
                                "fieldMetadataId": F_TASK_ID,
                                "recordFilterGroupId": "fg-find-task",
                                "positionInRecordFilterGroup": 0,
                            }
                        ],
                    },
                },
                "outputSchema": {},
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_FILTER_ASG,
            "name": "Assignee pusty",
            "type": "FILTER",
            "valid": True,
            "nextStepIds": [STEP_UPDATE],
            "settings": {
                "input": {
                    "stepFilterGroups": [{"id": "fg-asg", "logicalOperator": "AND"}],
                    "stepFilters": [
                        {
                            "id": "sf-asg",
                            "type": "uuid",
                            "operand": "IS_EMPTY",
                            "value": "",
                            "stepOutputKey": f"{{{{{STEP_FIND_TASK}.first.assigneeId}}}}",
                            "stepFilterGroupId": "fg-asg",
                            "positionInStepFilterGroup": 0,
                        }
                    ],
                },
                "outputSchema": {},
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_UPDATE,
            "name": "Assignee = owner leada",
            "type": "UPDATE_RECORD",
            "valid": True,
            "nextStepIds": None,
            "settings": {
                "input": {
                    "objectName": "task",
                    "objectRecord": {
                        "assigneeId": f"{{{{{STEP_FIND_OPP}.first.ownerId}}}}"
                    },
                    "fieldsToUpdate": ["assigneeId"],
                    "objectRecordId": "{{trigger.properties.after.taskId}}",
                },
                "outputSchema": {},
                "errorHandlingOptions": {
                    "retryOnFailure": {"value": False},
                    "continueOnFailure": {"value": True},
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

    trigger, steps = build_workflow()
    existing = find_existing_workflow(api_key)
    if existing:
        print(f"Workflow {WORKFLOW_NAME} już istnieje id={existing} — pomijam create")
        print(json.dumps({"workflowId": existing, "skipped": True}))
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

    print(
        json.dumps(
            {
                "workflowId": workflow_id,
                "workflowVersionId": version_id,
                "name": WORKFLOW_NAME,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
