#!/usr/bin/env python3
"""Deploy Twenty MANUAL workflow: Odrzuc leada (campaignRejected, rejected_lead)."""
import json
import os
import sys
import urllib.request

ERR = {"retryOnFailure": {"value": False}, "continueOnFailure": {"value": False}}

STEP_INFO = "c5000001-1111-4111-8111-111111111101"
STEP_CONFIRM = "c5000002-1111-4111-8111-111111111102"
STEP_UPDATE = "c5000003-1111-4111-8111-111111111103"
STEP_HTTP = "c5000004-1111-4111-8111-111111111104"


def build_workflow():
    trigger = {
        "name": "Odrzuc leada",
        "type": "MANUAL",
        "nextStepIds": [STEP_INFO],
        "settings": {
            "icon": "IconBan",
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
            "id": STEP_INFO,
            "name": "Informacja o skutkach",
            "type": "FORM",
            "valid": True,
            "nextStepIds": [STEP_CONFIRM],
            "settings": {
                "input": [
                    {
                        "id": "c5000001-1111-4111-8111-111111111201",
                        "name": "rejectInfo",
                        "type": "TEXT",
                        "label": "Lead zostanie oznaczony jako odrzucony. Etap sie NIE zmieni. Wyslemy rejected_lead do arkusza sandbox.",
                        "placeholder": "Dalej",
                    }
                ],
                "outputSchema": {},
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_CONFIRM,
            "name": "Powod i potwierdzenie",
            "type": "FORM",
            "valid": True,
            "nextStepIds": [STEP_UPDATE],
            "settings": {
                "input": [
                    {
                        "id": "c5000002-1111-4111-8111-111111111202",
                        "name": "rejectionReason",
                        "type": "SELECT",
                        "label": "Powod odrzucenia",
                        "settings": {
                            "options": [
                                {"label": "Budget", "value": "BUDGET"},
                                {"label": "Not target", "value": "NOT_TARGET"},
                                {"label": "Spam", "value": "SPAM"},
                                {"label": "Duplicate", "value": "DUPLICATE"},
                                {"label": "Other", "value": "OTHER"},
                            ]
                        },
                    },
                    {
                        "id": "c5000002-1111-4111-8111-111111111203",
                        "name": "rejectConfirm",
                        "type": "SELECT",
                        "label": "Odrzucic leada?",
                        "settings": {"options": [{"label": "Tak", "value": "yes"}]},
                    },
                ],
                "outputSchema": {},
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_UPDATE,
            "name": "Ustaw campaignRejected",
            "type": "UPDATE_RECORD",
            "valid": True,
            "nextStepIds": [STEP_HTTP],
            "settings": {
                "input": {
                    "objectName": "opportunity",
                    "objectRecord": {
                        "campaignRejected": True,
                        "rejectionReason": f"{{{{{STEP_CONFIRM}.rejectionReason}}}}",
                    },
                    "fieldsToUpdate": ["campaignRejected", "rejectionReason"],
                    "objectRecordId": "{{trigger.payload.id}}",
                },
                "outputSchema": {},
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_HTTP,
            "name": "POST Stape rejected",
            "type": "HTTP_REQUEST",
            "valid": True,
            "nextStepIds": None,
            "settings": {
                "input": {
                    "url": "https://uinpcbwf.eug.stape.io/inbound/twenty_webhook",
                    "method": "POST",
                    "headers": {"Content-Type": "application/json"},
                    "body": (
                        "{"
                        '"event":"opportunity.updated",'
                        f'"timestamp":"reject-v1-{{{{{STEP_UPDATE}.updatedAt}}}}",'
                        '"previousRecord":{"campaignRejected":false,'
                        f'"stage":"{{{{{STEP_UPDATE}.stage}}}}"'
                        "},"
                        '"data":{'
                        f'"id":"{{{{{STEP_UPDATE}.id}}}}",'
                        f'"idOid":"{{{{{STEP_UPDATE}.idOid}}}}",'
                        f'"name":"{{{{{STEP_UPDATE}.name}}}}",'
                        f'"stage":"{{{{{STEP_UPDATE}.stage}}}}",'
                        f'"bizProduct":"{{{{{STEP_UPDATE}.bizProduct}}}}",'
                        f'"pointOfContactId":"{{{{{STEP_UPDATE}.pointOfContactId}}}}",'
                        '"campaignRejected":true,'
                        f'"rejectionReason":"{{{{{STEP_UPDATE}.rejectionReason}}}}"'
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
                    "continueOnFailure": {"value": True},
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
        {"input": {"name": "Opp · Odrzuc leada v1", "statuses": ["DRAFT"]}},
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

    print(json.dumps({"workflowId": workflow_id, "workflowVersionId": version_id}))


if __name__ == "__main__":
    main()
