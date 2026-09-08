import { describe, expect, it } from 'vitest';

import { pickHandoffMessageThreadId } from './attachInternalHandoffThread';

describe('pickHandoffMessageThreadId', () => {
  it('matches the new internal thread by subject, from and to', () => {
    expect(
      pickHandoffMessageThreadId({
        subject: '[Wewnętrzne] Logo',
        to: 'damian@owocni.pl',
        from: 'marta@owocni.pl',
        rows: [
          {
            handle: 'damian@owocni.pl',
            role: 'TO',
            message: {
              subject: '[Wewnętrzne] Logo',
              messageThreadId: 'thread-1',
              messageParticipants: {
                edges: [
                  { node: { handle: 'marta@owocni.pl', role: 'FROM' } },
                  { node: { handle: 'damian@owocni.pl', role: 'TO' } },
                ],
              },
            },
          },
        ],
      }),
    ).toBe('thread-1');
  });

  it('treats a Re:/Odp: reply as the same internal thread', () => {
    expect(
      pickHandoffMessageThreadId({
        subject: '[Wewnętrzne] Logo',
        to: 'damian@owocni.pl',
        from: 'marta@owocni.pl',
        rows: [
          {
            handle: 'damian@owocni.pl',
            role: 'FROM',
            message: {
              subject: 'Re: [Wewnętrzne] Logo',
              messageThreadId: 'thread-1',
              messageParticipants: {
                edges: [
                  { node: { handle: 'damian@owocni.pl', role: 'FROM' } },
                  { node: { handle: 'marta@owocni.pl', role: 'TO' } },
                ],
              },
            },
          },
        ],
      }),
    ).toBe('thread-1');
  });

  it('ignores a different subject or a client in the thread', () => {
    expect(
      pickHandoffMessageThreadId({
        subject: '[Wewnętrzne] Logo',
        to: 'damian@owocni.pl',
        from: 'marta@owocni.pl',
        rows: [
          {
            handle: 'damian@owocni.pl',
            role: 'TO',
            message: {
              subject: 'Re: Logo',
              messageThreadId: 'thread-other',
              messageParticipants: {
                edges: [
                  { node: { handle: 'marta@owocni.pl', role: 'FROM' } },
                  { node: { handle: 'damian@owocni.pl', role: 'TO' } },
                ],
              },
            },
          },
        ],
      }),
    ).toBeNull();
  });
});
