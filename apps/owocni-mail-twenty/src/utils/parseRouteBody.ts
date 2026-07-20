import type { RoutePayload } from 'twenty-sdk/logic-function';

export function parseRouteBody(event: RoutePayload): Record<string, unknown> {
  const raw = event.body;

  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  const rawString =
    typeof raw === 'string'
      ? raw
      : typeof event.rawBody === 'string'
        ? event.rawBody
        : '';

  if (!rawString.trim()) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(rawString);

    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}

function payloadObjects(
  payload: Record<string, unknown>,
): Record<string, unknown>[] {
  const objects: Record<string, unknown>[] = [payload];

  for (const nestedKey of ['data', 'payload', 'input']) {
    const nested = payload[nestedKey];

    if (nested !== null && typeof nested === 'object' && !Array.isArray(nested)) {
      objects.push(nested as Record<string, unknown>);
    }
  }

  return objects;
}

export function readStringField(
  payload: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const object of payloadObjects(payload)) {
    for (const key of keys) {
      const value = object[key];

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
  }

  return '';
}

function decodeBase64Utf8(value: string): string {
  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

/** Prefer htmlBodyBase64 (avoids host stripping large/HTML bodies), then plain fields. */
export function readClientHtmlBody(payload: Record<string, unknown>): string {
  const encoded = readStringField(payload, 'htmlBodyBase64', 'composedBodyBase64');

  if (encoded) {
    const decoded = decodeBase64Utf8(encoded).trim();

    if (decoded) {
      return decoded;
    }
  }

  return readStringField(
    payload,
    'htmlBody',
    'composedBody',
    'body',
    'messageHtml',
  );
}

/** True when the client explicitly sent a composed-body field (even if empty). */
export function payloadHasClientBody(payload: Record<string, unknown>): boolean {
  const keys = [
    'htmlBody',
    'htmlBodyBase64',
    'composedBody',
    'composedBodyBase64',
    'messageHtml',
  ];

  return payloadObjects(payload).some((object) =>
    keys.some((key) => Object.prototype.hasOwnProperty.call(object, key)),
  );
}
