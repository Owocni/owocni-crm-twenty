/**
 * Light cleanup for picker — keeps inline styles and layout from BB templates.
 * Only strips Google Docs noise that can break the Twenty host.
 */
export function prepareHtmlForPicker(html: string): string {
  let result = html;

  result = result.replace(/\s+id="docs-internal-[^"]*"/gi, '');
  result = result.replace(
    /<strong\s+style="font-weight:\s*normal;?"\s*>/gi,
    '<span>',
  );

  return result.trim();
}
