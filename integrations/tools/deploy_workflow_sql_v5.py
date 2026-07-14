#!/usr/bin/env python3
"""Deploy Opp · Przyjmij jako SQL v5 — atomic SQL metrics + keep terminal stage."""
import json
import os
import sys
import urllib.request

WORKFLOW_ID = "207207b6-487b-4d66-bf47-81d1c65f90a2"
ERR = {"retryOnFailure": {"value": False}, "continueOnFailure": {"value": False}}

STEP_INFO = "b4000001-1111-4111-8111-111111111101"
STEP_CONFIRM = "b4000002-1111-4111-8111-111111111102"
STEP_FIND = "b4000002a-1111-4111-8111-11111111110a"
STEP_CODE = "b4000002b-1111-4111-8111-11111111110b"
STEP_UPDATE = "b4000003-1111-4111-8111-111111111103"
STEP_HTTP = "b4000004-1111-4111-8111-111111111104"


def build_workflow():
    trigger = {
        "name": "Przyjmij jako SQL",
        "type": "MANUAL",
        "nextStepIds": [STEP_INFO],
        "settings": {
            "icon": "IconTargetArrow",
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
                        "id": "b4000001-1111-4111-8111-111111111201",
                        "name": "sqlInfo",
                        "type": "TEXT",
                        "label": "Lead zostanie oznaczony jako SQL (reklamy + statystyki). Na WON/LOST etap kanbanu sie nie zmieni.",
                        "placeholder": "Dalej",
                    }
                ],
                "outputSchema": {},
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_CONFIRM,
            "name": "Czy na pewno?",
            "type": "FORM",
            "valid": True,
            "nextStepIds": [STEP_FIND],
            "settings": {
                "input": [
                    {
                        "id": "b4000002-1111-4111-8111-111111111202",
                        "name": "sqlConfirm",
                        "type": "SELECT",
                        "label": "Oznaczyc leada jako SQL?",
                        "settings": {"options": [{"label": "Tak", "value": "yes"}]},
                    }
                ],
                "outputSchema": {},
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_FIND,
            "name": "Pobierz rekord",
            "type": "FIND_RECORDS",
            "valid": True,
            "nextStepIds": [STEP_CODE],
            "settings": {
                "input": {
                    "objectName": "opportunity",
                    "limit": 1,
                    "filter": {
                        "recordFilterGroups": [{"id": "fg-find", "logicalOperator": "AND"}],
                        "recordFilters": [
                            {
                                "id": "rf-id",
                                "type": "UUID",
                                "operand": "IS",
                                "value": f"{{{{trigger.payload.id}}}}",
                                "fieldMetadataId": "00000000-0000-0000-0000-000000000001",
                                "stepFilterGroupId": "fg-find",
                                "positionInStepFilterGroup": 0,
                            }
                        ],
                    },
                },
                "outputSchema": {},
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_CODE,
            "name": "Oblicz pola SQL",
            "type": "CODE",
            "valid": True,
            "nextStepIds": [STEP_UPDATE],
            "settings": {
                "input": {
                    "logicFunctionInput": {
                        "createdAt": f"{{{{{STEP_FIND}.records[0].createdAt}}}}",
                        "qualifiedAt": f"{{{{{STEP_FIND}.records[0].qualifiedAt}}}}",
                        "currentStage": f"{{{{{STEP_FIND}.records[0].stage}}}}",
                    }
                },
                "outputSchema": {
                    "stage": {"type": "string"},
                    "qualifiedAt": {"type": "string"},
                    "hoursToQualified": {"type": "number"},
                    "bizSqlConfirmedAt": {"type": "string"},
                    "bizSqlConfirmed": {"type": "boolean"},
                },
                "expectedOutputSchema": {
                    "stage": "QUALIFIED",
                    "qualifiedAt": "2026-07-10T10:00:00.000Z",
                    "hoursToQualified": 12.5,
                    "bizSqlConfirmedAt": "2026-07-10T10:00:00.000Z",
                    "bizSqlConfirmed": True,
                },
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_UPDATE,
            "name": "Ustaw SQL + metryki",
            "type": "UPDATE_RECORD",
            "valid": True,
            "nextStepIds": [STEP_HTTP],
            "settings": {
                "input": {
                    "objectName": "opportunity",
                    "objectRecord": {
                        "stage": f"{{{{{STEP_CODE}.stage}}}}",
                        "bizSqlConfirmed": f"{{{{{STEP_CODE}.bizSqlConfirmed}}}}",
                        "bizSqlConfirmedAt": f"{{{{{STEP_CODE}.bizSqlConfirmedAt}}}}",
                        "qualifiedAt": f"{{{{{STEP_CODE}.qualifiedAt}}}}",
                        "hoursToQualified": f"{{{{{STEP_CODE}.hoursToQualified}}}}",
                    },
                    "fieldsToUpdate": [
                        "stage",
                        "bizSqlConfirmed",
                        "bizSqlConfirmedAt",
                        "qualifiedAt",
                        "hoursToQualified",
                    ],
                    "objectRecordId": "{{trigger.payload.id}}",
                },
                "outputSchema": {},
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_HTTP,
            "name": "POST Stape qualify",
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
                        f'"timestamp":"sql-v5-{{{{{STEP_UPDATE}.updatedAt}}}}",'
                        '"data":{'
                        f'"id":"{{{{{STEP_UPDATE}.id}}}}",'
                        f'"idOid":"{{{{{STEP_UPDATE}.idOid}}}}",'
                        f'"name":"{{{{{STEP_UPDATE}.name}}}}",'
                        f'"stage":"{{{{{STEP_UPDATE}.stage}}}}",'
                        f'"bizProduct":"{{{{{STEP_UPDATE}.bizProduct}}}}",'
                        f'"pointOfContactId":"{{{{{STEP_UPDATE}.pointOfContactId}}}}",'
                        '"bizSqlConfirmed":true'
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


LOGIC_SOURCE = """export const main = async (params: {
  createdAt: string;
  qualifiedAt?: string | null;
  currentStage: string;
}): Promise<object> => {
  const now = new Date();
  const nowIso = now.toISOString();
  const created = new Date(params.createdAt);
  const hours =
    Math.round(((now.getTime() - created.getTime()) / 3_600_000) * 100) / 100;
  const terminal = new Set(["WON", "LOST"]);
  const keepStage = terminal.has(params.currentStage);
  const qualifiedAt = params.qualifiedAt || nowIso;
  const hoursToQualified = params.qualifiedAt
    ? Math.round(
        ((new Date(qualifiedAt).getTime() - created.getTime()) / 3_600_000) *
          100,
      ) / 100
    : hours;
  return {
    stage: keepStage ? params.currentStage : "QUALIFIED",
    qualifiedAt,
    hoursToQualified,
    bizSqlConfirmedAt: nowIso,
    bizSqlConfirmed: true,
  };
};"""


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
    with urllib.request.urlopen(req, timeout=120) as res:
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

    version_result = gql(
        api_key,
        """
        mutation CreateVersion($input: CreateWorkflowVersionInput!) {
          createWorkflowVersion(data: $input) {
            id
            status
            steps { id settings }
          }
        }
        """,
        {
            "input": {
                "workflowId": WORKFLOW_ID,
                "trigger": trigger,
                "steps": steps,
            }
        },
    )
    version_id = version_result["data"]["createWorkflowVersion"]["id"]
    code_step = next(
        s
        for s in version_result["data"]["createWorkflowVersion"]["steps"]
        if s["id"] == STEP_CODE
    )
    logic_function_id = code_step["settings"]["input"]["logicFunctionId"]

    gql(
        api_key,
        """
        mutation UpsertLogic($id: ID!, $source: String!) {
          updateLogicFunction(id: $id, data: { sourceCode: $source }) { id }
        }
        """,
        {"id": logic_function_id, "source": LOGIC_SOURCE},
    )

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
                "workflowId": WORKFLOW_ID,
                "workflowVersionId": version_id,
                "logicFunctionId": logic_function_id,
                "version": "v5",
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
