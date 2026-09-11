import { describe, expect, it } from 'vitest';

import {
  computeSqlFields,
  isRejectionReason,
  rejectedChipLabel,
  replyQueueStatus,
  sqlConfirmedChipLabel,
  invoiceActionHints,
  mergeOpportunityActionStatus,
  ENRICH_LABEL_FILL,
  ENRICH_LABEL_REFRESH,
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

describe('invoiceActionHints', () => {
  it('asks for NIP when neither lead nor company has one', () => {
    expect(invoiceActionHints({ companyId: null })).toMatchObject({
      hasNip: false,
      invoiceReady: false,
      enrichHint: 'uzupełnij NIP',
      enrichLabel: ENRICH_LABEL_FILL,
      issueHint: 'Najpierw uzupełnij dane',
    });
  });

  it('enables enrich from lead NIP even without a company', () => {
    expect(
      invoiceActionHints({
        companyId: null,
        opportunityNip: '958-141-41-61',
      }),
    ).toMatchObject({
      hasNip: true,
      nip: '9581414161',
      invoiceReady: false,
      enrichHint: null,
      enrichLabel: ENRICH_LABEL_FILL,
      issueHint: 'Najpierw uzupełnij dane',
    });
  });

  it('prefers lead NIP over company NIP', () => {
    expect(
      invoiceActionHints({
        companyId: 'co-1',
        opportunityNip: '9581414161',
        company: { nip: '1111111111', legalName: '', registeredAddress: {} },
      }),
    ).toMatchObject({
      hasNip: true,
      nip: '9581414161',
    });
  });

  it('falls back to company NIP when the lead NIP is empty', () => {
    expect(
      invoiceActionHints({
        companyId: 'co-1',
        opportunityNip: '',
        company: { nip: '9581414161', legalName: '', registeredAddress: {} },
      }),
    ).toMatchObject({
      hasNip: true,
      nip: '9581414161',
    });
  });

  it('asks for NIP when the company has none', () => {
    expect(
      invoiceActionHints({
        companyId: 'co-1',
        company: { nip: '', legalName: 'X', registeredAddress: { addressCity: 'Gdynia' } },
      }),
    ).toMatchObject({
      hasNip: false,
      invoiceReady: false,
      enrichHint: 'uzupełnij NIP',
      issueHint: 'Najpierw uzupełnij dane',
    });
  });

  it('enables enrich but not issue when only NIP is present', () => {
    expect(
      invoiceActionHints({
        companyId: 'co-1',
        company: { nip: '958-141-41-61', legalName: '', registeredAddress: {} },
      }),
    ).toMatchObject({
      hasNip: true,
      invoiceReady: false,
      enrichHint: null,
      enrichLabel: ENRICH_LABEL_FILL,
      issueHint: 'Najpierw uzupełnij dane',
    });
  });

  it('treats company name as legalName when the registry name is empty', () => {
    expect(
      invoiceActionHints({
        companyId: 'co-1',
        opportunityNip: '8151816198',
        company: {
          name: 'VENTICO SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
          nip: '8151816198',
          legalName: '',
          registeredAddress: {
            addressStreet1: 'ul. Podwale 2/1',
            addressCity: 'Łańcut',
            addressPostcode: '37-100',
          },
        },
      }),
    ).toMatchObject({
      hasNip: true,
      invoiceReady: true,
      enrichLabel: ENRICH_LABEL_REFRESH,
      issueHint: null,
    });
  });

  it('switches the enrich label when KSeF fields are complete', () => {
    expect(
      invoiceActionHints({
        companyId: 'co-1',
        companyName: 'Owocni',
        company: {
          nip: '9581414161',
          legalName: 'OWOCNI.PL - Mariusz Słowik',
          registeredAddress: { addressStreet1: 'ul. Miętowa 66', addressCity: 'Gdynia' },
        },
      }),
    ).toMatchObject({
      hasNip: true,
      invoiceReady: true,
      enrichHint: null,
      enrichLabel: ENRICH_LABEL_REFRESH,
      issueHint: null,
    });
  });
});

describe('mergeOpportunityActionStatus', () => {
  it('keeps null hints instead of empty-state copy', () => {
    expect(
      mergeOpportunityActionStatus('opp-1', {
        hasNip: true,
        invoiceReady: true,
        nip: '8151816198',
        companyId: 'co-1',
        enrichHint: null,
        enrichLabel: ENRICH_LABEL_REFRESH,
        issueHint: null,
      }),
    ).toMatchObject({
      hasNip: true,
      invoiceReady: true,
      enrichHint: null,
      enrichLabel: ENRICH_LABEL_REFRESH,
      issueHint: null,
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
