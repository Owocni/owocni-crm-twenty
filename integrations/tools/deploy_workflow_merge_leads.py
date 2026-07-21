#!/usr/bin/env python3
"""Deploy Twenty MANUAL workflow: Scal z leadem (Opportunity merge)."""
# Prefer Twenty MCP create_complete_workflow — GraphQL API key often returns 403.
# This script documents the intended graph for manual/MCP deploy.

WORKER_URL = "https://twenty-crm-worker-sandbox-hsxlhvflrq-lm.a.run.app/"

WORKFLOW_SPEC = {
    "name": "Opp · Scal z leadem v2",
    "description": "Scala bieżący lead z wybranym z listy (picker Opportunity).",
    "activate": True,
    "trigger": {
        "name": "Scal z leadem",
        "type": "MANUAL",
        "settings": {
            "icon": "IconGitMerge",
            "isPinned": True,
            "objectType": "opportunity",
            "availability": {
                "type": "SINGLE_RECORD",
                "objectNameSingular": "opportunity",
            },
            "outputSchema": {},
        },
    },
    "steps": [
        {
            "id": "c8000002-2222-4222-8222-222222222001",
            "name": "Wybierz lead docelowy",
            "type": "FORM",
            "valid": True,
            "settings": {
                "input": [
                    {
                        "id": "c8000002-2222-4222-8222-222222222101",
                        "name": "survivorOpportunity",
                        "type": "RECORD",
                        "label": "Lead docelowy (do którego scalamy)",
                        "placeholder": "Wyszukaj istniejącą szansę",
                        "settings": {"objectName": "opportunity"},
                    },
                    {
                        "id": "c8000002-2222-4222-8222-222222222102",
                        "name": "reason",
                        "type": "TEXT",
                        "label": "Powód (opcjonalnie)",
                        "placeholder": "np. ta sama firma / ten sam decydent",
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
            "id": "c8000002-2222-4222-8222-222222222002",
            "name": "POST merge_leads",
            "type": "HTTP_REQUEST",
            "valid": True,
            "settings": {
                "input": {
                    "url": WORKER_URL,
                    "method": "POST",
                    "headers": {"Content-Type": "application/json"},
                    "body": (
                        '{"action":"merge_leads","environment":"sandbox","data":{'
                        '"loserOpportunityId":"{{trigger.payload.id}}",'
                        '"survivorOpportunityId":"{{c8000002-2222-4222-8222-222222222001.survivorOpportunity.id}}",'
                        '"reason":"{{c8000002-2222-4222-8222-222222222001.reason}}"'
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

if __name__ == "__main__":
    import json

    print(json.dumps(WORKFLOW_SPEC, indent=2, ensure_ascii=False))
    print(
        "\n# Deploy via Twenty MCP: create_complete_workflow with this graph "
        "(body as JSON string). GraphQL API key often 403.",
        file=__import__("sys").stderr,
    )
