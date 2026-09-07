import { describe, expect, it } from 'vitest';

import {
  computeSqlFields,
  isRejectionReason,
  rejectedChipLabel,
  replyQueueStatus,
  sqlConfirmedChipLabel,
} from './opportunityActions';

describe('computeSqlFields', () => {
  const now = new Date('2026-09-04T10:00:00.000Z');

  it('moves an open deal to QUALIFIED and stamps SQL time', () => {
    expect(
      computeSqlFields({
        createdAt: '2026-09-04T04:00:00.000Z',
        qualifiedAt: null,
        currentStage: 'CONTACTED',
        now,
      }),
    ).toEqual({
      stage: 'QUALIFIED',
      qualifiedAt: '2026-09-04T10:00:00.000Z',
      hoursToQualified: 6,
      bizSqlConfirmedAt: '2026-09-04T10:00:00.000Z',
      bizSqlConfirmed: true,
    });
  });

  it('keeps WON/LOST stage and reuses existing qualifiedAt', () => {
    expect(
      computeSqlFields({
        createdAt: '2026-09-01T10:00:00.000Z',
        qualifiedAt: '2026-09-02T10:00:00.000Z',
        currentStage: 'WON',
        now,
      }),
    ).toMatchObject({
      stage: 'WON',
      qualifiedAt: '2026-09-02T10:00:00.000Z',
      hoursToQualified: 24,
      bizSqlConfirmed: true,
    });
  });
});

describe('labels', () => {
  it('accepts workflow rejection reasons', () => {
    expect(isRejectionReason('BUDGET')).toBe(true);
    expect(isRejectionReason('nope')).toBe(false);
  });

  it('falls back when SQL has no timestamp', () => {
    expect(sqlConfirmedChipLabel(null)).toBe('SQL przyjęty');
  });

  it('shows rejection reason without inventing a date', () => {
    expect(rejectedChipLabel('SPAM')).toBe('Odrzucony · Spam');
  });
});

describe('replyQueueStatus', () => {
  const now = new Date('2026-09-04T12:00:00.000Z');

  it('marks a follow-up as Do odpisania', () => {
    expect(
      replyQueueStatus({
        isFollowUp: true,
        snoozeUntil: null,
        now,
      }),
    ).toMatchObject({ kind: 'needs_reply', label: 'Do odpisania', tone: 'red' });
  });

  it('marks a future snooze as Odroczone', () => {
    expect(
      replyQueueStatus({
        isFollowUp: false,
        snoozeUntil: '2026-09-08T07:00:00.000Z',
        now,
      }),
    ).toMatchObject({ kind: 'snoozed', label: 'Odroczone', tone: 'blue' });
  });

  it('marks our last move as Czekamy na odpowiedź', () => {
    expect(
      replyQueueStatus({
        isFollowUp: false,
        snoozeUntil: null,
        now,
      }),
    ).toMatchObject({
      kind: 'waiting',
      label: 'Czekamy na odpowiedź',
      tone: 'blue',
    });
  });
});
