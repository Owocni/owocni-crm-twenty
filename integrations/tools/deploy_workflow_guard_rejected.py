#!/usr/bin/env python3
"""Deploy Twenty guard: campaignRejected lead cannot move to QUALIFIED or WON."""
import json
import os
import sys
import urllib.request

ERR = {"retryOnFailure": {"value": False}, "continueOnFailure": {"value": False}}

STEP_CODE = "d6000001-1111-4111-8111-111111111101"
STEP_IF = "d6000002-1111-4111-8111-111111111102"
STEP_REVERT = "d6000003-1111-4111-8111-111111111103"


def build_workflow():
    trigger = {
        "name": "Opp updated",
        "type": "DATABASE_EVENT",
        "nextStepIds": [STEP_CODE],
        "settings": {
            "eventName": "opportunity.updated",
            "outputSchema": {},
        },
    }

    steps = [
        {
            "id": STEP_CODE,
            "name": "Ocen drag na odrzuconym",
            "type": "CODE",
            "valid": True,
            "nextStepIds": [STEP_IF],
            "settings": {
                "input": {
                    "logicFunctionInput": {
                        "afterStage": "{{trigger.properties.after.stage}}",
                        "beforeStage": "{{trigger.properties.before.stage}}",
                        "campaignRejected": "{{trigger.properties.after.campaignRejected}}",
                        "bizLastNonSqlStage": "{{trigger.properties.after.bizLastNonSqlStage}}",
                    }
                },
                "outputSchema": {
                    "shouldRevert": {"type": "boolean"},
                    "revertStage": {"type": "string"},
                },
                "expectedOutputSchema": {
                    "shouldRevert": True,
                    "revertStage": "CONTACTED",
                },
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_IF,
            "name": "Czy cofnac etap?",
            "type": "IF_ELSE",
            "valid": True,
            "nextStepIds": None,
            "settings": {
                "input": {
                    "stepFilterGroups": [{"id": "fg-if", "logicalOperator": "AND"}],
                    "stepFilters": [
                        {
                            "id": "sf-revert",
                            "type": "boolean",
                            "operand": "IS",
                            "value": "true",
                            "stepOutputKey": f"{STEP_CODE}.shouldRevert",
                            "stepFilterGroupId": "fg-if",
                            "positionInStepFilterGroup": 0,
                        }
                    ],
                    "branches": [
                        {
                            "id": "branch-yes",
                            "nextStepIds": [STEP_REVERT],
                            "filterGroupId": "fg-if",
                        }
                    ],
                },
                "outputSchema": {},
                "errorHandlingOptions": ERR,
            },
        },
        {
            "id": STEP_REVERT,
            "name": "Cofnij etap",
            "type": "UPDATE_RECORD",
            "valid": True,
            "nextStepIds": None,
            "settings": {
                "input": {
                    "objectName": "opportunity",
                    "objectRecord": {
                        "stage": f"{{{{{STEP_CODE}.revertStage}}}}",
                        "bizSqlConfirmed": False,
                    },
                    "fieldsToUpdate": ["stage", "bizSqlConfirmed"],
                    "objectRecordId": "{{trigger.properties.after.id}}",
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

    create_result = gql(
        api_key,
        """
        mutation CreateWf($input: CreateWorkflowInput!) {
          createWorkflow(data: $input) { id }
        }
        """,
        {"input": {"name": "Opp · guard odrzucony v1", "statuses": ["DRAFT"]}},
    )
    workflow_id = create_result["data"]["createWorkflow"]["id"]

    version_result = gql(
        api_key,
        """
        mutation CreateVersion($input: CreateWorkflowVersionInput!) {
          createWorkflowVersion(data: $input) { id status steps { id settings } }
        }
        """,
        {"input": {"workflowId": workflow_id, "trigger": trigger, "steps": steps}},
    )
    version_id = version_result["data"]["createWorkflowVersion"]["id"]
    code_step = next(
        s
        for s in version_result["data"]["createWorkflowVersion"]["steps"]
        if s["id"] == STEP_CODE
    )
    logic_function_id = code_step["settings"]["input"]["logicFunctionId"]

    source = """export const main = async (params: {
  afterStage: string;
  beforeStage: string;
  campaignRejected: boolean | string;
  bizLastNonSqlStage: string;
}): Promise<object> => {
  const rejected =
    params.campaignRejected === true ||
    params.campaignRejected === "true";
  if (!rejected) {
    return { shouldRevert: false, revertStage: "" };
  }
  if (params.afterStage !== "QUALIFIED" && params.afterStage !== "WON") {
    return { shouldRevert: false, revertStage: "" };
  }
  if (params.beforeStage === params.afterStage) {
    return { shouldRevert: false, revertStage: "" };
  }
  const revert =
    params.bizLastNonSqlStage ||
    params.beforeStage ||
    "CONTACTED";
  return { shouldRevert: true, revertStage: revert };
};"""

    gql(
        api_key,
        """
        mutation UpsertLogic($id: ID!, $source: String!) {
          updateLogicFunction(id: $id, data: { sourceCode: $source }) { id }
        }
        """,
        {"id": logic_function_id, "source": source},
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
                "workflowId": workflow_id,
                "workflowVersionId": version_id,
                "logicFunctionId": logic_function_id,
            }
        )
    )


if __name__ == "__main__":
    main()
