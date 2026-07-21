#!/usr/bin/env python3
"""Deploy Twenty MANUAL workflow: Utwórz lead z rozmowy (CallTranscript)."""
import json
import os
import sys
import urllib.request
import uuid

WORKER_URL = "https://twenty-crm-worker-sandbox-hsxlhvflrq-lm.a.run.app/"
ERR = {"retryOnFailure": {"value": False}, "continueOnFailure": {"value": False}}

STEP_FORM = "c7000001-1111-4111-8111-111111111001"
STEP_HTTP = "c7000001-1111-4111-8111-111111111002"


def build_workflow():
    trigger = {
        "name": "Utwórz lead z rozmowy",
        "type": "MANUAL",
        "nextStepIds": [STEP_FORM],
        "settings": {
            "icon": "IconUserPlus",
            "isPinned": True,
            "objectType": "callTranscript",
            "availability": {
                "type": "SINGLE_RECORD",
                "objectNameSingular": "callTranscript",
            },
            "outputSchema": {},
        },
    }

    steps = [
        {
            "id": STEP_FORM,
            "name": "Nazwa kontaktu (opcjonalnie)",
            "type": "FORM",
            "valid": True,
            "nextStepIds": [STEP_HTTP],
            "settings": {
                "input": [
                    {
                        "id": "c7000001-1111-4111-8111-111111111101",
                        "name": "contactName",
                        "type": "TEXT",
                        "label": "Imię / nazwa (opcjonalnie — domyślnie numer telefonu)",
                        "placeholder": "np. Jan Kowalski",
                    }
                ],
                "outputSchema": {},
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_HTTP,
            "name": "POST create_lead_from_call",
            "type": "HTTP_REQUEST",
            "valid": True,
            "nextStepIds": None,
            "settings": {
                "input": {
                    "url": WORKER_URL,
                    "method": "POST",
                    "headers": {"Content-Type": "application/json"},
                    "body": (
                        "{"
                        '"action":"create_lead_from_call",'
                        '"environment":"sandbox",'
                        '"data":{'
                        f'"transcriptId":"{{{{trigger.payload.id}}}}",'
                        f'"contactName":"{{{{{STEP_FORM}.contactName}}}}"'
                        "}"
                        "}"
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


def gql(api_key, query, variables=None):
    body = {"query": query}
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


def main():
    api_key = os.environ.get("TWENTY_API_KEY")
    if not api_key:
        print("TWENTY_API_KEY required", file=sys.stderr)
        sys.exit(1)

    trigger, steps = build_workflow()

    create_result = gql(
        api_key,
        """
        mutation CreateWf($input: CreateWorkflowInput!) {
          createWorkflow(data: $input) { id }
        }
        """,
        {"input": {"name": "Rozmowa · Utwórz lead v1", "statuses": ["DRAFT"]}},
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

    activate = gql(
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
                "activate": activate["data"]["activateWorkflowVersion"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
