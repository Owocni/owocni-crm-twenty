export const COMPOSER_V2_STORAGE_KEY = 'owocni.mail.composerV2';
export const COMPOSER_V2_QUERY_PARAM = 'owocniMailV2';

/**
 * Legacy composer is off the UI (Mariusz §13: fallback = Thunderbird).
 * Developer restore: add `?owocniMailV2=0` to the Twenty URL (session only).
 * Back to v2: `?owocniMailV2=1` or a new tab.
 */

function readQueryFlag(): boolean | null {
  try {
    const search = globalThis.location?.search ?? '';
    const value = new URLSearchParams(search).get(COMPOSER_V2_QUERY_PARAM);
    if (value === '1' || value === 'true') {
      return true;
    }
    if (value === '0' || value === 'false') {
      return false;
    }
  } catch {
    // ignore
  }

  return null;
}

function sessionStore(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function writeComposerV2Enabled(enabled: boolean): void {
  const store = sessionStore();

  if (!store) {
    return;
  }

  try {
    if (enabled) {
      store.removeItem(COMPOSER_V2_STORAGE_KEY);
    } else {
      store.setItem(COMPOSER_V2_STORAGE_KEY, '0');
    }
  } catch {
    // ignore
  }
}

export function readComposerV2Enabled(): boolean {
  const fromQuery = readQueryFlag();
  if (fromQuery !== null) {
    writeComposerV2Enabled(fromQuery);
    return fromQuery;
  }

  try {
    if (sessionStore()?.getItem(COMPOSER_V2_STORAGE_KEY) === '0') {
      return false;
    }
  } catch {
    // ignore
  }

  return true;
}

export function isComposerV2Payload(payload: Record<string, unknown>): boolean {
  const value = payload.composerV2;
  return value === true || value === 1 || value === 'true' || value === '1';
}
