import { describe, expect, it } from 'vitest';

import {
  bounceChannelLabel,
  classifyBounceReason,
  isBounceMessage,
  isBounceSender,
} from './mailBounce';

describe('isBounceMessage', () => {
  it('accepts a DSN from mailer-daemon', () => {
    expect(
      isBounceMessage({
        subject: 'Undelivered Mail Returned to Sender',
        text: 'This is the mail system at host mx.example.net.\nRecipient address rejected: User unknown',
        fromHandle: 'mailer-daemon@mx.example.net',
        fromDisplayName: 'Mail Delivery System',
      }),
    ).toBe(true);
  });

  it('does not treat a client reply as a bounce', () => {
    expect(
      isBounceMessage({
        subject: 'Re: Owocne logo',
        text: 'Dziękuję, oddzwonię.',
        fromHandle: 'klient@firma.pl',
        fromDisplayName: 'Jan',
      }),
    ).toBe(false);
  });
});

describe('isBounceSender', () => {
  it('rejects a named person on postmaster', () => {
    expect(isBounceSender('postmaster@intro.lucasleao.net', 'Hanna Lee')).toBe(
      false,
    );
  });
});

describe('bounceChannelLabel', () => {
  it('uses invalid copy for user-unknown', () => {
    expect(classifyBounceReason('550 5.1.1 User unknown')).toBe('invalid');
    expect(bounceChannelLabel('invalid')).toBe('Zwrotka · niepoprawny adres');
  });

  it('treats theCamels Unrouteable address as invalid', () => {
    expect(
      classifyBounceReason(
        'The following address(es) failed:\n  niepoprawnyadres@wymyslonyadresss.pl\n    Unrouteable address',
      ),
    ).toBe('invalid');
  });
});
