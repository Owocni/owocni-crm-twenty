#!/usr/bin/env python3
"""Deploy Twenty workflow: OUTGOING mail -> NEW to CONTACTED (Rozeznanie)."""
import json
import os
import sys
import urllib.request

WORKFLOW_VERSION_ID = "04c0ac83-57b7-491e-a35d-a5d10299d9cd"
WORKFLOW_ID = "030773a7-8e41-4625-b98c-46fd76a9cc67"

STEP_FIND_MSG = "c6010001-1111-4111-8111-111111111001"
STEP_FILTER_SUBJECT = "c6010001-1111-4111-8111-111111111002"
STEP_FIND_TO = "c6010001-1111-4111-8111-111111111003"
STEP_FILTER_CLIENT = "c6010001-1111-4111-8111-111111111004"
STEP_FIND_OPP = "c6010001-1111-4111-8111-111111111005"
STEP_UPDATE_OPP = "c6010001-1111-4111-8111-111111111006"

ERR = {"retryOnFailure": {"value": False}, "continueOnFailure": {"value": False}}


def build_workflow():
    trigger = {
        "name": "Mail OUTGOING do klienta",
        "type": "DATABASE_EVENT",
        "nextStepIds": [STEP_FIND_MSG],
        "settings": {
            "eventName": "messageChannelMessageAssociation.created",
            "outputSchema": {},
            "filter": {
                "stepFilterGroups": [{"id": "fg-trigger-out", "logicalOperator": "AND"}],
                "stepFilters": [
                    {
                        "id": "sf-trigger-dir",
                        "type": "SELECT",
                        "operand": "IS",
                        "value": '["OUTGOING"]',
                        "stepOutputKey": "{{trigger.properties.after.direction}}",
                        "fieldMetadataId": "40df974f-c40c-4817-9876-cdaac301caa5",
                        "stepFilterGroupId": "fg-trigger-out",
                        "positionInStepFilterGroup": 0,
                    }
                ],
            },
        },
    }

    steps = [
        {
            "id": STEP_FIND_MSG,
            "name": "Pobierz wiadomość",
            "type": "FIND_RECORDS",
            "valid": True,
            "nextStepIds": [STEP_FILTER_SUBJECT],
            "settings": {
                "input": {
                    "objectName": "message",
                    "limit": 1,
                    "filter": {
                        "recordFilterGroups": [{"id": "fg-find-msg", "logicalOperator": "AND"}],
                        "recordFilters": [
                            {
                                "id": "rf-find-msg",
                                "type": "UUID",
                                "operand": "IS",
                                "value": "{{trigger.properties.after.messageId}}",
                                "fieldMetadataId": "80bdea20-7116-42a4-8344-02019097dc57",
                                "recordFilterGroupId": "fg-find-msg",
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
            "id": STEP_FILTER_SUBJECT,
            "name": "Pomiń powiadomienia owner",
            "type": "FILTER",
            "valid": True,
            "nextStepIds": [STEP_FIND_TO],
            "settings": {
                "input": {
                    "stepFilterGroups": [{"id": "fg-skip-notify", "logicalOperator": "AND"}],
                    "stepFilters": [
                        {
                            "id": "sf-skip-notify",
                            "type": "TEXT",
                            "operand": "DOES_NOT_CONTAIN",
                            "value": "Nowy lead:",
                            "stepOutputKey": f"{{{{{STEP_FIND_MSG}.records[0].subject}}}}",
                            "fieldMetadataId": "7d2b7e6a-6d5c-4489-b0de-8684c6ffe2bf",
                            "stepFilterGroupId": "fg-skip-notify",
                            "positionInStepFilterGroup": 0,
                        }
                    ],
                },
                "outputSchema": {},
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_FIND_TO,
            "name": "Odbiorca TO (klient)",
            "type": "FIND_RECORDS",
            "valid": True,
            "nextStepIds": [STEP_FILTER_CLIENT],
            "settings": {
                "input": {
                    "objectName": "messageParticipant",
                    "limit": 1,
                    "filter": {
                        "recordFilterGroups": [{"id": "fg-find-to", "logicalOperator": "AND"}],
                        "recordFilters": [
                            {
                                "id": "rf-to-msg",
                                "type": "RELATION",
                                "operand": "IS",
                                "value": "{{trigger.properties.after.messageId}}",
                                "fieldMetadataId": "fb233e65-1b50-404e-b1a1-3515f38cc5fe",
                                "recordFilterGroupId": "fg-find-to",
                                "positionInRecordFilterGroup": 0,
                            },
                            {
                                "id": "rf-to-role",
                                "type": "SELECT",
                                "operand": "IS",
                                "value": '["TO"]',
                                "fieldMetadataId": "8b6bbc86-3e6c-47fd-90f6-403e687f914a",
                                "recordFilterGroupId": "fg-find-to",
                                "positionInRecordFilterGroup": 1,
                            },
                            {
                                "id": "rf-to-person",
                                "type": "RELATION",
                                "operand": "IS_NOT_NULL",
                                "value": "",
                                "fieldMetadataId": "58eda998-e19b-4b6d-8643-95fa3c687790",
                                "recordFilterGroupId": "fg-find-to",
                                "positionInRecordFilterGroup": 2,
                            },
                        ],
                    },
                },
                "outputSchema": {},
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_FILTER_CLIENT,
            "name": "Pomiń adresy @owocni.pl",
            "type": "FILTER",
            "valid": True,
            "nextStepIds": [STEP_FIND_OPP],
            "settings": {
                "input": {
                    "stepFilterGroups": [{"id": "fg-skip-internal", "logicalOperator": "AND"}],
                    "stepFilters": [
                        {
                            "id": "sf-skip-owocni",
                            "type": "TEXT",
                            "operand": "DOES_NOT_CONTAIN",
                            "value": "@owocni.pl",
                            "stepOutputKey": f"{{{{{STEP_FIND_TO}.records[0].handle}}}}",
                            "fieldMetadataId": "8f584b17-81ee-4da7-9021-44128a57f3d2",
                            "stepFilterGroupId": "fg-skip-internal",
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
            "name": "Szukaj Opp NEW",
            "type": "FIND_RECORDS",
            "valid": True,
            "nextStepIds": [STEP_UPDATE_OPP],
            "settings": {
                "input": {
                    "objectName": "opportunity",
                    "limit": 1,
                    "orderBy": {
                        "recordSorts": [
                            {
                                "fieldMetadataId": "3c34b4c6-deb0-42d0-8799-ec6a4cf24b22",
                                "direction": "DescNullsLast",
                            }
                        ]
                    },
                    "filter": {
                        "recordFilterGroups": [{"id": "fg-find-opp", "logicalOperator": "AND"}],
                        "recordFilters": [
                            {
                                "id": "rf-opp-contact",
                                "type": "RELATION",
                                "operand": "IS",
                                "value": f"{{{{{STEP_FIND_TO}.records[0].personId}}}}",
                                "fieldMetadataId": "d3bf68e5-ca97-4b8f-bf07-81dae44b7ebf",
                                "recordFilterGroupId": "fg-find-opp",
                                "positionInRecordFilterGroup": 0,
                            },
                            {
                                "id": "rf-opp-stage",
                                "type": "SELECT",
                                "operand": "IS",
                                "value": '["NEW"]',
                                "fieldMetadataId": "131b6ca4-c0bd-4b44-8b2e-21de452f667d",
                                "recordFilterGroupId": "fg-find-opp",
                                "positionInRecordFilterGroup": 1,
                            },
                        ],
                    },
                },
                "outputSchema": {},
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_UPDATE_OPP,
            "name": "Stage → Rozeznanie",
            "type": "UPDATE_RECORD",
            "valid": True,
            "nextStepIds": None,
            "settings": {
                "input": {
                    "objectName": "opportunity",
                    "objectRecord": {"stage": "CONTACTED"},
                    "fieldsToUpdate": ["stage"],
                    "objectRecordId": f"{{{{{STEP_FIND_OPP}.records[0].id}}}}",
                },
                "outputSchema": {},
                "errorHandlingOptions": ERR,
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
        return json.loads(res.read().decode())


def main():
    api_key = os.environ.get("TWENTY_API_KEY")
    if not api_key:
        print("TWENTY_API_KEY required", file=sys.stderr)
        sys.exit(1)

    trigger, steps = build_workflow()
    mutation = """
    mutation UpdateWf($id: ID!, $trigger: JSON, $steps: JSON) {
      updateWorkflowVersion(
        id: $id
        data: { trigger: $trigger, steps: $steps }
      ) { id status }
    }
    """
    variables = {
        "id": WORKFLOW_VERSION_ID,
        "trigger": trigger,
        "steps": steps,
    }
    result = gql(api_key, mutation, variables)
    print(json.dumps(result, indent=2))
    if result.get("errors"):
        sys.exit(1)

    print("OK workflow", WORKFLOW_ID, "version", WORKFLOW_VERSION_ID)
    print("Run MCP activate_workflow_version on", WORKFLOW_VERSION_ID)


if __name__ == "__main__":
    main()
