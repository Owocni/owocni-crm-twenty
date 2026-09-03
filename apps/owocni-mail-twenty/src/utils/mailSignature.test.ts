import { describe, expect, it } from 'vitest';

import {
  applySignatureForNewBody,
  hasSignatureMarker,
  isEmptyComposeHtml,
  signatureHtmlForHandle,
  swapSignatureOnFromChange,
} from './mailSignature';

describe('mailSignature', () => {
  it('returns Marta HTML for marta@ (case-insensitive)', () => {
    const html = signatureHtmlForHandle('Marta@Owocni.pl');

    expect(html).toContain('Marta Słowik');
    expect(html).toContain('+48 660 970 980');
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
