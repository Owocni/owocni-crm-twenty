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

export function readStringField(
  payload: Record<string, unknown>,
  ...keys: string[]
): string {
  const objects: Record<string, unknown>[] = [payload];

  for (const nestedKey of ['data', 'payload', 'input']) {
    const nested = payload[nestedKey];

    if (nested !== null && typeof nested === 'object' && !Array.isArray(nested)) {
      objects.push(nested as Record<string, unknown>);
    }
  }

  for (const object of objects) {
    for (const key of keys) {
      const value = object[key];

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
  }

  return '';
}
