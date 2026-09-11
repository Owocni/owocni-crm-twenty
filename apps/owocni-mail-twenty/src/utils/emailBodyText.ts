/** Twenty Message.text is often HTML, or WP plaintext with line breaks already flattened. */

const STRUCTURAL_HTML_TAG_RE =
  /<\/?(?:div|p|br|span|table|tr|td|th|html|body|blockquote|head|style|script|font|strong|em|b|i|u|a|img|hr|li|ul|ol|h[1-6]|pre|center|article|section|header|footer)\b/i;

const PL_MONTH =
  'stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października|listopada|grudnia';

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/gi, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    );
}

export function looksLikeHtml(text: string): boolean {
  return STRUCTURAL_HTML_TAG_RE.test(text);
}

function compactSpaces(value: string): string {
  return value.replace(/[ \t]{2,}/g, ' ').trim();
}

function compactAngleEmails(value: string): string {
  return value.replace(/<\s*([^<>\s]+@[^<>\s]+)\s*>/g, '<$1>');
}

function isolateQuoteHeaders(text: string): string {
  const patterns = [
    new RegExp(
      String.raw`(Dnia\s+\d{1,2}\s+(?:${PL_MONTH})\s+\d{4}[\s\S]{0,220}?napisał\(a\):)\s*`,
      'gi',
    ),
    /(W dniu\s+\d{1,2}\.\d{1,2}\.\d{4}\s+o\s+\d{1,2}:\d{2}[\s\S]{0,220}?pisze:)\s*/gi,
    /((?:pon|wt|śr|czw|pt|sob|ndz)\.,\s+\d{1,2}\s+[a-ząćęłńóśźż]{3}\s+\d{4},\s+\d{1,2}:\d{2}[\s\S]{0,220}?napisał\(a\):)\s*/gi,
  ];

  let result = text;
  for (const pattern of patterns) {
    result = result.replace(pattern, (_match, header: string) => {
      const compact = compactSpaces(header.replace(/\s+/g, ' '));
      return `\n\n${compact}\n`;
    });
  }
  return result;
}

/**
 * WP / o2 / Twenty flatten HTML into one paragraph. Restore the breaks
 * that are still marked by greetings, sign-offs, quote headers, and leftover
 * double spaces.
 */
export function restoreCollapsedEmailLineBreaks(text: string): string {
  let result = compactAngleEmails(text);
  result = isolateQuoteHeaders(result);

  result = result.replace(
    /(^|\n)[ \t]*((?:Dzień dobry|Witam)[^,\n]{0,80},)[ \t]+(?=[A-ZĄĆĘŁŃÓŚŹŻ])/g,
    '$1$2\n',
  );

  result = result.replace(
    /([^\n])[ \t]+((?:Pozdrawiam|Dziękuję i pozdrawiam|Serdecznie pozdrawiam|Z góry dziękuję|Z poważaniem)\b)/g,
    '$1\n$2',
  );

  result = result.replace(
    /(^|\n)((?:Pozdrawiam(?: serdecznie)?|Dziękuję i pozdrawiam),)[ \t]+(?=[A-ZĄĆĘŁŃÓŚŹŻ])/g,
    '$1$2\n',
  );

  result = result.replace(/[ \t]{2,}/g, '\n');
  result = result.replace(/[ \t]+\n/g, '\n');
  result = result.replace(/\n[ \t]+/g, '\n');
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

export function htmlEmailToPlainText(html: string): string {
  let result = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  result = result.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  result = result.replace(/<style\b[\s\S]*?<\/style>/gi, '');
  result = result.replace(/<head\b[\s\S]*?<\/head>/gi, '');
  result = result.replace(/<!--[\s\S]*?-->/g, '');
  result = result.replace(/<br\s*\/?>/gi, '\n');
  result = result.replace(
    /<\/(p|div|tr|li|h[1-6]|blockquote|section|article|header|footer)>/gi,
    '\n',
  );
  result = result.replace(
    /<(p|div|tr|li|h[1-6]|blockquote|section|article|header|footer)(\s[^>]*)?>/gi,
    '',
  );
  result = result.replace(/<\/?hr\b[^>]*>/gi, '\n');
  result = result.replace(/<\/?table\b[^>]*>/gi, '\n');
  result = result.replace(
    /<(?![a-z0-9._%+\-]+@[a-z0-9.-]+\.[a-z]{2,})[^>]+>/gi,
    '',
  );
  result = decodeHtmlEntities(result);
  result = result.replace(/[ \t]+\n/g, '\n');
  result = result.replace(/\n[ \t]+/g, '\n');
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

export function emailBodyToDisplayText(
  text: string | null | undefined,
): string {
  const raw = (text ?? '').trim();
  if (!raw) {
    return '';
  }

  const converted = looksLikeHtml(raw)
    ? htmlEmailToPlainText(raw)
    : decodeHtmlEntities(raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n'));

  return restoreCollapsedEmailLineBreaks(converted);
}
