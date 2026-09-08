/**
 * Inwentarz H-* ze SYSTEM_HEALTH.md §5.2.
 * Katalog H-*. UI nie sondzuje — semafory z snapshotu GCS (Faza 2).
 */

export type HealthPrio = 'P0' | 'P1' | 'P2';
export type HealthScope = 'per-instance' | 'shared';

export type HealthItem = {
  id: string;
  name: string;
  prio: HealthPrio;
  scope: HealthScope;
  check: string;
};

export type MustOnWorkflow = {
  id: string;
  label: string;
  kind: 'DATABASE' | 'MANUAL';
};

/** Probe też raportuje H-PLATFORM (Twenty REST) — nie ma osobnej sekcji w §5.2. */
export const HEALTH_ITEMS: HealthItem[] = [
  {
    id: 'H-PLATFORM',
    name: 'Twenty REST',
    prio: 'P0',
    scope: 'per-instance',
    check: 'Czy API instancji odpowiada (sandbox / prod osobno).',
  },
  {
    id: 'H-CALL',
    name: 'Rozmowy telefoniczne (nagrane)',
    prio: 'P0',
    scope: 'shared',
    check: 'Poller Play + n8n Play PBX ACTIVE + worker ingest. DROP D-15 ≠ awaria.',
  },
  {
    id: 'H-MISSED',
    name: 'Nieodebrane (Play CDR)',
    prio: 'P0',
    scope: 'shared',
    check: 'Ten sam poller co H-CALL; n8n poza ścieżką. Nie sklejać z H-CALL.',
  },
  {
    id: 'H-LEAD-FORM',
    name: 'Leady z formularza (Sortownia)',
    prio: 'P0',
    scope: 'shared',
    check: 'Mail Zapytanie Owocni vs karta OWOCNI_SORTOWNIA (okno 45 min). Nie JuicyLogos.',
  },
  {
    id: 'H-LEAD-MAIL',
    name: 'Leady z leads@',
    prio: 'P0',
    scope: 'per-instance',
    check: 'Sync leads@ + workflow mail notify ACTIVE. kontakt@ świadomie poza CRM.',
  },
  {
    id: 'H-LEAD-META',
    name: 'Leady Meta Instant Form',
    prio: 'P0',
    scope: 'shared',
    check: 'Poll Graph 200. 0 push przy żywym pollu = DEGRADED, nie CAPI.',
  },
  {
    id: 'H-MAIL-TPL',
    name: 'Szablony maili (Owocni Mail)',
    prio: 'P0',
    scope: 'per-instance',
    check: 'App zainstalowana, count szablonów > 0. Nie wracać do Notes.',
  },
  {
    id: 'H-WF',
    name: 'Workflowy MUST_ON',
    prio: 'P1',
    scope: 'per-instance',
    check: '6× DATABASE + MANUAL ACTIVE poza oknem gate (OPS_NOTES §5.3).',
  },
  {
    id: 'H-CALL-LINK',
    name: 'Przypnij / Utwórz lead z rozmowy',
    prio: 'P1',
    scope: 'per-instance',
    check: 'MANUAL Przypnij + Utwórz lead ACTIVE. Ingest (H-CALL) może żyć osobno.',
  },
  {
    id: 'H-UPDATE-PERSON',
    name: 'Backfill idOid po ręcznym leadzie',
    prio: 'P1',
    scope: 'shared',
    check: 'Scheduler workera ENABLED (wspólny z H-LEAD-FORM).',
  },
  {
    id: 'H-INBOUND',
    name: 'Webhook Twenty → Sortownia',
    prio: 'P1',
    scope: 'per-instance',
    check: 'GET /webhooks — webhook OUT istnieje. Nie odpalać inbound CF.',
  },
  {
    id: 'H-ROBOT',
    name: 'robot-task-monitor',
    prio: 'P1',
    scope: 'shared',
    check: 'Scheduler Robota ENABLED + last OK. Nie sklejać z H-INBOUND.',
  },
  {
    id: 'H-STAPE',
    name: 'task_queue / Stape',
    prio: 'P1',
    scope: 'shared',
    check: 'Nie pingujemy Store. UNKNOWN w automacie (budżet).',
  },
  {
    id: 'H-SYNC',
    name: 'Email Sync (zależność)',
    prio: 'P1',
    scope: 'per-instance',
    check: 'Zawsze UNKNOWN w automacie (connectedAccount poza Core API).',
  },
  {
    id: 'H-MAIL-DIR',
    name: 'Kierunek maili 📥/📤',
    prio: 'P1',
    scope: 'shared',
    check: 'GCP worker. Workflow direction OFF = zamierzone — nie włączać.',
  },
  {
    id: 'H-INVOICE',
    name: 'Faktury',
    prio: 'P2',
    scope: 'per-instance',
    check: 'Issue / webhook Fakturownia. Cisza ≠ CRM martwy.',
  },
  {
    id: 'H-ENRICH',
    name: 'Enrichment firm PL',
    prio: 'P2',
    scope: 'shared',
    check: 'Przycisk/form GUS/KRS — nie cisza leadów.',
  },
  {
    id: 'H-MERGE',
    name: 'Scalanie leadów',
    prio: 'P2',
    scope: 'per-instance',
    check: 'MANUAL Scal z leadem ACTIVE. Nigdy auto.',
  },
];

export const MUST_ON_WORKFLOWS: MustOnWorkflow[] = [
  { id: 'wf-form-notify', label: 'lead · formularz · powiadom owner', kind: 'DATABASE' },
  { id: 'wf-mail-notify', label: 'lead · mail · powiadom owner', kind: 'DATABASE' },
  { id: 'wf-track-stage', label: 'Track Stage Time', kind: 'DATABASE' },
  { id: 'wf-guard-sql', label: 'Opp · guard SQL', kind: 'DATABASE' },
  { id: 'wf-guard-rejected', label: 'Opp · guard odrzucony', kind: 'DATABASE' },
  { id: 'wf-remember-stage', label: 'Opp · zapamiętaj etap przed SQL', kind: 'DATABASE' },
  { id: 'wf-accept-sql', label: 'Przyjmij jako SQL', kind: 'MANUAL' },
  { id: 'wf-reject-lead', label: 'Odrzuć leada', kind: 'MANUAL' },
  { id: 'wf-merge', label: 'Scal z leadem', kind: 'MANUAL' },
  { id: 'wf-pin-call', label: 'Przypnij do leada', kind: 'MANUAL' },
  { id: 'wf-create-from-call', label: 'Utwórz lead', kind: 'MANUAL' },
];

export const HEALTH_DOC_PATH = 'owocni-crm/ops/SYSTEM_HEALTH.md';

export function itemsByPrio(prio: HealthPrio): HealthItem[] {
  return HEALTH_ITEMS.filter((item) => item.prio === prio);
}
