#!/usr/bin/env python3
"""E12.5 — deploy Message.direction live workflows (dokumentacja + IDs).

Wdrożone przez Twenty MCP `create_complete_workflow` (API key nie ma
permissions createWorkflow — FORBIDDEN). Ten plik trzyma kontrakt i ID.

Reguła §5.2:
  OUTGOING — bezwarunkowo przy MCMA.created direction=OUTGOING
  INCOMING — tylko gdy Message.direction IS_EMPTY

Aktywne (sandbox 2026-07-28):
  OUTGOING: workflow 2b2d4fbb-0087-410b-a3f6-547ce54d6f40
            version  561bafe4-4f0a-44e9-8ae8-639c063efc39
  INCOMING: workflow e268bd53-e36d-46f6-adff-a1bd5c6fda81  (v2)
            version  f2a0d209-94c7-4100-954b-d8c0e904871b

FILTER variable path: {{<findStepId>.first.direction}} — NIE .records[0].
"""
from __future__ import annotations

import sys

WORKFLOWS = {
    "outgoing": {
        "workflowId": "2b2d4fbb-0087-410b-a3f6-547ce54d6f40",
        "versionId": "561bafe4-4f0a-44e9-8ae8-639c063efc39",
        "name": "E12.5 · Message direction OUTGOING",
    },
    "incoming": {
        "workflowId": "e268bd53-e36d-46f6-adff-a1bd5c6fda81",
        "versionId": "f2a0d209-94c7-4100-954b-d8c0e904871b",
        "name": "E12.5 · Message direction INCOMING v2",
    },
}

FIELD_MCMA_DIRECTION = "40df974f-c40c-4817-9876-cdaac301caa5"
FIELD_MESSAGE_DIRECTION = "1132c3ef-cbc4-4078-a8c4-94ead344518e"
FIELD_MESSAGE_ID = "80bdea20-7116-42a4-8344-02019097dc57"


def main() -> None:
    print("E12.5 Message.direction workflows — already deployed via MCP.")
    print("Re-deploy: use Twenty MCP create_complete_workflow (see runbook §5.5 / §6 krok 9).")
    for k, v in WORKFLOWS.items():
        print(f"  {k}: {v['name']}")
        print(f"         workflow={v['workflowId']}")
        print(f"         version={v['versionId']}")
    print("Backfill: integrations/tools/backfill_message_direction.py --env sandbox")
    sys.exit(0)


if __name__ == "__main__":
    main()
