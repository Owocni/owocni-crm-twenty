#!/usr/bin/env python3
"""Spec Twenty MANUAL workflow: Przypnij rozmowę do istniejącego leada.

v3: dwa sposoby w formularzu —
  1) TEXT email → worker szuka otwartego leada (bizCardEmail / Person email)
  2) RECORD Opportunity → wybór po nazwie leada
Pierwszeństwo: wybrany lead po nazwie, inaczej email.
"""
# Prefer Twenty MCP create_complete_workflow — GraphQL API key often returns 403.

WORKER_URL = "https://twenty-crm-worker-sandbox-hsxlhvflrq-lm.a.run.app/"

STEP_FORM = "b1000001-1111-4111-8111-111111111001"
STEP_HTTP = "b1000001-1111-4111-8111-111111111002"

WORKFLOW_SPEC = {
    "name": "Rozmowa · Przypnij do leada v3",
    "description": (
        "Przypina rozmowę do leada: email LUB wybór po nazwie szansy."
    ),
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
                        "id": "b1000001-1111-4111-8111-111111111101",
                        "name": "leadEmail",
                        "type": "TEXT",
                        "label": "Email leada",
                        "placeholder": "np. jan@firma.pl",
                        "settings": {},
                    },
                    {
                        "id": "b1000001-1111-4111-8111-111111111102",
                        "name": "targetOpportunity",
                        "type": "RECORD",
                        "label": "albo lead po nazwie",
                        "placeholder": "Wyszukaj szansę po nazwie",
                        "settings": {"objectName": "opportunity"},
                    },
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
                        f'"email":"{{{{{STEP_FORM}.leadEmail}}}}",'
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

# Live sandbox:
# v1 cb93c9be-1e8b-47cd-b977-602d7373d100 Opportunity only — DEACTIVATED
# v2 7992f4fb-f1fa-4ad3-9dc6-5bca4b671904 Person picker — DEACTIVATED
# v3 371933d7-f3da-4bb0-b1ce-aaff754b97ec
#    version 6972db5d-49c3-463f-944f-4294e78f272a — email TEXT + Opportunity name — ACTIVE

if __name__ == "__main__":
    import json

    print(json.dumps(WORKFLOW_SPEC, indent=2, ensure_ascii=False))
