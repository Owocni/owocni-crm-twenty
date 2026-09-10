/** Twenty Message.text is often the HTML body with no `\n`. */

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
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

export function htmlEmailToPlainText(html: string): string {
  let result = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  result = result.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  result = result.replace(/<style\b[\s\S]*?<\/style>/gi, '');
  result = result.replace(/<head\b[\s\S]*?<\/head>/gi, '');
  result = result.replace(/<!--[\s\S]*?-->/g, '');
  result = result.replace(/<br\s*\/?>/gi, '\n');
  result = result.replace(/<\/(p|div|tr|li|h[1-6]|blockquote|section|article|header|footer)>/gi, '\n');
  result = result.replace(
    /<(p|div|tr|li|h[1-6]|blockquote|section|article|header|footer)(\s[^>]*)?>/gi,
    '',
  );
  result = result.replace(/<\/?hr\b[^>]*>/gi, '\n');
  result = result.replace(/<\/?table\b[^>]*>/gi, '\n');
  result = result.replace(/<[^>]+>/g, '');
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
  if (looksLikeHtml(raw)) {
    return htmlEmailToPlainText(raw);
  }
  return raw;
}
