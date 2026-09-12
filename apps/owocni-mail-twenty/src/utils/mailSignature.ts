/**
 * Per-mailbox signatures for the Owocni Mail editor only.
 * CRM object `mailSignature` (zakładka Stopki maili) is the editable source.
 * These defaults are fallback when a mailbox has no CRM row yet.
 * Send path must use editor HTML as-is — never call these from send-template-email.
 */

export const SIGNATURE_WRAPPER_ATTR = 'data-owocni-signature';

const MARTA_HTML =
  '<div style="font-size: 13.0px;"><br></div><div style="">Pozdrawiam,<br>Marta Słowik</div><div style=""><br></div><div style=""><strong style=""><br></strong></div><div style=""><strong style="">Owocni.pl</strong><br><em style=""><span style="color: green;">Wierzymy w małe firmy!</span></em><br><br>+48 660 970 980<br><a class="moz-txt-link-abbreviated" href="mailto:studio@owocni.pl" style="">studio@owocni.pl</a><br><a class="moz-txt-link-abbreviated" href="http://www.owocni.pl/" style="">www.owocni.pl</a> <br><br><span style="color: gray;">Bezpieczeństwo klientów zawsze jest dla nas najważniejsze.<br>W związku z rozporządzeniem o ochronie danych osobowych<br>(RODO) 25 V 2018 r. ulegają zmianie polityka prywatności<br>oraz polityka bezpieczeństwa danych osobowych w Owocnych.<br>Szczegóły — <a href="https://www.owocni.pl/polityka-prywatnosci" style="">https://www.owocni.pl/polityka-prywatnosci</a></span></div>';

const GOSIA_HTML =
  '<div style="font-size: 13.0px;"><div style="">Pozdrawiam,<br>Małgorzata Zielińska</div><div style=""><br></div><div style=""><strong style=""><br></strong></div><div style=""><strong style="">Owocni.pl</strong><br><em style=""><span style="color: green;">Wierzymy w małe firmy!</span></em><br><br>+48 570 704 470<br><a class="moz-txt-link-abbreviated" href="mailto:studio@owocni.pl" style="">studio@owocni.pl</a><br><a class="moz-txt-link-abbreviated" href="http://www.owocni.pl/" style="">www.owocni.pl</a> <br><br><span style="color: gray;">Bezpieczeństwo klientów zawsze jest dla nas najważniejsze.<br>W związku z rozporządzeniem o ochronie danych osobowych<br>(RODO) 25 V 2018 r. ulegają zmianie polityka prywatności<br>oraz polityka bezpieczeństwa danych osobowych w Owocnych.<br>Szczegóły — <a href="https://www.owocni.pl/polityka-prywatnosci" style="">https://www.owocni.pl/polityka-prywatnosci</a></span></div></div>';

const POMOC_HTML =
  '<p><strong>Owocni, zawsze pomocni</strong><br><a href="mailto:pomoc@owocni.pl">pomoc@owocni.pl</a></p>';

const OWOCINI_FIRM_HTML =
  '<p>Pozdrawiamy,<br><strong>Owocni.pl</strong><br><em style="color: rgb(56, 118, 29);">Wierzymy w małe firmy!</em></p>';

const MACIEJ_HTML =
  '<div style="font-size: 13.0px;"><br></div><div style="">Pozdrawiam,<br>Maciej Wysocki</div><div style=""><br></div><div style=""><strong style=""><br></strong></div><div style=""><strong style="">Owocni.pl</strong><br><em style=""><span style="color: green;">Wierzymy w małe firmy!</span></em><br><br><a class="moz-txt-link-abbreviated" href="mailto:maciejwysocki@owocni.pl" style="">maciejwysocki@owocni.pl</a><br><a class="moz-txt-link-abbreviated" href="http://www.owocni.pl/" style="">www.owocni.pl</a> <br><br><span style="color: gray;">Bezpieczeństwo klientów zawsze jest dla nas najważniejsze.<br>W związku z rozporządzeniem o ochronie danych osobowych<br>(RODO) 25 V 2018 r. ulegają zmianie polityka prywatności<br>oraz polityka bezpieczeństwa danych osobowych w Owocnych.<br>Szczegóły — <a href="https://www.owocni.pl/polityka-prywatnosci" style="">https://www.owocni.pl/polityka-prywatnosci</a></span></div>';

