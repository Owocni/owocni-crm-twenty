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

export type HostRecordSurface = 'show' | 'index' | 'unknown';

function pathnameFromHref(href: string): string {
  try {
    return new URL(href).pathname;
  } catch {
    return href;
  }
}

/** First href wins — pass top/parent before iframe so kanban side panel stays 'index'. */
export function hostRecordSurfaceFromHrefs(hrefs: string[]): HostRecordSurface {
  for (const href of hrefs) {
    const pathname = pathnameFromHref(href);
    if (/\/objects\//i.test(pathname) || /\/objects\//i.test(href)) {
      return 'index';
    }
    if (OBJECT_PATH_RE.test(pathname) || OBJECT_PATH_RE.test(href)) {
      return 'show';
    }
  }

  return 'unknown';
}

export function readHostRecordSurface(): HostRecordSurface {
  const hrefs: string[] = [];
  for (const href of [
    safeReadHref(globalThis.top?.location),
    safeReadHref(globalThis.parent?.location),
    safeReadHref(globalThis.location),
  ]) {
    if (href && !hrefs.includes(href)) {
      hrefs.push(href);
    }
  }
  return hostRecordSurfaceFromHrefs(hrefs);
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

const COMPOSE_INTENT_KEY = 'owocni-mail-compose-intent-v1';
/** Only the hop after Odpowiedz — leftover must not survive the next card click. */
export const COMPOSE_NAV_WINDOW_MS = 20_000;
export const MAIL_COMPOSE_QUERY_PARAM = 'owocniCompose';
/** Lejek Owocni — breadcrumb Opportunities reads this viewId from the record URL. */
export const LEJEK_OWOCNI_VIEW_ID = 'ba6ac841-c293-4744-855b-3a99ee135743';
export const VIEW_ID_QUERY_PARAM = 'viewId';

/** Same tab UUID as the Mail page-layout tab — hash focuses it on the full page. */
export const OPPORTUNITY_MAIL_TAB_HASH = 'ccf6a315-7856-471d-8ed6-125f27d8ff96';

export function buildOpportunityRecordShowPath(recordId: string): string {
  const params = new URLSearchParams({
    [MAIL_COMPOSE_QUERY_PARAM]: '1',
    [VIEW_ID_QUERY_PARAM]: LEJEK_OWOCNI_VIEW_ID,
  });
  return `/object/opportunity/${recordId}?${params.toString()}#${OPPORTUNITY_MAIL_TAB_HASH}`;
}

export function buildOpportunityRecordShowUrl(
  origin: string,
  recordId: string,
): string {
  const base = origin.replace(/\/$/, '');
  return `${base}${buildOpportunityRecordShowPath(recordId)}`;
}

/**
 * Side panel is typically ~400–500px. Full record Mail canvas is much wider.
 * Opaque-origin FCs often cannot read `/objects/` vs `/object/` — width is
 * the reliable signal. Unknown + no width defaults to side panel so we never
 * dump the composer into the drawer.
 */
export const MAIL_FULL_PAGE_MIN_PX = 720;

export function isSidePanelMailSurface(args: {
  surface: HostRecordSurface;
  width: number;
  fullPageMinPx?: number;
}): boolean {
  if (args.surface === 'index') {
    return true;
  }
  if (args.surface === 'show') {
    return false;
  }
  const min = args.fullPageMinPx ?? MAIL_FULL_PAGE_MIN_PX;
  return args.width < min;
}

/**
 * Break out of the side-panel iframe/surface onto the host tab.
 * `window.open(_top)` is often blocked; a same-gesture `<a target="_top">`
 * is what browsers treat as user-initiated top navigation.
 */
export function breakOutToHostUrl(url: string): boolean {
  if (typeof document === 'undefined' || !url) {
    return false;
  }

  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_top';
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return true;
  } catch {
    return false;
  }
}

export function hostIsKanbanIndex(): boolean {
  return readHostRecordSurface() === 'index';
}

export function hostWindowWantsMailCompose(): boolean {
  const hrefs: string[] = [];
  for (const href of [
    safeReadHref(globalThis.top?.location),
    safeReadHref(globalThis.parent?.location),
    safeReadHref(globalThis.location),
  ]) {
    if (href && !hrefs.includes(href)) {
      hrefs.push(href);
    }
  }
  if (hostRecordSurfaceFromHrefs(hrefs) === 'index') {
    return false;
  }
  return hostHrefsWantMailCompose(hrefs);
}

type MailComposeIntent = {
  recordId: string;
  at: number;
};

export function markMailComposeIntent(recordId: string): void {
  try {
    globalThis.sessionStorage?.setItem(
      COMPOSE_INTENT_KEY,
      JSON.stringify({ recordId, at: Date.now() } satisfies MailComposeIntent),
    );
  } catch {
    // ignore
  }
}

export function clearMailComposeIntent(): void {
  try {
    globalThis.sessionStorage?.removeItem(COMPOSE_INTENT_KEY);
  } catch {
    // ignore
  }
}

function readStoredComposeIntent(): MailComposeIntent | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(COMPOSE_INTENT_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as MailComposeIntent;
    if (!parsed?.recordId || typeof parsed.recordId !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * One-shot: the full record page after Odpowiedz may consume this.
 * Opening a lead later (side panel) drops leftovers and stays in peek.
 */
export function consumeMailComposeIntent(recordId: string | null): boolean {
  if (!recordId) {
    return false;
  }

  const stored = readStoredComposeIntent();
  if (!stored) {
    return false;
  }

  if (stored.recordId !== recordId) {
    clearMailComposeIntent();
    return false;
  }

  clearMailComposeIntent();

  const age = Date.now() - Number(stored.at || 0);
  return age >= 0 && age <= COMPOSE_NAV_WINDOW_MS;
}

export function hostHrefsWantMailCompose(hrefs: string[]): boolean {
  return hrefs.some(
    (href) =>
      href.includes(`${MAIL_COMPOSE_QUERY_PARAM}=1`) ||
      href.includes(`${MAIL_COMPOSE_QUERY_PARAM}=true`),
  );
}

// Silence unused — kept for potential future URL body scans.
void UUID_ONLY_RE;
