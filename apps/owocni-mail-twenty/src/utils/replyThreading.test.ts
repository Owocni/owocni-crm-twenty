import { describe, expect, it } from 'vitest';

import {
  decideInReplyTo,
  participantHandlesMatchRecipient,
} from './replyThreading';

describe('participantHandlesMatchRecipient', () => {
  it('matches case-insensitively', () => {
    expect(
      participantHandlesMatchRecipient(
        ['Marta@owocni.pl', 'klient@firma.pl'],
        'KLIENT@firma.pl',
      ),
    ).toBe(true);
  });

  it('rejects a different address', () => {
    expect(
      participantHandlesMatchRecipient(
        ['inny@firma.pl', 'marta@owocni.pl'],
        'klient@firma.pl',
      ),
    ).toBe(false);
  });
});

describe('decideInReplyTo', () => {
  it('threads when recipient is on the message', () => {
    const decided = decideInReplyTo({
      recipientEmail: 'klient@firma.pl',
      headerMessageId: '<abc@mail.owocni.pl>',
      participantHandles: ['klient@firma.pl', 'marta@owocni.pl'],
    });

    expect(decided).toEqual({
      ok: true,
      headerMessageId: '<abc@mail.owocni.pl>',
    });
  });

  it('does not thread a workspace-latest message that belongs to someone else', () => {
    const decided = decideInReplyTo({
      recipientEmail: 'ten-lead@firma.pl',
      headerMessageId: '<other-thread@mail.owocni.pl>',
      participantHandles: ['kto-inny@firma.pl', 'gosia@owocni.pl'],
    });

    expect(decided).toEqual({
      ok: false,
      reason: 'recipient-not-on-message',
    });
  });

  it('does not thread without RFC Message-ID', () => {
    const decided = decideInReplyTo({
      recipientEmail: 'klient@firma.pl',
      headerMessageId: '  ',
      participantHandles: ['klient@firma.pl'],
    });

    expect(decided).toEqual({ ok: false, reason: 'no-header-id' });
  });
});
