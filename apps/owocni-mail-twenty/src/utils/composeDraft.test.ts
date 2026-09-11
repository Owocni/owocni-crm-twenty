import { describe, expect, it } from 'vitest';

import {
  composeDraftKey,
  isComposeDraftKey,
  isMeaningfulComposeDraft,
  mergeComposeDraft,
  parseComposeDraft,
  serializeComposeDraft,
} from './composeDraft';

describe('composeDraftKey', () => {
  it('keys a draft by salesperson and lead, ignoring email case', () => {
    expect(composeDraftKey('opp-1', 'Marta@owocni.pl')).toBe(
      composeDraftKey('opp-1', 'marta@owocni.pl'),
    );
    expect(composeDraftKey('opp-1', 'marta@owocni.pl')).toContain('opp-1');
    expect(isComposeDraftKey(composeDraftKey('opp-1', 'marta@owocni.pl')!)).toBe(
      true,
    );
  });

  it('returns null without a record or user', () => {
    expect(composeDraftKey('', 'marta@owocni.pl')).toBeNull();
    expect(composeDraftKey('opp-1', '  ')).toBeNull();
    expect(isComposeDraftKey('send:abc')).toBe(false);
  });

  it('keeps two salespeople on the same lead apart', () => {
    expect(composeDraftKey('opp-1', 'marta@owocni.pl')).not.toBe(
      composeDraftKey('opp-1', 'gosia@owocni.pl'),
    );
  });
});

describe('parseComposeDraft', () => {
  it('reads a JSON envelope and raw HTML fallback', () => {
    const json = serializeComposeDraft({
      v: 1,
      html: '<p>Cześć</p>',
      subject: 'Re: logo',
      cc: 'ewa@owocni.pl',
    });

    expect(parseComposeDraft(json)).toMatchObject({
      html: '<p>Cześć</p>',
      subject: 'Re: logo',
      cc: 'ewa@owocni.pl',
    });
    expect(parseComposeDraft('<p>sam HTML</p>')).toEqual({
      v: 1,
      html: '<p>sam HTML</p>',
      subject: '',
    });
    expect(parseComposeDraft('cancelled')).toBeNull();
    expect(parseComposeDraft('')).toBeNull();
  });
});

describe('mergeComposeDraft', () => {
  it('lets iframe HTML land without wiping subject from the parent', () => {
    const merged = mergeComposeDraft(
      {
        v: 1,
        html: '<p>stary</p>',
        subject: 'Re: oferta',
        cc: 'a@owocni.pl',
      },
      { html: '<p>nowy tekst</p>' },
    );

    expect(merged.html).toBe('<p>nowy tekst</p>');
    expect(merged.subject).toBe('Re: oferta');
    expect(merged.cc).toBe('a@owocni.pl');
  });

  it('lets parent meta land without wiping HTML', () => {
    const merged = mergeComposeDraft(
      { v: 1, html: '<p>treść</p>', subject: 'Re: a' },
      { subject: 'Re: b', cc: 'gosia@owocni.pl' },
    );

    expect(merged.html).toBe('<p>treść</p>');
    expect(merged.subject).toBe('Re: b');
    expect(merged.cc).toBe('gosia@owocni.pl');
  });
});

describe('isMeaningfulComposeDraft', () => {
  it('ignores signature-only bodies and keeps real replies', () => {
    expect(
      isMeaningfulComposeDraft({
        v: 1,
        html: '<p><br></p>',
        subject: 'Re: nic',
      }),
    ).toBe(false);
    expect(
      isMeaningfulComposeDraft({
        v: 1,
        html: '<p>Dzień dobry, wracam z wyceną.</p>',
        subject: 'Re: logo',
      }),
    ).toBe(true);
  });
});