const EWA_HTML =
  '<div style="font-size: 13.0px;"><br></div><div style="">Pozdrawiam,<br>Ewa Malanowska</div><div style=""><br></div><div style=""><strong style=""><br></strong></div><div style=""><strong style="">Owocni.pl</strong><br><em style=""><span style="color: green;">Wierzymy w małe firmy!</span></em><br><br><a class="moz-txt-link-abbreviated" href="mailto:ewamalanowska@owocni.pl" style="">ewamalanowska@owocni.pl</a><br><a class="moz-txt-link-abbreviated" href="http://www.owocni.pl/" style="">www.owocni.pl</a> <br><br><span style="color: gray;">Bezpieczeństwo klientów zawsze jest dla nas najważniejsze.<br>W związku z rozporządzeniem o ochronie danych osobowych<br>(RODO) 25 V 2018 r. ulegają zmianie polityka prywatności<br>oraz polityka bezpieczeństwa danych osobowych w Owocnych.<br>Szczegóły — <a href="https://www.owocni.pl/polityka-prywatnosci" style="">https://www.owocni.pl/polityka-prywatnosci</a></span></div>';

const ROBERT_HTML =
  '<div style="font-size: 13.0px;"><br></div><div style="">Pozdrawiam,<br>Robert Mańk</div><div style=""><br></div><div style=""><strong style=""><br></strong></div><div style=""><strong style="">Owocni.pl</strong><br><em style=""><span style="color: green;">Wierzymy w małe firmy!</span></em><br><br><a class="moz-txt-link-abbreviated" href="mailto:robertmank@owocni.pl" style="">robertmank@owocni.pl</a><br><a class="moz-txt-link-abbreviated" href="http://www.owocni.pl/" style="">www.owocni.pl</a> <br><br><span style="color: gray;">Bezpieczeństwo klientów zawsze jest dla nas najważniejsze.<br>W związku z rozporządzeniem o ochronie danych osobowych<br>(RODO) 25 V 2018 r. ulegają zmianie polityka prywatności<br>oraz polityka bezpieczeństwa danych osobowych w Owocnych.<br>Szczegóły — <a href="https://www.owocni.pl/polityka-prywatnosci" style="">https://www.owocni.pl/polityka-prywatnosci</a></span></div>';

const MARIUSZ_HTML =
  '<div style="font-size: 13.0px;"><br></div><div style="">Pozdrawiam,<br>Mariusz Słowik</div><div style=""><br></div><div style=""><strong style=""><br></strong></div><div style=""><strong style="">Owocni.pl</strong><br><em style=""><span style="color: green;">Wierzymy w małe firmy!</span></em><br><br><a class="moz-txt-link-abbreviated" href="mailto:mariusz@owocni.pl" style="">mariusz@owocni.pl</a><br><a class="moz-txt-link-abbreviated" href="http://www.owocni.pl/" style="">www.owocni.pl</a> <br><br><span style="color: gray;">Bezpieczeństwo klientów zawsze jest dla nas najważniejsze.<br>W związku z rozporządzeniem o ochronie danych osobowych<br>(RODO) 25 V 2018 r. ulegają zmianie polityka prywatności<br>oraz polityka bezpieczeństwa danych osobowych w Owocnych.<br>Szczegóły — <a href="https://www.owocni.pl/polityka-prywatnosci" style="">https://www.owocni.pl/polityka-prywatnosci</a></span></div>';

export type SignatureCatalog = Record<string, string>;

export type SignatureSeedRecord = {
  name: string;
  mailboxHandle: string;
  bodyHtml: string;
};

