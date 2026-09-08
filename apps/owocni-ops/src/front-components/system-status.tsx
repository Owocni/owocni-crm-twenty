import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';

import {
  HEALTH_DOC_PATH,
  MUST_ON_WORKFLOWS,
  type HealthItem,
  type HealthPrio,
  itemsByPrio,
} from 'src/constants/health-inventory';
import {
  HEALTH_SNAPSHOT_URL,
  formatSavedAt,
  isHealthSnapshot,
  snapshotRowsFor,
  statusDotColor,
  worstDisplayedStatus,
  type HealthSnapshot,
} from 'src/constants/snapshot';
import { SYSTEM_STATUS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const PRIO_LABEL: Record<HealthPrio, string> = {
  P0: 'P0 — cisza, którą zgłasza sprzedaż',
  P1: 'P1 — proces CRM',
  P2: 'P2 — dodatki',
};

const SCOPE_LABEL: Record<HealthItem['scope'], string> = {
  'per-instance': 'sandbox + prod',
  shared: 'wspólne (GCP / n8n)',
};

const page: CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  padding: '28px 24px 48px',
  boxSizing: 'border-box',
  background: '#fafafa',
  color: '#1a1a1a',
  minHeight: '100%',
};

const card: CSSProperties = {
  maxWidth: 880,
  margin: '0 auto',
  background: '#fff',
  border: '1px solid #e8e8e8',
  borderRadius: 12,
  padding: '28px 24px',
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
};

const banner: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 8,
  background: '#f4f4f5',
  border: '1px solid #e4e4e7',
  fontSize: 13,
  lineHeight: 1.55,
  color: '#3f3f46',
  margin: '0 0 24px',
};

const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '118px 1fr',
  gap: 12,
  padding: '12px 0',
  borderBottom: '1px solid #f0f0f0',
  fontSize: 13,
  lineHeight: 1.5,
};

const idStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  color: '#4338ca',
  fontWeight: 600,
};

async function readSnapshotFromGcs(): Promise<HealthSnapshot> {
  const response = await fetch(HEALTH_SNAPSHOT_URL, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`GCS HTTP ${response.status}`);
  }
  const body: unknown = await response.json();
  if (!isHealthSnapshot(body)) {
    throw new Error('zły kształt snapshotu');
  }
  return body;
}

async function readSnapshotViaApp(): Promise<HealthSnapshot> {
  const body = await new RestApiClient().get<{
    ok?: boolean;
    error?: string | null;
    snapshot?: unknown;
  }>('/s/health/snapshot');
  if (!body?.ok || !isHealthSnapshot(body.snapshot)) {
    throw new Error(body?.error || 'app snapshot pusty');
  }
  return body.snapshot;
}

const ItemRow = ({
  item,
  snapshot,
}: {
  item: HealthItem;
  snapshot: HealthSnapshot | null;
}) => {
  const rows = snapshotRowsFor(item, snapshot);
  const worst = rows.length ? worstDisplayedStatus(rows) : 'UNKNOWN';

  return (
    <div style={rowStyle}>
      <div>
        <div style={idStyle}>{item.id}</div>
        <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>
          {SCOPE_LABEL[item.scope]}
        </div>
      </div>
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: statusDotColor(worst),
              display: 'inline-block',
            }}
          />
          {item.name}
        </div>
        <div style={{ color: '#52525b', marginBottom: 6 }}>{item.check}</div>
        {rows.length === 0 ? (
          <div style={{ fontSize: 12, color: '#a1a1aa' }}>
            Brak w snapshocie (UNKNOWN)
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={`${row.instance}:${row.id}`}
              style={{ fontSize: 12, color: '#3f3f46', marginTop: 4 }}
            >
              <span style={{ color: statusDotColor(row.status), fontWeight: 600 }}>
                {row.status}
              </span>
              {' · '}
              <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>
                {row.instance}
              </span>
              {' · '}
              {row.detail}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const SystemStatusPage = () => {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>('…');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fromGcs = await readSnapshotFromGcs();
        if (!cancelled) {
          setSnapshot(fromGcs);
          setSource('GCS ui.json');
          setError(null);
        }
      } catch (gcsError) {
        try {
          const fromApp = await readSnapshotViaApp();
          if (!cancelled) {
            setSnapshot(fromApp);
            setSource('app GET (kopia GCS)');
            setError(null);
          }
        } catch (appError) {
          if (!cancelled) {
            setError(
              `${gcsError instanceof Error ? gcsError.message : 'GCS'} / ${
                appError instanceof Error ? appError.message : 'app'
              }`,
            );
            setSource('brak');
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const overall = snapshot?.overall || 'UNKNOWN';

  return (
    <div style={page}>
      <div style={card}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
            color: '#52525b',
            marginBottom: 16,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: statusDotColor(overall),
              display: 'inline-block',
            }}
          />
          Semafor całości (P0): {overall}
        </div>

        <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 600 }}>
          Stan systemu
        </h1>
        <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.6, color: '#555' }}>
          Snapshot z GCP probe — ta strona nie sondzuje workerów. Pager DOWN i
          digest 08:00 nadal idą mailem.
        </p>

        <div style={banner}>
          <strong style={{ color: '#18181b' }}>Faza 2.</strong>{' '}
          {snapshot
            ? `Ostatni odczyt: ${formatSavedAt(snapshot.savedAt)} (Warszawa). Źródło: ${source}.`
            : error
              ? `Nie wczytano snapshotu (${error}). Lista poniżej = inwentarz.`
              : 'Wczytuję snapshot…'}{' '}
          Playbook: <code>{HEALTH_DOC_PATH}</code>
        </div>

        {(['P0', 'P1', 'P2'] as HealthPrio[]).map((prio) => (
          <section key={prio} style={{ marginBottom: 28 }}>
            <h2
              style={{
                margin: '0 0 8px',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: '#71717a',
              }}
            >
              {PRIO_LABEL[prio]}
            </h2>
            {itemsByPrio(prio).map((item) => (
              <ItemRow key={item.id} item={item} snapshot={snapshot} />
            ))}
          </section>
        ))}

        <section>
          <h2
            style={{
              margin: '0 0 8px',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: '#71717a',
            }}
          >
            Workflowy MUST_ON
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#52525b' }}>
            Status konkretnych nazw jest w wierszu H-WF (detail). HTTP Stape /
            rejected = OFF zamierzone.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
            {MUST_ON_WORKFLOWS.map((row) => (
              <li key={row.id}>
                <span style={{ color: '#71717a' }}>{row.kind}</span>
                {' · '}
                {row.label}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: SYSTEM_STATUS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'system-status',
  description:
    'Stan dodatków Owocni — semafory z ostatniego snapshotu GCS (Faza 2, bez live probe)',
  component: SystemStatusPage,
});
