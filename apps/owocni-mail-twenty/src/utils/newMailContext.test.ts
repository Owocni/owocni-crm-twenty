import { describe, expect, it } from 'vitest';

import { isolateNewMailContext, resolveOutboundEmail } from './newMailContext';

describe('isolateNewMailContext', () => {
  it('does not isolate reply / mailbox surfaces', () => {
    expect(isolateNewMailContext('record-page', 'opp-1')).toBeNull();
    expect(isolateNewMailContext('command-menu', 'opp-1')).toBeNull();
  });

  it('starts blank from left-nav / command menu even if a lead is selected', () => {
    expect(isolateNewMailContext('compose', null)).toEqual({
      recordId: null,
      source: null,
      scrapedEmail: null,
      scrapedSubject: null,
      candidateRecordIds: [],
    });
    expect(isolateNewMailContext('compose', '  ')).toEqual({
      recordId: null,
      source: null,
      scrapedEmail: null,
      scrapedSubject: null,
      candidateRecordIds: [],
    });
  });

  it('allows only the current record-page lead, not scrape/cache', () => {
    expect(isolateNewMailContext('compose', 'opp-inspekcje')).toEqual({
      recordId: 'opp-inspekcje',
      source: 'record',
      scrapedEmail: null,
      scrapedSubject: null,
      candidateRecordIds: ['opp-inspekcje'],
    });
  });
});

describe('resolveOutboundEmail', () => {
  it('never substitutes the CRM person when composer v2 sent a To', () => {
    expect(
      resolveOutboundEmail({
        composerV2: true,
        customTo: 'test10@fastman.eu',
        personEmail: 'biuro@inspekcje.com.pl',
      }),
    ).toBe('test10@fastman.eu');
  });

  it('does not fall back to the lead when composer v2 To is empty', () => {
    expect(
      resolveOutboundEmail({
        composerV2: true,
        customTo: '  ',
        personEmail: 'biuro@inspekcje.com.pl',
      }),
    ).toBe('');
  });

  it('keeps person fallback on the legacy reply path', () => {
    expect(
      resolveOutboundEmail({
        composerV2: false,
        customTo: '',
        personEmail: 'biuro@inspekcje.com.pl',
      }),
    ).toBe('biuro@inspekcje.com.pl');
  });
});
