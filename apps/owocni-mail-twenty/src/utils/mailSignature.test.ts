import { describe, expect, it } from 'vitest';

import {
  applySignatureForNewBody,
  catalogFromCrmRows,
  composeMeaningfulPlain,
  hasSignatureMarker,
  htmlToPlain,
  isEmptyComposeHtml,
  isUnintendedEmptyReply,
  mergeSignatureCatalog,
  pickSendableBodyHtml,
  signatureHtmlForHandle,
  signatureInnerPlain,
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
    expect(isUnintendedEmptyReply(first)).toBe(true);
  });

  it('rejects quote-only replies as empty', () => {
    const signatureOnly = applySignatureForNewBody(
      '<p><br></p>',
      'marta@owocni.pl',
    );
    const quoteOnly = `${signatureOnly}<blockquote>Dnia 7 września klient napisał(a):<br>poprzednia treść</blockquote>`;

    expect(isUnintendedEmptyReply(quoteOnly)).toBe(true);
    expect(isUnintendedEmptyReply(`<p>Cześć</p>${signatureOnly}`)).toBe(false);
  });

  it('does not treat a template blockquote as an empty quote-only reply', () => {
    const template =
      '<blockquote style="border-left:3px solid #38761d"><p>Oferta na stronę WWW</p><p>Zakres: projekt + wdrożenie</p></blockquote>';
    const signed = applySignatureForNewBody(template, 'marta@owocni.pl');

    expect(isUnintendedEmptyReply(signed)).toBe(false);
  });

  it('counts text typed into the signature block as a real reply', () => {
    const signed = applySignatureForNewBody('<p><br></p>', 'marta@owocni.pl');
    const typedInside = signed.replace(
      /(<section[^>]*data-owocni-signature="1"[^>]*>)/i,
      '$1<p>Dzień dobry, wysyłam ofertę.</p>',
    );

    expect(isUnintendedEmptyReply(typedInside)).toBe(false);
  });

  it('counts Maciej typing above Pozdrawiam inside the CRM signature', () => {
    const crmSig =
      '<div>Pozdrawiam,<br>Maciej Wysocki</div><div>Owocni.pl</div>' +
      '<div>+48 535 009 444</div><div>maciejwysocki@owocni.pl</div>';
    const wrapped =
      `<p><br></p><section data-owocni-signature="1" data-owocni-handle="maciejwysocki@owocni.pl">${crmSig}</section>`;
    const seed = signatureInnerPlain(wrapped);
    const typedInside = wrapped.replace(
      /(<section[^>]*data-owocni-signature="1"[^>]*>)/i,
      '$1<p>Dzień dobry,</p><p>Czy coś już wiadomo, zaczynamy w tym tygodniu :)?</p>',
    );

    expect(htmlToPlain(crmSig).length).toBeGreaterThan(0);
    expect(composeMeaningfulPlain(wrapped, seed)).toBe('');
    expect(composeMeaningfulPlain(typedInside, seed).length).toBeGreaterThan(0);
    expect(isUnintendedEmptyReply(typedInside, seed)).toBe(false);
    expect(isUnintendedEmptyReply(wrapped, seed)).toBe(true);
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

  it('picks the first live reply over a longer signature-only seed', () => {
    const signatureOnly = applySignatureForNewBody(
      '<p><br></p>',
      'leads@owocni.pl',
    );
    const typed = `<p>test test attsqa</p>${signatureOnly}`;

    expect(
      pickSendableBodyHtml([signatureOnly, typed]),
    ).toBe(typed);
    expect(pickSendableBodyHtml([typed, signatureOnly])).toBe(typed);
    expect(isUnintendedEmptyReply(signatureOnly)).toBe(true);
    expect(isUnintendedEmptyReply(typed)).toBe(false);
  });
});
