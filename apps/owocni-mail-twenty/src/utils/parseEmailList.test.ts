import { describe, expect, it } from 'vitest';

import {
  emailsExcluding,
  formatEmailList,
  formatSendReceipt,
  invalidEmailsInList,
  parseEmailList,
} from './parseEmailList';

describe('parseEmailList', () => {
  it('splits commas and semicolons and lowercases', () => {
    expect(
      parseEmailList('Gosia@owocni.pl; mariusz@owocni.pl, Gosia@owocni.pl'),
    ).toEqual(['gosia@owocni.pl', 'mariusz@owocni.pl']);
  });

  it('ignores empty input', () => {
    expect(parseEmailList('  ')).toEqual([]);
  });
});

describe('invalidEmailsInList', () => {
  it('flags tokens that are not addresses', () => {
    expect(invalidEmailsInList('gosia@owocni.pl, Gosia')).toEqual(['gosia']);
  });
});

describe('emailsExcluding', () => {
  it('drops the To address from DW/UDW', () => {
    expect(
      emailsExcluding(
        ['klient@firma.pl', 'wspolnik@firma.pl'],
        'Klient@firma.pl',
      ),
    ).toEqual(['wspolnik@firma.pl']);
  });
});

describe('formatSendReceipt', () => {
  it('mentions DW but not the hidden UDW addresses', () => {
    expect(
      formatSendReceipt(
        'klient@firma.pl',
        formatEmailList(['wspolnik@firma.pl']),
        'gosia@owocni.pl',
      ),
    ).toBe('Wysłano do klient@firma.pl · DW wspolnik@firma.pl · UDW.');
  });
});
