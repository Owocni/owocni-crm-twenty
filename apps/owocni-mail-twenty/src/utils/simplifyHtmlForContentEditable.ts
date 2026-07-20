/**
 * Strip host-crashy / non-editable noise before mounting contentEditable.
 * Keeps basic formatting (p, br, b, i, lists, links, tables, inline styles).
 */
export function simplifyHtmlForContentEditable(html: string): string {
  let result = html;

  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  result = result.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  result = result.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  result = result.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  result = result.replace(/<embed\b[^>]*>/gi, '');
  result = result.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  result = result.replace(/\s+id="docs-internal-[^"]*"/gi, '');
  result = result.replace(
    /<strong\s+style="font-weight:\s*normal;?"\s*>/gi,
    '<span>',
  );

  return result.trim();
}
