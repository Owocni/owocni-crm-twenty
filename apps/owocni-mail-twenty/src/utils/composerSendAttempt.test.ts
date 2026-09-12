import { describe, expect, it } from 'vitest';

import {
  composerSendAttemptKey,
  hashSendBody,
  parseComposerSendAttempt,
  serializeComposerSendAttempt,
} from './composerSendAttempt';

describe('composerSendAttempt', () => {
  it('hashes the same HTML the same way', () => {
    const html = `<p>${'oferta '.repeat(80)}</p>`;
    expect(hashSendBody(html)).toBe(hashSendBody(html));
    expect(hashSendBody(html)).not.toBe(hashSendBody(`${html}x`));
    expect(hashSendBody(html).length).toBeGreaterThan(0);
    expect(hashSendBody('')).toBe('1505');
    expect(hashSendBody('a')).toBe('2b606');
  });

  it('round-trips attempt records', () => {
    const hash = hashSendBody('<p>cześć</p>');
    const raw = serializeComposerSendAttempt('sent', hash);
    expect(parseComposerSendAttempt(raw)).toEqual({
      status: 'sent',
      bodyHash: hash,
    });
    expect(composerSendAttemptKey('abc')).toBe('v2attempt:abc');
  });
});
