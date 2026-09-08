import { describe, expect, it } from 'vitest';

import {
  directionFromFromParticipant,
  directionFromMessage,
  extractEmailFromHandle,
  isInternalMailbox,
  mailboxFromDisplay,
  personFromParticipants,
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

describe('isInternalMailbox', () => {
  it('treats studio@ as internal', () => {
    expect(isInternalMailbox('studio@owocni.pl')).toBe(true);
    expect(isInternalMailbox('Marta <marta@owocni.pl>')).toBe(true);
  });

  it('treats a client address as external', () => {
    expect(isInternalMailbox('biuro@tela.pl')).toBe(false);
  });
});

describe('personFromParticipants', () => {
  it('does not pick Marta/studio@ when the client is also on the mail', () => {
    const person = personFromParticipants([
      {
        role: 'to',
        handle: 'studio@owocni.pl',
        workspaceMemberId: 'wm-marta',
        person: {
          id: 'marta',
          name: { firstName: 'Marta', lastName: 'Słowik' },
          emails: { primaryEmail: 'studio@owocni.pl' },
        },
      },
      {
        role: 'from',
        handle: 'biuro@tela.pl',
        workspaceMemberId: null,
      },
    ]);

    expect(person?.email).toBe('biuro@tela.pl');
  });

  it('prefers the client Person over an internal Person', () => {
    const person = personFromParticipants([
      {
        role: 'to',
        handle: 'studio@owocni.pl',
        person: {
          emails: { primaryEmail: 'studio@owocni.pl' },
          name: { firstName: 'Marta', lastName: 'Słowik' },
        },
      },
      {
        role: 'from',
        handle: 'biuro@tela.pl',
        person: {
          emails: { primaryEmail: 'biuro@tela.pl' },
          name: { firstName: 'TELA', lastName: 'Group' },
        },
      },
    ]);

    expect(person?.email).toBe('biuro@tela.pl');
    expect(person?.firstName).toBe('TELA');
  });
});

describe('mailboxFromDisplay', () => {
  it('shows studio@ not the CRM person Marta', () => {
    expect(
      mailboxFromDisplay({
        handle: 'studio@owocni.pl',
        person: {
          name: { firstName: 'Marta', lastName: 'Słowik' },
          emails: { primaryEmail: 'studio@owocni.pl' },
        },
      }),
    ).toEqual({
      fromEmail: 'studio@owocni.pl',
      fromLabel: 'studio@owocni.pl',
    });
  });

  it('strips a display name on an internal handle', () => {
    expect(
      mailboxFromDisplay({
        handle: 'Marta <studio@owocni.pl>',
        person: { name: { firstName: 'Marta', lastName: 'Słowik' } },
      }),
    ).toEqual({
      fromEmail: 'studio@owocni.pl',
      fromLabel: 'studio@owocni.pl',
    });
  });

  it('keeps the client name for an external FROM', () => {
    expect(
      mailboxFromDisplay({
        handle: 'biuro@tela.pl',
        person: { name: { firstName: 'Jan', lastName: 'Kowalski' } },
      }),
    ).toEqual({
      fromEmail: 'biuro@tela.pl',
      fromLabel: 'Jan Kowalski',
    });
  });
});
