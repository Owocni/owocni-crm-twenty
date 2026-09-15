import { describe, expect, it } from 'vitest';

import { formatPersonPhone, normalizeSmsPhone } from './smsPhone';
import { SMS_TEMPLATES } from './smsTemplates';

describe('normalizeSmsPhone', () => {
  it('accepts 9-digit Polish mobiles', () => {
    expect(normalizeSmsPhone('790359039')).toEqual({
      ok: true,
      e164: '+48790359039',
      apiTo: '48790359039',
    });
  });

  it('accepts +48 with spaces', () => {
    expect(normalizeSmsPhone('+48 790 359 039')).toEqual({
      ok: true,
      e164: '+48790359039',
      apiTo: '48790359039',
    });
  });

  it('rejects empty and junk', () => {
    expect(normalizeSmsPhone('')).toMatchObject({ ok: false });
    expect(normalizeSmsPhone('123')).toMatchObject({ ok: false });
    expect(normalizeSmsPhone('studio@owocni.pl')).toMatchObject({ ok: false });
  });
});

describe('formatPersonPhone', () => {
  it('joins calling code and national number', () => {
    expect(
      formatPersonPhone({
        primaryPhoneNumber: '790359039',
        primaryPhoneCallingCode: '+48',
      }),
    ).toBe('+48790359039');
  });
});

describe('SMS_TEMPLATES', () => {
  it('keeps four Firmao texts with no placeholders', () => {
    expect(SMS_TEMPLATES).toHaveLength(4);
    expect(SMS_TEMPLATES.map((row) => row.id)).toEqual([
      'oferta-marta',
      'oferta-gosia',
      'przypominajka-gosia',
      'przypominajka-marta',
    ]);
    for (const row of SMS_TEMPLATES) {
      expect(row.body).not.toMatch(/\{\{/);
      expect(row.body.length).toBeGreaterThan(80);
    }
  });
});
