import { describe, expect, it } from 'vitest';

import {
  quoteForwardedMessageHtml,
  toForwardSubject,
} from './forwardMessage';

describe('toForwardSubject', () => {
  it('prefixes once and keeps existing Fwd/Prz', () => {
    expect(toForwardSubject('Wycena logo')).toBe('Fwd: Wycena logo');
    expect(toForwardSubject('Fwd: Wycena logo')).toBe('Fwd: Wycena logo');
    expect(toForwardSubject('Prz: Wycena logo')).toBe('Prz: Wycena logo');
    expect(toForwardSubject('')).toBe('Fwd:');
  });
});

describe('quoteForwardedMessageHtml', () => {
  it('quotes the original as a regular forward, not an internal handoff', () => {
    const html = quoteForwardedMessageHtml({
      fromLabel: 'Marta',
      fromEmail: 'studio@owocni.pl',
      subject: 'Test zapytania',
      receivedAt: '2026-09-08T06:07:00.000Z',
      text: 'Czy widzisz formatowanie?',
    });

    expect(html).toContain('Przekazana wiadomość');
    expect(html).toContain('studio@owocni.pl');
    expect(html).toContain('Test zapytania');
    expect(html).toContain('Czy widzisz formatowanie?');
    expect(html).not.toContain('klient tego maila nie dostaje');
    expect(html).not.toContain('mailto:');
  });
});
