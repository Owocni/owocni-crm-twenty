import { defineLogicFunction } from 'twenty-sdk/define';

import {
  HEALTH_SNAPSHOT_URL,
  isHealthSnapshot,
} from 'src/constants/snapshot';
import { GET_HEALTH_SNAPSHOT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

/**
 * Odczyt last.json (publiczna kopia). Nie sondzuje workerów / n8n / Twenty.
 * Front woła to gdy fetch GCS z sandboxa padnie (CORS / proxy).
 */
const handler = async () => {
  const response = await fetch(HEALTH_SNAPSHOT_URL, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    return {
      ok: false,
      error: `snapshot HTTP ${response.status}`,
      snapshot: null,
    };
  }
  const body: unknown = await response.json();
  if (!isHealthSnapshot(body)) {
    return { ok: false, error: 'snapshot ma zły kształt', snapshot: null };
  }
  return { ok: true, error: null, snapshot: body };
};

export default defineLogicFunction({
  universalIdentifier: GET_HEALTH_SNAPSHOT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'get-health-snapshot',
  description:
    'Returns the last GCS health snapshot (no live probe). Faza 2 UI fallback.',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/health/snapshot',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
