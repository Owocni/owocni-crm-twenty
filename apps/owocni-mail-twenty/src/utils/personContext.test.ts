import { describe, expect, it } from 'vitest';

import {
  directionFromFromParticipant,
  directionFromMessage,
  extractEmailFromHandle,
} from './personContext';

describe('extractEmailFromHandle', () => {
  it('pulls the address out of a display-name handle', () => {
    expect(extractEmailFromHandle('Marta Kowalska <marta@owocni.pl>')).toBe(
      'marta@owocni.pl',
    );
  });
});

describe('directionFromFromParticipant', () => {
  it('marks workspace-member FROM as outbound', () => {
    expect(
      directionFromFromParticipant({
        workspaceMemberId: 'wm-1',
        handle: 'marta@owocni.pl',
      }),
    ).toBe('out');
  });

  it('marks internal mailbox FROM as outbound even without member id', () => {
    expect(
      directionFromFromParticipant({
        workspaceMemberId: null,
        handle: 'leads@owocni.pl',
      }),
    ).toBe('out');
  });

  it('marks quoted internal FROM as outbound', () => {
    expect(
      directionFromFromParticipant({
        workspaceMemberId: null,
        handle: '"Marta Owocni" <marta@owocni.pl>',
      }),
    ).toBe('out');
  });

  it('marks client FROM as inbound', () => {
    expect(
      directionFromFromParticipant({
        workspaceMemberId: null,
        handle: 'klient@firma.pl',
      }),
    ).toBe('in');
  });
});

describe('directionFromMessage', () => {
  it('prefers stored Message.direction OUTGOING', () => {
    expect(
      directionFromMessage({
        direction: 'OUTGOING',
        participants: [
          { role: 'from', handle: 'klient@firma.pl', workspaceMemberId: null },
        ],
      }),
    ).toBe('out');
  });

  it('reads SELECT object { value: OUTGOING }', () => {
    expect(
      directionFromMessage({
        direction: { value: 'OUTGOING' },
        participants: [],
      }),
    ).toBe('out');
  });

  it('treats lowercase GraphQL from-role as inbound when client sent it', () => {
    expect(
      directionFromMessage({
        participants: [
          { role: 'from', handle: 'klient@firma.pl', workspaceMemberId: null },
        ],
      }),
    ).toBe('in');
  });

  it('treats lowercase from-role + internal handle as outbound', () => {
    expect(
      directionFromMessage({
        participants: [
          {
            role: 'from',
            handle: 'gosia@owocni.pl',
            workspaceMemberId: null,
          },
          { role: 'to', handle: 'klient@firma.pl', workspaceMemberId: null },
        ],
      }),
    ).toBe('out');
  });

  it('uses the client parent role TO as outbound when FROM is missing', () => {
    expect(
      directionFromMessage({
        participants: [
          { role: 'to', handle: 'klient@firma.pl', workspaceMemberId: null },
        ],
        parentParticipant: {
          role: 'to',
          handle: 'klient@firma.pl',
          workspaceMemberId: null,
        },
      }),
    ).toBe('out');
  });

  it('uses the client parent role FROM as inbound when FROM list is empty', () => {
    expect(
      directionFromMessage({
        participants: [],
        parentParticipant: {
          role: 'FROM',
          handle: 'klient@firma.pl',
          workspaceMemberId: null,
        },
      }),
    ).toBe('in');
  });
});
