import { SMS_SENDER } from 'src/utils/smsTemplates';

export const SMSAPI_TOKEN_ENV = 'SMSAPI_OAUTH_TOKEN';
const SMSAPI_URL = 'https://api.smsapi.pl/sms.do';
const MASK_MARK = '********';

export type SmsApiResult =
  | { ok: true; id: string; points?: string }
  | { ok: false; error: string };

export function readSmsapiToken(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const raw = String(env[SMSAPI_TOKEN_ENV] ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
  return unwrapDuplicatedSmsapiToken(raw);
}

/** Accidental double-paste in Twenty settings (40+40 → 80). */
export function unwrapDuplicatedSmsapiToken(token: string): string {
  if (token.length < 40 || token.length % 2 !== 0) {
    return token;
  }
  const half = token.length / 2;
  if (token.slice(0, half) === token.slice(half)) {
    return token.slice(0, half);
  }
  return token;
}

/** Length/shape only — never return the secret. */
export function describeSmsapiToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) {
    return 'brak';
  }
  if (trimmed.includes(MASK_MARK) || trimmed.length < 20) {
    return `za krótki albo zamaskowany (${trimmed.length} znaków)`;
  }
  return `${trimmed.length} znaków`;
}

export function smsapiTokenLooksUnusable(token: string): boolean {
  const trimmed = token.trim();
  return !trimmed || trimmed.includes(MASK_MARK) || trimmed.length < 20;
}

function formBody(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join('&');
}

function parseSmsapiPayload(payload: unknown, token: string): SmsApiResult {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'SMSAPI: pusta albo niepoprawna odpowiedź.' };
  }

  const row = payload as {
    error?: unknown;
    message?: unknown;
    list?: Array<{ id?: unknown; points?: unknown }>;
    id?: unknown;
  };

  if (row.error != null && String(row.error) !== '0') {
    const detail =
      typeof row.message === 'string' && row.message.trim()
        ? row.message.trim()
        : `kod ${String(row.error)}`;
    return {
      ok: false,
      error: `SMSAPI: ${detail} (token: ${describeSmsapiToken(token)})`,
    };
  }

  const id = String(row.list?.[0]?.id ?? row.id ?? '').trim();
  if (!id) {
    return { ok: false, error: 'SMSAPI: brak id wiadomości.' };
  }

  const points = String(row.list?.[0]?.points ?? '').trim();
  return { ok: true, id, ...(points ? { points } : {}) };
}

export async function sendSmsViaSmsapi(input: {
  token: string;
  apiTo: string;
  message: string;
  sender?: string;
  fetchImpl?: typeof fetch;
}): Promise<SmsApiResult> {
  const token = input.token.trim();
  if (!token) {
    return { ok: false, error: 'Brak tokenu SMSAPI w aplikacji Twenty.' };
  }
  if (smsapiTokenLooksUnusable(token)) {
    return {
      ok: false,
      error: `Token SMSAPI w Twenty jest ${describeSmsapiToken(token)}. Wklej ponownie OAuth z Bitwardena (nie hasło API).`,
    };
  }

  const message = input.message.trim();
  if (!message) {
    return { ok: false, error: 'Pusta treść SMS.' };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(SMSAPI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // access_token in body: Twenty may strip outbound Authorization.
      body: formBody({
        from: input.sender ?? SMS_SENDER,
        to: input.apiTo,
        message,
        format: 'json',
        encoding: 'utf-8',
        access_token: token,
      }),
    });
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `SMSAPI: sieć (${text})` };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      error: `SMSAPI: HTTP ${response.status}, nie-JSON.`,
    };
  }

  if (!response.ok) {
    const parsed = parseSmsapiPayload(payload, token);
    if (!parsed.ok) {
      return parsed;
    }
    return { ok: false, error: `SMSAPI: HTTP ${response.status}.` };
  }

  return parseSmsapiPayload(payload, token);
}
