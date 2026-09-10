import { describe, expect, it } from 'vitest';

import {
  applySignatureForNewBody,
  catalogFromCrmRows,
  hasSignatureMarker,
  isEmptyComposeHtml,
  mergeSignatureCatalog,
  signatureHtmlForHandle,
  swapSignatureOnFromChange,
} from './mailSignature';

describe('mailSignature', () => {
  it('returns Marta HTML for marta@ (case-insensitive)', () => {
    const html = signatureHtmlForHandle('Marta@Owocni.pl');

    expect(html).toContain('Marta Słowik');
    expect(html).toContain('+48 660 970 980');
  });

  it('prefers CRM catalog over the hardcoded fallback', () => {
    const html = signatureHtmlForHandle('marta@owocni.pl', {
      'marta@owocni.pl': '<p>Nowa stopka Marty</p>',
    });

    expect(html).toBe('<p>Nowa stopka Marty</p>');
  });

  it('maps comma-separated mailbox handles onto one CRM row', () => {
    const catalog = catalogFromCrmRows([
      {
        mailboxHandle: 'maciejwysocki@owocni.pl, alpha@owocni.pl',
        bodyHtml: '<p>Maciej CRM</p>',
      },
    ]);
    const merged = mergeSignatureCatalog(catalog);

    expect(merged['maciejwysocki@owocni.pl']).toBe('<p>Maciej CRM</p>');
    expect(merged['alpha@owocni.pl']).toBe('<p>Maciej CRM</p>');
    expect(merged['marta@owocni.pl']).toContain('Marta Słowik');
  });

  it('ignores BlockNote markdown without HTML tags and keeps the default', () => {
    const catalog = catalogFromCrmRows([
      {
        mailboxHandle: 'studio@owocni.pl, leads@owocni.pl',
        bodyHtml: 'Pozdrawiamy,\\\n**Owocni.pl**\\\n*Wierzymy w małe firmy!*\n',
      },
    ]);
    const merged = mergeSignatureCatalog(catalog);

    expect(merged['studio@owocni.pl']).toContain('<p>');
    expect(merged['studio@owocni.pl']).toContain('Owocni.pl');
    expect(merged['studio@owocni.pl']).not.toContain('**Owocni.pl**');
  });

  it('injects signature into empty compose without duplicating', () => {
    const first = applySignatureForNewBody('<p><br></p>', 'marta@owocni.pl');
    const second = applySignatureForNewBody(first, 'marta@owocni.pl');

    expect(first).toContain('Marta Słowik');
    expect(first.match(/Marta Słowik/g)?.length).toBe(1);
    expect(second.match(/Marta Słowik/g)?.length).toBe(1);
    expect(isEmptyComposeHtml(first)).toBe(true);
  });

  it('swaps signature on From change only when the block is still present', () => {
    const withMarta = applySignatureForNewBody(
      '<p>Cześć</p>',
      'marta@owocni.pl',
    );
    const swapped = swapSignatureOnFromChange(withMarta, 'gosia@owocni.pl');
    const afterDelete = swapSignatureOnFromChange(
      '<p>Cześć bez stopki</p>',
      'gosia@owocni.pl',
    );

    expect(swapped).toContain('Małgorzata Zielińska');
    expect(swapped).not.toContain('Marta Słowik');
    expect(hasSignatureMarker(afterDelete)).toBe(false);
    expect(afterDelete).toBe('<p>Cześć bez stopki</p>');
  });
});
