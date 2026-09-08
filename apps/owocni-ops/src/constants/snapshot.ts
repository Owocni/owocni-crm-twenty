import type { HealthItem } from 'src/constants/health-inventory';

/** Publiczny JSON Fazy 2 — bez sekretów. Probe zapisuje przy każdym runie. */
export const HEALTH_SNAPSHOT_URL =
  'https://storage.googleapis.com/owocni-system-health-ui/ui.json';

export type HealthStatus = 'OK' | 'DEGRADED' | 'DOWN' | 'UNKNOWN' | 'SKIP';

export type SnapshotItem = {
  instance: string;
  id: string;
  prio: string;
  status: string;
  detail: string;
};

export type HealthSnapshot = {
  savedAt: string;
  mode?: string;
  overall: string;
  items: SnapshotItem[];
};

const RANK: Record<string, number> = {
  OK: 0,
  SKIP: 0,
  DEGRADED: 1,
  UNKNOWN: 2,
  DOWN: 3,
};

export function isHealthSnapshot(value: unknown): value is HealthSnapshot {
  if (!value || typeof value !== 'object') return false;
  const row = value as HealthSnapshot;
  return typeof row.savedAt === 'string' && Array.isArray(row.items);
}

export function snapshotRowsFor(
  item: HealthItem,
  snapshot: HealthSnapshot | null,
): SnapshotItem[] {
  if (!snapshot) return [];
  return snapshot.items.filter((row) => row.id === item.id);
}

export function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function statusDotColor(status: string): string {
  switch (status) {
    case 'OK':
      return '#16a34a';
    case 'DEGRADED':
      return '#d97706';
    case 'DOWN':
      return '#dc2626';
    default:
      return '#a1a1aa';
  }
}

export function worstDisplayedStatus(rows: SnapshotItem[]): string {
  let worst = 'UNKNOWN';
  let hasKnown = false;
  for (const row of rows) {
    const status = row.status;
    if (status === 'SKIP' || status === 'UNKNOWN' || !status) continue;
    hasKnown = true;
    if ((RANK[status] || 0) > (RANK[worst] || 0)) worst = status;
  }
  return hasKnown ? worst : rows.length ? rows[0].status : 'UNKNOWN';
}
