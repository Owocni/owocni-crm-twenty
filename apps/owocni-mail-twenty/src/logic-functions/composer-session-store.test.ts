import { describe, expect, it } from 'vitest';

import {
  dropComposerSession,
  pullComposerSession,
  pushComposerSession,
} from 'src/logic-functions/composer-session-store';
import {
  createComposerSessionTicket,
  isComposerSessionTicket,
} from 'src/utils/composerSessionTicket';

describe('composer session ticket', () => {
  it('issues a 64-char hex ticket', () => {
    const ticket = createComposerSessionTicket();
    expect(isComposerSessionTicket(ticket)).toBe(true);
    expect(ticket).toHaveLength(64);
  });

  it('rejects short tickets', () => {
    expect(isComposerSessionTicket('abc')).toBe(false);
    expect(pushComposerSession({ ticket: 'abc', accessToken: 'tok' })).toEqual({
      ok: false,
      error: 'invalid ticket',
    });
  });

  it('round-trips a pushed token', () => {
    const ticket = createComposerSessionTicket();
    expect(
      pushComposerSession({
        ticket,
        accessToken: 'fresh-token',
        sessionId: 'sess',
      }),
    ).toEqual({ ok: true });
    expect(pullComposerSession(ticket)).toEqual({
      accessToken: 'fresh-token',
      sessionId: 'sess',
    });

    expect(
      pushComposerSession({
        ticket,
        accessToken: 'rotated-token',
        sessionId: 'sess',
      }),
    ).toEqual({ ok: true });
    expect(pullComposerSession(ticket)?.accessToken).toBe('rotated-token');

    dropComposerSession(ticket);
    expect(pullComposerSession(ticket)).toBeNull();
  });
});
