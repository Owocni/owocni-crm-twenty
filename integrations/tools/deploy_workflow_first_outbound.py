#!/usr/bin/env python3
"""Deploy Twenty workflow: First Outbound Response (PF-M2 / ADR #18)."""
import json
import os
import sys
import urllib.request

ERR = {"retryOnFailure": {"value": False}, "continueOnFailure": {"value": False}}

STEP_FIND_MSG = "486397e7-1193-4708-bf35-9bfa1cd64146"
STEP_FILTER_SUBJECT = "f216cb11-f259-44a6-ade2-2b0125f21580"
STEP_FIND_TO = "b7bbdbef-dd8a-49b9-8f1a-8603f7ea55e7"
STEP_FILTER_CLIENT = "a6cf5858-ff2a-427f-8ed4-0e9917875385"
STEP_FIND_OPP = "803b4592-40b0-4bcc-89b3-ec5161dc0f24"
STEP_CODE = "7a3eb93a-2ed6-4ea8-9368-faf808a91046"
STEP_UPDATE_OPP = "826e8785-6f45-42dc-9bf5-e9e791fd5702"
LOGIC_FUNCTION_ID = "0331ac7b-df64-4224-aed7-c1c1bd817f42"


def build_workflow():
    trigger = {
        "name": "Mail OUTGOING",
        "type": "DATABASE_EVENT",
        "nextStepIds": [STEP_FIND_MSG],
        "settings": {
            "eventName": "messageChannelMessageAssociation.created",
            "outputSchema": {},
            "filter": {
                "stepFilterGroups": [{"id": "fg-out", "logicalOperator": "AND"}],
                "stepFilters": [
                    {
                        "id": "sf-dir",
                        "type": "trigger",
                        "operand": "IS",
                        "value": '["OUTGOING"]',
                        "stepOutputKey": "properties.after.direction",
                        "fieldMetadataId": "40df974f-c40c-4817-9876-cdaac301caa5",
                        "stepFilterGroupId": "fg-out",
                        "positionInStepFilterGroup": 0,
                    }
                ],
            },
        },
    }

    steps = [
        {
            "id": STEP_FIND_MSG,
            "name": "Pobierz wiadomosc",
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
            "name": "Pomin powiadomienia owner",
            "type": "FILTER",
            "valid": True,
            "nextStepIds": [STEP_FIND_TO],
            "settings": {
                "input": {
                    "stepFilterGroups": [{"id": "fg-skip-notify", "logicalOperator": "AND"}],
                    "stepFilters": [
                        {
                            "id": "sf-skip-notify",
                            "type": STEP_FIND_MSG,
                            "operand": "doesNotContain",
                            "value": "Nowy lead:",
                            "stepOutputKey": "first.subject",
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
            "name": "Pomin adresy @owocni.pl",
            "type": "FILTER",
            "valid": True,
            "nextStepIds": [STEP_FIND_OPP],
            "settings": {
                "input": {
                    "stepFilterGroups": [{"id": "fg-skip-internal", "logicalOperator": "AND"}],
                    "stepFilters": [
                        {
                            "id": "sf-skip-owocni",
                            "type": STEP_FIND_TO,
                            "operand": "doesNotContain",
                            "value": "@owocni.pl",
                            "stepOutputKey": "first.handle",
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
            "name": "Szukaj Opp bez M2",
            "type": "FIND_RECORDS",
            "valid": True,
            "nextStepIds": [STEP_CODE],
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
                                "value": f"{{{{{STEP_FIND_TO}.first.personId}}}}",
                                "fieldMetadataId": "d3bf68e5-ca97-4b8f-bf07-81dae44b7ebf",
                                "recordFilterGroupId": "fg-find-opp",
                                "positionInRecordFilterGroup": 0,
                            },
                            {
                                "id": "rf-opp-m2-empty",
                                "type": "NUMBER",
                                "operand": "IS_EMPTY",
                                "value": "",
                                "fieldMetadataId": "8c8759b4-116d-452c-a59b-4864e741f390",
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
            "id": STEP_CODE,
            "name": "Oblicz M2",
            "type": "CODE",
            "valid": True,
            "nextStepIds": [STEP_UPDATE_OPP],
            "settings": {
                "input": {
                    "logicFunctionId": LOGIC_FUNCTION_ID,
                    "logicFunctionInput": {
                        "createdAt": f"{{{{{STEP_FIND_OPP}.first.createdAt}}}}",
                        "firstOutboundAt": f"{{{{{STEP_FIND_MSG}.first.receivedAt}}}}",
                    },
                },
                "outputSchema": {
                    "firstResponseAt": {"type": "string"},
                    "hoursToFirstResponse": {"type": "number"},
                },
                "expectedOutputSchema": {
                    "firstResponseAt": "2026-07-09T10:00:00.000Z",
                    "hoursToFirstResponse": 2.5,
                },
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_UPDATE_OPP,
            "name": "Zapisz M2",
            "type": "UPDATE_RECORD",
            "valid": True,
            "nextStepIds": None,
            "settings": {
                "input": {
                    "objectName": "opportunity",
                    "objectRecordId": f"{{{{{STEP_FIND_OPP}.first.id}}}}",
                    "fieldsToUpdate": ["firstResponseAt", "hoursToFirstResponse"],
                    "objectRecord": {
                        "firstResponseAt": f"{{{{{STEP_CODE}.firstResponseAt}}}}",
                        "hoursToFirstResponse": f"{{{{{STEP_CODE}.hoursToFirstResponse}}}}",
                    },
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

    create_mutation = """
    mutation CreateWf($input: CreateWorkflowInput!) {
      createWorkflow(data: $input) { id }
    }
    """
    create_result = gql(
        api_key,
        create_mutation,
        {"input": {"name": "First Outbound Response v2", "statuses": ["DRAFT"]}},
    )
    workflow_id = create_result["data"]["createWorkflow"]["id"]

    version_mutation = """
    mutation CreateVersion($input: CreateWorkflowVersionInput!) {
      createWorkflowVersion(data: $input) { id }
    }
    """
    version_result = gql(
        api_key,
        version_mutation,
        {"input": {"workflowId": workflow_id, "trigger": trigger, "steps": steps}},
    )
    version_id = version_result["data"]["createWorkflowVersion"]["id"]

    code = """export const main = async (params: {
  createdAt: string;
  firstOutboundAt: string;
}): Promise<object> => {
  const created = new Date(params.createdAt);
  const outbound = new Date(params.firstOutboundAt);
  let hours =
    Math.round(((outbound.getTime() - created.getTime()) / 3_600_000) * 100) / 100;
  if (hours < 0) hours = 0;
  return {
    firstResponseAt: outbound.toISOString(),
    hoursToFirstResponse: hours,
  };
};"""

    logic_mutation = """
    mutation UpsertLogic($id: ID!, $source: String!) {
      updateLogicFunction(id: $id, data: { sourceCode: $source }) { id }
    }
    """
    gql(api_key, logic_mutation, {"id": LOGIC_FUNCTION_ID, "source": code})

    activate_mutation = """
    mutation Activate($id: ID!) {
      activateWorkflowVersion(id: $id) { id status }
    }
    """
    gql(api_key, activate_mutation, {"id": version_id})

    print(json.dumps({"workflowId": workflow_id, "workflowVersionId": version_id}))


if __name__ == "__main__":
    main()
