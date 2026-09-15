/** Normalize a Polish mobile for SMSAPI `to=` (digits, country 48, no plus). */

const DIGITS = /\D/g;

export type SmsPhoneResult =
  | { ok: true; e164: string; apiTo: string }
  | { ok: false; error: string };

export function normalizeSmsPhone(raw: string | null | undefined): SmsPhoneResult {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Brak numeru telefonu.' };
  }

  let digits = trimmed.replace(DIGITS, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.length === 9) {
    digits = `48${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('48')) {
    const national = digits.slice(2);
    if (!/^[5-8]\d{8}$/.test(national)) {
      return { ok: false, error: 'Numer nie wygląda na polski komórkowy.' };
    }

    return {
      ok: true,
      e164: `+${digits}`,
      apiTo: digits,
    };
  }

  return {
    ok: false,
    error: 'Niepoprawny numer. Wpisz 9 cyfr albo +48…',
  };
}

export function formatPersonPhone(input: {
  primaryPhoneNumber?: string | null;
  primaryPhoneCallingCode?: string | null;
}): string {
  const number = String(input.primaryPhoneNumber ?? '').trim();
  if (!number) {
    return '';
  }

  if (number.startsWith('+')) {
    return number;
  }

  const code = String(input.primaryPhoneCallingCode ?? '').trim();
  if (code) {
    return `${code}${number.replace(/^0+/, '')}`;
  }

  return number;
}
