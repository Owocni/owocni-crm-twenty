export type NewMailHostContext = {
  recordId: string | null;
  source: string | null;
  scrapedEmail: string | null;
  scrapedSubject: string | null;
  candidateRecordIds: string[];
};

const EMPTY_CONTEXT: NewMailHostContext = {
  recordId: null,
  source: null,
  scrapedEmail: null,
  scrapedSubject: null,
  candidateRecordIds: [],
};

/**
 * Nowy mail must not inherit the last opened lead / scrape / cache.
 * Only the record-page hook id (zakładka na karcie) may prefill this lead.
 */
export function isolateNewMailContext(
  surface: string,
  recordPageRecordId?: string | null,
): NewMailHostContext | null {
  if (surface !== 'compose') {
    return null;
  }

  const anchor = recordPageRecordId?.trim() || null;
  if (!anchor) {
    return EMPTY_CONTEXT;
  }

  return {
    recordId: anchor,
    source: 'record',
    scrapedEmail: null,
    scrapedSubject: null,
    candidateRecordIds: [anchor],
  };
}

/** Composer v2: the typed Do field always wins over CRM person email. */
export function resolveOutboundEmail(input: {
  composerV2: boolean;
  customTo: string;
  personEmail?: string | null;
}): string {
  const typed = input.customTo.trim();
  if (input.composerV2) {
    return typed;
  }
  return typed || (input.personEmail ?? '').trim();
}
