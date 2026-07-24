#!/usr/bin/env python3
"""Spec Twenty MANUAL workflow: Przypnij rozmowę do istniejącego leada."""
# Prefer Twenty MCP create_complete_workflow — GraphQL API key often returns 403.

WORKER_URL = "https://twenty-crm-worker-sandbox-hsxlhvflrq-lm.a.run.app/"

STEP_FORM = "a1000001-1111-4111-8111-111111111001"
STEP_HTTP = "a1000001-1111-4111-8111-111111111002"

WORKFLOW_SPEC = {
    "name": "Rozmowa · Przypnij do leada v1",
    "description": "Przypina rozmowę do wybranego istniejącego leada (MATCHED + timeline).",
    "activate": True,
    "trigger": {
        "name": "Przypnij do leada",
        "type": "MANUAL",
        "nextStepIds": [STEP_FORM],
        "settings": {
            "icon": "IconLink",
            "isPinned": True,
            "objectType": "callTranscript",
            "availability": {
                "type": "SINGLE_RECORD",
                "objectNameSingular": "callTranscript",
            },
            "outputSchema": {},
        },
    },
    "steps": [
        {
            "id": STEP_FORM,
            "name": "Wybierz lead",
            "type": "FORM",
            "valid": True,
            "nextStepIds": [STEP_HTTP],
            "settings": {
                "input": [
                    {
                        "id": "a1000001-1111-4111-8111-111111111101",
                        "name": "targetOpportunity",
                        "type": "RECORD",
                        "label": "Lead docelowy",
                        "placeholder": "Wyszukaj istniejącą szansę",
                        "settings": {"objectName": "opportunity"},
                    }
                ],
                "outputSchema": {},
                "errorHandlingOptions": {
                    "retryOnFailure": {"value": False},
                    "continueOnFailure": {"value": False},
                },
            },
        },
        {
            "id": STEP_HTTP,
            "name": "POST link_call_transcript",
            "type": "HTTP_REQUEST",
            "valid": True,
            "nextStepIds": None,
            "settings": {
                "input": {
                    "url": WORKER_URL,
                    "method": "POST",
                    "headers": {"Content-Type": "application/json"},
                    "body": (
                        '{"action":"link_call_transcript","environment":"sandbox","data":{'
                        '"transcriptId":"{{trigger.payload.id}}",'
                        f'"opportunityId":"{{{{{STEP_FORM}.targetOpportunity.id}}}}"'
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
    ],
}

# Live sandbox (2026-07-24):
# workflowId=cb93c9be-1e8b-47cd-b977-602d7373d100
# workflowVersionId=4bd6a859-0f9f-4dcc-be87-c8cdeedd7afc

if __name__ == "__main__":
    import json

    print(json.dumps(WORKFLOW_SPEC, indent=2, ensure_ascii=False))
