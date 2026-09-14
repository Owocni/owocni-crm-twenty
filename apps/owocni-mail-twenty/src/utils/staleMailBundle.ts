import {
  OWOCNI_MAIL_VERSION,
  STALE_BUNDLE_RELOAD_PARAM,
} from 'src/constants/appVersion';

export function isStaleMailBundle(
  serverVersion: string | null | undefined,
  baked = OWOCNI_MAIL_VERSION,
): boolean {
  const live = serverVersion?.trim() ?? '';

  if (!live) {
    return false;
  }

  return live !== baked;
}

export type StaleReloadResult = 'reloading' | 'already-tried' | 'blocked';

/**
 * One automatic host reload per server version.
 * Marker lives on the Twenty URL so a null-origin iframe cannot loop.
 */
export function tryReloadStaleHost(
  serverVersion: string,
  topWindow: Window | null | undefined = globalThis.top,
): StaleReloadResult {
  const live = serverVersion.trim();

  if (!live || !topWindow) {
    return 'blocked';
  }

  try {
    const href = topWindow.location.href;
    const url = new URL(href);

    if (url.searchParams.get(STALE_BUNDLE_RELOAD_PARAM) === live) {
      return 'already-tried';
    }

    url.searchParams.set(STALE_BUNDLE_RELOAD_PARAM, live);
    topWindow.location.replace(url.toString());
    return 'reloading';
  } catch {
    return 'blocked';
  }
}
