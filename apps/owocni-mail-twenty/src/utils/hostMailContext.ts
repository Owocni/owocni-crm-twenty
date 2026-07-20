const UUID_RE =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

const OBJECT_PATH_RE = new RegExp(
  `\\/object\\/(messageThread|message|person|opportunity|company)\\/(${UUID_RE})`,
  'i',
);

const UUID_ONLY_RE = new RegExp(UUID_RE, 'gi');

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

const STORAGE_KEY = 'owocni-mail-last-context-v1';

const INTERNAL_DOMAINS = ['owocni.pl', 'twenty.com'];

export type CachedMailHostContext = {
  recordId: string;
  email?: string;
  replySubject?: string;
  savedAt: number;
};

export type ScrapedHostContext = {
  recordId: string | null;
  email: string | null;
  replySubject: string | null;
  source: string;
  candidateRecordIds: string[];
};

function safeReadHref(target: Location | undefined): string | null {
  if (!target) {
    return null;
  }

  try {
    return target.href;
  } catch {
    return null;
  }
}

function isInternalEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return INTERNAL_DOMAINS.some(
    (internal) => domain === internal || domain.endsWith(`.${internal}`),
  );
}

export function collectHostHrefs(): string[] {
  const hrefs: string[] = [];

  for (const href of [
    safeReadHref(globalThis.location),
    safeReadHref(globalThis.parent?.location),
    safeReadHref(globalThis.top?.location),
    typeof document !== 'undefined' ? document.referrer || null : null,
  ]) {
    if (href && !hrefs.includes(href)) {
      hrefs.push(href);
    }
  }

  return hrefs;
}

export function extractRecordIdFromHref(href: string): string | null {
  const match = href.match(OBJECT_PATH_RE);
  return match?.[2] ?? null;
}

export function extractRecordIdFromHostUrl(): string | null {
  for (const href of collectHostHrefs()) {
    const id = extractRecordIdFromHref(href);
    if (id) {
      return id;
    }
  }

  return null;
}

/**
 * Null-origin FC cannot read parent location (esp. Firefox without ancestorOrigins).
 * Resource timing sometimes still contains REST/object URLs with record UUIDs.
 */
export function extractRecordIdsFromPerformance(): string[] {
  const found: string[] = [];

  try {
    const entries = performance.getEntriesByType(
      'resource',
    ) as PerformanceResourceTiming[];

    for (const entry of entries.slice(-120)) {
      const name = entry.name || '';
      if (
        !/messageThread|messages?|opportunit|people|person|object\//i.test(name)
      ) {
        continue;
      }

      const objectMatch = name.match(OBJECT_PATH_RE);
      if (objectMatch?.[2]) {
        found.push(objectMatch[2]);
        continue;
      }

      const restMatch = name.match(
        new RegExp(
          `\\/(opportunities|people|messageThreads|messages)\\/(${UUID_RE})`,
          'i',
        ),
      );
      if (restMatch?.[2]) {
        found.push(restMatch[2]);
      }
    }
  } catch {
    // ignore
  }

  return [...new Set(found)];
}

function scrapeEmailsFromDocument(doc: Document): string | null {
  const found: string[] = [];

  try {
    for (const anchor of Array.from(doc.querySelectorAll('a[href^="mailto:"]'))) {
      const href = anchor.getAttribute('href') ?? '';
      const address = href.replace(/^mailto:/i, '').split('?')[0]?.trim();
      if (address?.includes('@')) {
        found.push(address.toLowerCase());
      }
    }
  } catch {
    // ignore
  }

  try {
    const text = doc.body?.innerText ?? '';
    const matches = text.match(EMAIL_RE) ?? [];
    for (const match of matches) {
      found.push(match.toLowerCase());
    }
  } catch {
    // ignore
  }

  const external = found.find((email) => !isInternalEmail(email));
  return external ?? found[0] ?? null;
}

function scrapeSubjectFromDocument(doc: Document): string | null {
  try {
    const title = doc.title?.trim() ?? '';
    if (/^(re|odp)\s*:/i.test(title)) {
      return title.split(/[—|·•]/)[0]?.trim() || title;
    }

    if (title.includes('Re:') || title.includes('Odp:')) {
      const part = title.split(/[—|·•]/)[0]?.trim();
      if (part) {
        return part;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Reply clears selectedRecordIds, but the main record page URL/DOM usually remains.
 * Same-origin access to window.top is required (Twenty app iframe).
 */
export function scrapeHostMailContext(): ScrapedHostContext {
  let recordId = extractRecordIdFromHostUrl();
  let email: string | null = null;
  let replySubject: string | null = null;
  let source = recordId ? 'url' : 'none';
  const candidateRecordIds = extractRecordIdsFromPerformance();

  try {
    const topWindow = globalThis.top;
    if (topWindow?.document) {
      if (!recordId) {
        const href = safeReadHref(topWindow.location);
        if (href) {
          recordId = extractRecordIdFromHref(href);
          if (recordId) {
            source = 'topUrl';
          }
        }
      }

      email = scrapeEmailsFromDocument(topWindow.document);
      replySubject = scrapeSubjectFromDocument(topWindow.document);

      if (email || replySubject) {
        source = source === 'none' ? 'topDom' : `${source}+dom`;
      }
    }
  } catch {
    // cross-origin — fall through
  }

  // Never promote performance UUIDs to recordId — they are often unrelated
  // GraphQL calls from other pages and caused wrong-lead autofill.
  return {
    recordId,
    email,
    replySubject,
    source,
    candidateRecordIds: recordId
      ? [recordId, ...candidateRecordIds.filter((id) => id !== recordId)]
      : [],
  };
}

export function readCachedMailContext(): CachedMailHostContext | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CachedMailHostContext;
    if (!parsed?.recordId || typeof parsed.recordId !== 'string') {
      return null;
    }

    if (Date.now() - (parsed.savedAt || 0) > 2 * 60 * 60 * 1000) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedMailContext(
  context: Omit<CachedMailHostContext, 'savedAt'>,
): void {
  try {
    globalThis.sessionStorage?.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...context, savedAt: Date.now() }),
    );
  } catch {
    // ignore
  }
}

// Silence unused — kept for potential future URL body scans.
void UUID_ONLY_RE;
