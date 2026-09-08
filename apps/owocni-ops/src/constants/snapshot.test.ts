import { describe, expect, it } from 'vitest';

import { HEALTH_ITEMS } from 'src/constants/health-inventory';
import {
  formatSavedAt,
  isHealthSnapshot,
  snapshotRowsFor,
  worstDisplayedStatus,
} from 'src/constants/snapshot';

const snapshot = {
  savedAt: '2026-09-07T09:00:00.000Z',
  overall: 'DOWN',
  items: [
    {
      instance: 'sandbox',
      id: 'H-PLATFORM',
      prio: 'P0',
      status: 'OK',
      detail: 'REST',
    },
    {
      instance: 'prod',
      id: 'H-PLATFORM',
      prio: 'P0',
      status: 'DOWN',
      detail: 'HTTP 401',
    },
    {
      instance: 'shared',
      id: 'H-CALL',
      prio: 'P0',
      status: 'OK',
      detail: 'poller',
    },
  ],
};

describe('snapshot helpers', () => {
  it('accepts probe last.json shape', () => {
    expect(isHealthSnapshot(snapshot)).toBe(true);
    expect(isHealthSnapshot({})).toBe(false);
  });

  it('splits per-instance rows for one catalog id', () => {
    const platform = HEALTH_ITEMS.find((item) => item.id === 'H-PLATFORM');
    expect(platform).toBeDefined();
    const rows = snapshotRowsFor(platform!, snapshot);
    expect(rows.map((row) => row.instance)).toEqual(['sandbox', 'prod']);
    expect(worstDisplayedStatus(rows)).toBe('DOWN');
  });

  it('formats Warsaw clock', () => {
    expect(formatSavedAt('2026-09-07T09:00:00.000Z')).toMatch(/07\.09\.2026/);
  });

  it('leaves catalog ids missing from snapshot empty (UI = UNKNOWN)', () => {
    const call = HEALTH_ITEMS.find((item) => item.id === 'H-CALL');
    expect(snapshotRowsFor(call!, snapshot)).toHaveLength(1);
    const missing = HEALTH_ITEMS.find((item) => item.id === 'H-STAPE');
    expect(snapshotRowsFor(missing!, snapshot)).toEqual([]);
    expect(worstDisplayedStatus([])).toBe('UNKNOWN');
  });
});
