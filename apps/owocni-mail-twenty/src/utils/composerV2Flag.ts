export const COMPOSER_V2_STORAGE_KEY = 'owocni.mail.composerV2';
export const COMPOSER_V2_QUERY_PARAM = 'owocniMailV2';

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

export function readComposerV2Enabled(): boolean {
  const fromQuery = readQueryFlag();
  if (fromQuery !== null) {
    return fromQuery;
  }

  try {
    const stored = globalThis.localStorage?.getItem(COMPOSER_V2_STORAGE_KEY);
    if (stored === '0' || stored === 'false') {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

export function writeComposerV2Enabled(enabled: boolean): void {
  try {
    globalThis.localStorage?.setItem(
      COMPOSER_V2_STORAGE_KEY,
      enabled ? '1' : '0',
    );
  } catch {
    // ignore
  }
}

export function isComposerV2Payload(payload: Record<string, unknown>): boolean {
  const value = payload.composerV2;
  return value === true || value === 1 || value === 'true' || value === '1';
}