export const DEFAULT_SIGNATURE_RECORDS: SignatureSeedRecord[] = [
  {
    name: 'Marta Słowik',
    mailboxHandle: 'marta@owocni.pl',
    bodyHtml: MARTA_HTML,
  },
  {
    name: 'Małgorzata Zielińska',
    mailboxHandle: 'gosia@owocni.pl',
    bodyHtml: GOSIA_HTML,
  },
  {
    name: 'Maciej Wysocki',
    mailboxHandle: 'maciejwysocki@owocni.pl',
    bodyHtml: MACIEJ_HTML,
  },
  {
    name: 'Ewa Malanowska',
    mailboxHandle: 'ewamalanowska@owocni.pl',
    bodyHtml: EWA_HTML,
  },
  {
    name: 'Robert Mańk',
    mailboxHandle: 'robertmank@owocni.pl',
    bodyHtml: ROBERT_HTML,
  },
  {
    name: 'Mariusz Słowik',
    mailboxHandle: 'mariusz@owocni.pl',
    bodyHtml: MARIUSZ_HTML,
  },
  {
    name: 'Pomoc',
    mailboxHandle: 'pomoc@owocni.pl',
    bodyHtml: POMOC_HTML,
  },
  {
    name: 'Owocni (firma)',
    mailboxHandle: 'studio@owocni.pl, leads@owocni.pl',
    bodyHtml: OWOCINI_FIRM_HTML,
  },
];

const SIGNATURE_BLOCK_RE =
  /<section[^>]*data-owocni-signature="1"[^>]*>[\s\S]*?<\/section>/gi;

export function normalizeMailboxHandle(
  handle: string | null | undefined,
): string {
  return (handle ?? '').trim().toLowerCase();
}

export function parseMailboxHandles(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(/[,;]+/)
    .map((part) => normalizeMailboxHandle(part))
    .filter(Boolean);
}

export function catalogFromCrmRows(
  rows: Array<{ mailboxHandle?: string | null; bodyHtml?: string | null }>,
): SignatureCatalog {
  const catalog: SignatureCatalog = {};

  for (const row of rows) {
    const html = (row.bodyHtml ?? '').trim();

    if (!isUsableSignatureHtml(html)) {
      continue;
    }

    for (const handle of parseMailboxHandles(row.mailboxHandle)) {
      catalog[handle] = html;
    }
  }

  return catalog;
}

export function htmlFromRichTextField(value: unknown): string {
  let raw = '';

  if (typeof value === 'object' && value !== null && 'markdown' in value) {
    raw = String((value as { markdown?: string }).markdown ?? '');
  } else if (typeof value === 'string') {
    raw = value;
  }

  return isUsableSignatureHtml(raw) ? raw.trim() : '';
}

/** BlockNote markdown without tags is not a mail footer — fall back to defaults. */
export function isUsableSignatureHtml(html: string): boolean {
  const trimmed = html.trim();

  if (!trimmed || !trimmed.includes('<')) {
    return false;
  }

  const text = trimmed
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, '')
    .replace(/\s+/g, '');

  return text.length > 0;
}

export const DEFAULT_SIGNATURE_BY_HANDLE: SignatureCatalog =
  catalogFromCrmRows(DEFAULT_SIGNATURE_RECORDS);

export function mergeSignatureCatalog(
  crmCatalog: SignatureCatalog | null | undefined,
): SignatureCatalog {
  return { ...DEFAULT_SIGNATURE_BY_HANDLE, ...(crmCatalog ?? {}) };
}

export function signatureHtmlForHandle(
  handle: string | null | undefined,
  catalog: SignatureCatalog | null | undefined = DEFAULT_SIGNATURE_BY_HANDLE,
): string | null {
  const key = normalizeMailboxHandle(handle);

  if (!key) {
    return null;
  }

  const map = catalog ?? DEFAULT_SIGNATURE_BY_HANDLE;

  if (Object.prototype.hasOwnProperty.call(map, key)) {
    const value = map[key]?.trim();

    return value || null;
  }

  return DEFAULT_SIGNATURE_BY_HANDLE[key] ?? null;
}

