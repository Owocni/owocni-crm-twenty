# CONTRACT — workflow `first-outbound-response`

> ADR #18 · M2 · Owner: Dawid · Status: **ACTIVE (GCP primary)**

| Pozycja | Wartość |
|---|---|
| Nazwa | First Outbound Response v2 (Twenty — **nie odpala** na `messageChannelMessageAssociation`) |
| **Implementacja produkcyjna** | `integrations/cloud-functions/twenty-crm-worker/workers/advanceNewToContacted.js` |
| workflowId (referencyjny) | `a81a5269-bda8-449d-b1c0-2d16730f0df4` |
| versionId | `6669f5fc-e482-4c7f-b211-4f9d7e14dcf7` |
| logicFunctionId | `f13cac73-17c5-4881-9bf2-ec4ea424e706` |
| Pola | `firstResponseAt` (DATE_TIME), `hoursToFirstResponse` (NUMBER) |
| Trigger | `messageChannelMessageAssociation.created`, filter: `direction IS ["OUTGOING"]` |
| Idempotencja | FIND Opp z `hoursToFirstResponse` IS_EMPTY |

## Definicja M2

```
hoursToFirstResponse = (pierwszy mail WYCHODZĄCY do klienta − createdAt) / 3_600_000
```

## Łańcuch

```
Trigger OUTGOING
  → FIND message (by messageId)
  → FILTER subject NOT "Nowy lead:"
  → FIND messageParticipant TO + personId
  → FILTER handle NOT @owocni.pl
  → FIND opportunity (pointOfContact + M2 empty, newest)
  → CODE
  → UPDATE firstResponseAt, hoursToFirstResponse
```

## Code node

```typescript
export const main = async (params: {
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
};
```

logicFunctionId: `0331ac7b-df64-4224-aed7-c1c1bd817f42`

## Uwagi PF-M2

- **Implementacja:** GCP `advanceNewToContacted.js` (Twenty workflow na `messageChannelMessageAssociation` = 0 runów na instancji).
- Pierwszy outbound z **dowolnej** skrzynki zespołu (nie tylko owner deala).
- Powiadomienia „Nowy lead:" do ownera **pomijane** (nie liczą się jako M2).
- Adresy @owocni.pl pomijane.
- Brak retriggera: zapis M2 nie odpala tego workflow (inny obiekt).

Snapshot: `workflows/snapshots/first-outbound-response.json`
