/**
 * Per-mailbox signatures for the Owocni Mail editor only.
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
  '<div style="font-size: 13.0px;"><br></div><div style="">Pozdrawiam,<br>Maciej Wysocki</div><div style=""><br></div><div style=""><strong style=""><br></strong></div><div style=""><strong style="">Owocni.pl</strong><br><em style=""><span style="color: green;">Wierzymy w małe firmy!</span></em><br><br><a class="moz-txt-link-abbreviated" href="mailto:copywriting@owocni.pl" style="">copywriting@owocni.pl</a><br><a class="moz-txt-link-abbreviated" href="http://www.owocni.pl/" style="">www.owocni.pl</a> <br><br><span style="color: gray;">Bezpieczeństwo klientów zawsze jest dla nas najważniejsze.<br>W związku z rozporządzeniem o ochronie danych osobowych<br>(RODO) 25 V 2018 r. ulegają zmianie polityka prywatności<br>oraz polityka bezpieczeństwa danych osobowych w Owocnych.<br>Szczegóły — <a href="https://www.owocni.pl/polityka-prywatnosci" style="">https://www.owocni.pl/polityka-prywatnosci</a></span></div>';

const EWA_HTML =
  '<div style="font-size: 13.0px;"><br></div><div style="">Pozdrawiam,<br>Ewa Malanowska</div><div style=""><br></div><div style=""><strong style=""><br></strong></div><div style=""><strong style="">Owocni.pl</strong><br><em style=""><span style="color: green;">Wierzymy w małe firmy!</span></em><br><br><a class="moz-txt-link-abbreviated" href="mailto:ewamalanowska@owocni.pl" style="">ewamalanowska@owocni.pl</a><br><a class="moz-txt-link-abbreviated" href="http://www.owocni.pl/" style="">www.owocni.pl</a> <br><br><span style="color: gray;">Bezpieczeństwo klientów zawsze jest dla nas najważniejsze.<br>W związku z rozporządzeniem o ochronie danych osobowych<br>(RODO) 25 V 2018 r. ulegają zmianie polityka prywatności<br>oraz polityka bezpieczeństwa danych osobowych w Owocnych.<br>Szczegóły — <a href="https://www.owocni.pl/polityka-prywatnosci" style="">https://www.owocni.pl/polityka-prywatnosci</a></span></div>';

const ROBERT_HTML =
  '<div style="font-size: 13.0px;"><br></div><div style="">Pozdrawiam,<br>Robert Mańk</div><div style=""><br></div><div style=""><strong style=""><br></strong></div><div style=""><strong style="">Owocni.pl</strong><br><em style=""><span style="color: green;">Wierzymy w małe firmy!</span></em><br><br><a class="moz-txt-link-abbreviated" href="mailto:robertmank@owocni.pl" style="">robertmank@owocni.pl</a><br><a class="moz-txt-link-abbreviated" href="http://www.owocni.pl/" style="">www.owocni.pl</a> <br><br><span style="color: gray;">Bezpieczeństwo klientów zawsze jest dla nas najważniejsze.<br>W związku z rozporządzeniem o ochronie danych osobowych<br>(RODO) 25 V 2018 r. ulegają zmianie polityka prywatności<br>oraz polityka bezpieczeństwa danych osobowych w Owocnych.<br>Szczegóły — <a href="https://www.owocni.pl/polityka-prywatnosci" style="">https://www.owocni.pl/polityka-prywatnosci</a></span></div>';

const MARIUSZ_HTML =
  '<div style="font-size: 13.0px;"><br></div><div style="">Pozdrawiam,<br>Mariusz Słowik</div><div style=""><br></div><div style=""><strong style=""><br></strong></div><div style=""><strong style="">Owocni.pl</strong><br><em style=""><span style="color: green;">Wierzymy w małe firmy!</span></em><br><br><a class="moz-txt-link-abbreviated" href="mailto:mariusz@owocni.pl" style="">mariusz@owocni.pl</a><br><a class="moz-txt-link-abbreviated" href="http://www.owocni.pl/" style="">www.owocni.pl</a> <br><br><span style="color: gray;">Bezpieczeństwo klientów zawsze jest dla nas najważniejsze.<br>W związku z rozporządzeniem o ochronie danych osobowych<br>(RODO) 25 V 2018 r. ulegają zmianie polityka prywatności<br>oraz polityka bezpieczeństwa danych osobowych w Owocnych.<br>Szczegóły — <a href="https://www.owocni.pl/polityka-prywatnosci" style="">https://www.owocni.pl/polityka-prywatnosci</a></span></div>';

const SIGNATURE_BY_HANDLE: Record<string, string> = {
  'marta@owocni.pl': MARTA_HTML,
  'gosia@owocni.pl': GOSIA_HTML,
  'copywriting@owocni.pl': MACIEJ_HTML,
  'maciej@owocni.pl': MACIEJ_HTML,
  'ewamalanowska@owocni.pl': EWA_HTML,
  'robertmank@owocni.pl': ROBERT_HTML,
  'mariusz@owocni.pl': MARIUSZ_HTML,
  'pomoc@owocni.pl': POMOC_HTML,
  'studio@owocni.pl': OWOCINI_FIRM_HTML,
  'leads@owocni.pl': OWOCINI_FIRM_HTML,
};

const SIGNATURE_BLOCK_RE =
  /<section[^>]*data-owocni-signature="1"[^>]*>[\s\S]*?<\/section>/gi;

export function normalizeMailboxHandle(
  handle: string | null | undefined,
): string {
  return (handle ?? '').trim().toLowerCase();
}

export function signatureHtmlForHandle(
  handle: string | null | undefined,
): string | null {
  const key = normalizeMailboxHandle(handle);

  if (!key) {
    return null;
  }

  return SIGNATURE_BY_HANDLE[key] ?? null;
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

export function isEmptyComposeHtml(html: string): boolean {
  const withoutSignature = stripSignatureBlock(html);
  const text = withoutSignature
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, '');

  return text.length === 0;
}

/** New compose or freshly loaded template — put this mailbox's signature at the end. */
export function applySignatureForNewBody(
  bodyHtml: string,
  handle: string | null | undefined,
): string {
  const inner = signatureHtmlForHandle(handle);
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
): string {
  if (!hasSignatureMarker(bodyHtml)) {
    return bodyHtml;
  }

  return applySignatureForNewBody(bodyHtml, handle);
}