export function wrapSignatureHtml(handle: string, inner: string): string {
  const safeHandle = normalizeMailboxHandle(handle).replace(/"/g, '');

  return `<section ${SIGNATURE_WRAPPER_ATTR}="1" data-owocni-handle="${safeHandle}" style="margin-top:1em">${inner}</section>`;
}

export function hasSignatureMarker(html: string): boolean {
  return /data-owocni-signature\s*=\s*"1"/i.test(html);
}

export function stripSignatureBlock(html: string): string {
  return html.replace(SIGNATURE_BLOCK_RE, '').trim();
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, '');
}

export function isEmptyComposeHtml(html: string): boolean {
  return htmlToPlain(stripSignatureBlock(html)).length === 0;
}

/**
 * Quoted original of a reply — not a template that happens to use <blockquote>
 * for layout. Only strip known mail-quote wrappers.
 */
export function stripQuotedReplyHtml(html: string): string {
  return html
    .replace(/<div[^>]*class="[^"]*gmail_quote[^"]*"[\s\S]*$/i, '')
    .replace(/<div[^>]*class="[^"]*moz-cite-prefix[^"]*"[\s\S]*$/i, '')
    .replace(
      /<blockquote\b[^>]*>[\s\S]*?napisał\(a\):[\s\S]*?<\/blockquote>/gi,
      '',
    );
}

function extraTextInsideSignature(html: string): string {
  const match =
    /<section([^>]*)data-owocni-signature="1"([^>]*)>([\s\S]*?)<\/section>/i.exec(
      html,
    );

  if (!match) {
    return '';
  }

  const attrs = `${match[1]}${match[2]}`;
  const handle =
    /data-owocni-handle="([^"]*)"/.exec(attrs)?.[1] ?? '';
  const innerPlain = htmlToPlain(match[3] ?? '');
  const expected = signatureHtmlForHandle(handle);
  const expectedPlain = expected ? htmlToPlain(expected) : '';

  if (expectedPlain && innerPlain.includes(expectedPlain)) {
    return innerPlain.replace(expectedPlain, '');
  }

  if (expectedPlain && innerPlain.length > expectedPlain.length + 4) {
    return innerPlain;
  }

  return '';
}

/**
 * Placeholder, whitespace, stock signature-only, or quoted-mail-only.
 * Text typed into the signature block still counts — the caret often lands there.
 * Template <blockquote> styling is not treated as a quote.
 */
export function isUnintendedEmptyReply(html: string): boolean {
  if (!html.trim()) {
    return true;
  }

  const withoutQuote = stripQuotedReplyHtml(html);

  if (!isEmptyComposeHtml(withoutQuote)) {
    return false;
  }

  return extraTextInsideSignature(withoutQuote).length === 0;
}

/** First candidate that is a real reply. Does not prefer longer HTML. */
export function pickSendableBodyHtml(
  candidates: Array<string | null | undefined>,
): string {
  for (const raw of candidates) {
    const html = (raw ?? '').trim();
    if (html && !isUnintendedEmptyReply(html)) {
      return html;
    }
  }

  for (const raw of candidates) {
    const html = (raw ?? '').trim();
    if (html) {
      return html;
    }
  }

  return '';
}

/** New compose or freshly loaded template — put this mailbox's signature at the end. */
export function applySignatureForNewBody(
  bodyHtml: string,
  handle: string | null | undefined,
  catalog: SignatureCatalog | null | undefined = DEFAULT_SIGNATURE_BY_HANDLE,
): string {
  const inner = signatureHtmlForHandle(handle, catalog);
  const without = stripSignatureBlock(bodyHtml);
  const base = without.trim() || '<p><br></p>';

  if (!inner || !handle) {
    return base;
  }

  return `${base}${wrapSignatureHtml(handle, inner)}`;
}

/**
 * From-picker change: replace the signature block only if it is still in the editor.
 * If the user deleted it, leave the body alone (WYSIWYG send).
 */
export function swapSignatureOnFromChange(
  bodyHtml: string,
  handle: string | null | undefined,
  catalog: SignatureCatalog | null | undefined = DEFAULT_SIGNATURE_BY_HANDLE,
): string {
  if (!hasSignatureMarker(bodyHtml)) {
    return bodyHtml;
  }

  return applySignatureForNewBody(bodyHtml, handle, catalog);
}
