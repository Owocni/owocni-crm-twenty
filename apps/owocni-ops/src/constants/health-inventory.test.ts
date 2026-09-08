import { describe, expect, it } from 'vitest';

import {
  HEALTH_ITEMS,
  MUST_ON_WORKFLOWS,
  itemsByPrio,
} from 'src/constants/health-inventory';

describe('health inventory', () => {
  it('has unique H-* ids', () => {
    const ids = HEALTH_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers spec §5.2 ids plus H-PLATFORM from the probe', () => {
    const ids = new Set(HEALTH_ITEMS.map((item) => item.id));
    for (const id of [
      'H-PLATFORM',
      'H-CALL',
      'H-MISSED',
      'H-LEAD-FORM',
      'H-LEAD-MAIL',
      'H-LEAD-META',
      'H-MAIL-TPL',
      'H-WF',
      'H-CALL-LINK',
      'H-UPDATE-PERSON',
      'H-INBOUND',
      'H-ROBOT',
      'H-STAPE',
      'H-SYNC',
      'H-MAIL-DIR',
      'H-INVOICE',
      'H-ENRICH',
      'H-MERGE',
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('keeps lead channels as separate P0 rows', () => {
    const leadIds = itemsByPrio('P0')
      .map((item) => item.id)
      .filter((id) => id.startsWith('H-LEAD-'));
    expect(leadIds).toEqual(['H-LEAD-FORM', 'H-LEAD-MAIL', 'H-LEAD-META']);
  });

  it('lists 6 DATABASE + 5 MANUAL MUST_ON workflows', () => {
    const database = MUST_ON_WORKFLOWS.filter((row) => row.kind === 'DATABASE');
    const manual = MUST_ON_WORKFLOWS.filter((row) => row.kind === 'MANUAL');
    expect(database).toHaveLength(6);
    expect(manual).toHaveLength(5);
  });
});
