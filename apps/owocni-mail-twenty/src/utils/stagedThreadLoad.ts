import { collectHostHrefs } from 'src/utils/hostMailContext';

/**
 * Flip to false to restore the pre-split single `/mail/picker-data` fetch.
 * URL kill-switch (no redeploy): `?owocniMailLoad=full` on the host page.
 */
export const STAGED_THREAD_LOAD = true;

export const MAIL_LOAD_QUERY_PARAM = 'owocniMailLoad';

export function hrefsWantFullMailLoad(hrefs: string[]): boolean {
  return hrefs.some((href) => {
    try {
      return (
        new URL(href, 'https://owocni.local').searchParams.get(
          MAIL_LOAD_QUERY_PARAM,
        ) === 'full'
      );
    } catch {
      return /[?&]owocniMailLoad=full(?:&|#|$)/i.test(href);
    }
  });
}

export function shouldUseStagedThreadLoad(options: {
  enabled?: boolean;
  hrefs?: string[];
  onRecordSurface: boolean;
}): boolean {
  if (!(options.enabled ?? STAGED_THREAD_LOAD)) {
    return false;
  }
  if (!options.onRecordSurface) {
    return false;
  }
  if (hrefsWantFullMailLoad(options.hrefs ?? collectHostHrefs())) {
    return false;
  }
  return true;
}
