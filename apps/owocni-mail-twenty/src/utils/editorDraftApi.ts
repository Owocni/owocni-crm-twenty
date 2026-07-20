export const EDITOR_DRAFT_PATH = '/s/mail/editor-draft';
export const EDITOR_FRAME_PATH = '/s/mail/editor-frame';

function isHttpOrigin(value: string): boolean {
  return Boolean(value) && value !== 'null' && /^https?:\/\//i.test(value);
}

/**
 * Front components often run with location.origin === "null" (opaque sandbox).
 * RestApiClient still works via process.env.TWENTY_API_URL — reuse that.
 */
export function resolveAppOrigin(): string {
  const candidates: string[] = [];

  const loc = globalThis.location?.origin?.trim() ?? '';
  if (loc) {
    candidates.push(loc);
  }

  try {
    const ancestors = (
      globalThis.location as Location & { ancestorOrigins?: DOMStringList }
    )?.ancestorOrigins;
    if (ancestors && ancestors.length > 0) {
      const first = ancestors.item(0)?.trim() ?? '';
      if (first) {
        candidates.push(first);
      }
    }
  } catch {
    // ignore
  }

  try {
    const referrer = globalThis.document?.referrer?.trim() ?? '';
    if (referrer) {
      candidates.push(new URL(referrer).origin);
    }
  } catch {
    // ignore
  }

  try {
    const apiUrl = globalThis.process?.env?.TWENTY_API_URL?.trim() ?? '';
    if (apiUrl) {
      candidates.push(new URL(apiUrl).origin);
    }
  } catch {
    // ignore
  }

  // Sandbox workspace fallback (Owocni) — last resort when env is missing.
  candidates.push('https://zany-maroon-panther.twenty.com');

  for (const candidate of candidates) {
    if (isHttpOrigin(candidate)) {
      return candidate.replace(/\/$/, '');
    }
  }

  return '';
}

export function resolveEditorDraftUrl(): string {
  const origin = resolveAppOrigin();

  if (origin) {
    return `${origin}${EDITOR_DRAFT_PATH}`;
  }

  return EDITOR_DRAFT_PATH;
}

export function resolveEditorFrameUrl(
  sessionId: string,
  token: string,
): string {
  const origin = resolveAppOrigin();
  const params = new URLSearchParams({
    sessionId,
    t: String(Date.now()),
  });

  if (token) {
    params.set('token', token);
  }

  const query = params.toString();

  if (origin) {
    return `${origin}${EDITOR_FRAME_PATH}?${query}`;
  }

  return `${EDITOR_FRAME_PATH}?${query}`;
}
