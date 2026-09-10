import { describe, expect, it } from 'vitest';

import {
  assertInternalHandoffRecipients,
  injectHandoffMarker,
  quoteClientMessageHtml,
  textHasHandoffMarker,
  threadChannelLabel,
  toInternalHandoffSubject,
} from './internalHandoff';

describe('toInternalHandoffSubject', () => {
  it('prefixes a client subject once', () => {
    expect(toInternalHandoffSubject('Re: Wycena')).toBe(
      '[Wewnętrzne] Re: Wycena',
    );
    expect(toInternalHandoffSubject('[Wewnętrzne] Re: Wycena')).toBe(
      '[Wewnętrzne] Re: Wycena',
    );
  });
});

describe('assertInternalHandoffRecipients', () => {
  it('accepts a single owocni address', () => {
    expect(
      assertInternalHandoffRecipients({
        to: 'damian@owocni.pl',
        clientEmail: 'klient@firma.pl',
      }),
    ).toEqual({ ok: true, to: 'damian@owocni.pl' });
  });

  it('rejects the client in To or CC', () => {
    expect(
      assertInternalHandoffRecipients({
        to: 'klient@firma.pl',
        clientEmail: 'klient@firma.pl',
      }).ok,
    ).toBe(false);
    expect(
      assertInternalHandoffRecipients({
        to: 'damian@owocni.pl',
        cc: 'klient@firma.pl',
        clientEmail: 'klient@firma.pl',
      }).ok,
    ).toBe(false);
  });

  it('accepts a freelancer address outside @owocni.pl', () => {
    expect(
      assertInternalHandoffRecipients({
        to: 'ania@gmail.com',
        clientEmail: 'klient@firma.pl',
      }),
    ).toEqual({ ok: true, to: 'ania@gmail.com' });
  });

  it('rejects an invalid address', () => {
    const result = assertInternalHandoffRecipients({
      to: 'nie-email',
      clientEmail: 'klient@firma.pl',
    });
    expect(result.ok).toBe(false);
  });
});

describe('threadChannelLabel', () => {
  it('uses internal copy instead of client Od nas/Do nas', () => {
    expect(threadChannelLabel('internal', 'out')).toBe('Wewnętrzny · od nas');
    expect(threadChannelLabel('internal', 'in')).toBe('Wewnętrzny · do nas');
    expect(threadChannelLabel('client', 'out')).toBe('Od nas');
  });

  it('labels a bounce so it is not a client reply', () => {
    expect(threadChannelLabel('bounce', 'in', 'invalid')).toBe(
      'Zwrotka · niepoprawny adres',
    );
    expect(threadChannelLabel('bounce', 'in', 'undelivered')).toBe(
      'Zwrotka · nie dostarczono',
    );
  });
});

describe('handoff marker', () => {
  it('injects a marker that survives plaintext extraction', () => {
    const html = injectHandoffMarker('<p>treść</p>', 'opp-1');
    expect(html).toContain('owocni-handoff:opp-1');
    expect(textHasHandoffMarker(html, 'opp-1')).toBe(true);
  });
});

describe('quoteClientMessageHtml', () => {
  it('does not put the client address in a mailto that would send', () => {
    const html = quoteClientMessageHtml({
      fromLabel: 'Jan',
      fromEmail: 'klient@firma.pl',
      subject: 'Logo',
      text: 'Proszę o wycenę',
    });
    expect(html).toContain('klient tego maila nie dostaje');
    expect(html).toContain('Proszę o wycenę');
    expect(html).not.toContain('mailto:');
  });
});
