import { describe, expect, it } from 'vitest';

import {
  emailBodyToDisplayText,
  htmlEmailToPlainText,
  looksLikeHtml,
} from './emailBodyText';

describe('looksLikeHtml', () => {
  it('detects tags', () => {
    expect(looksLikeHtml('<div>Cześć</div>')).toBe(true);
    expect(looksLikeHtml('Dzień dobry Pani Małgosiu')).toBe(false);
    expect(
      looksLikeHtml('Gosia z Owocnych <gosia@owocni.pl> napisał(a):'),
    ).toBe(false);
  });
});

describe('htmlEmailToPlainText', () => {
  it('turns br and block tags into line breaks', () => {
    expect(
      htmlEmailToPlainText(
        '<div>Dzień dobry Pani Małgosiu,</div><div>w załączeniu potwierdzenie.</div>',
      ),
    ).toBe('Dzień dobry Pani Małgosiu,\nw załączeniu potwierdzenie.');
  });

  it('keeps quoted-reply headers on their own lines', () => {
    const text = htmlEmailToPlainText(
      '<div>Dziękuję.</div><blockquote>Dnia 07 września 2026, 12:04, Małgorzata napisał(a):<br>Poprzednia treść</blockquote>',
    );
    expect(text).toContain('Dziękuję.');
    expect(text).toContain('\nDnia 07 września 2026');
    expect(text).toContain('\nPoprzednia treść');
  });

  it('decodes entities and strips leftover tags', () => {
    expect(htmlEmailToPlainText('A&nbsp;B &amp; C<br>D')).toBe('A B & C\nD');
  });
});

describe('emailBodyToDisplayText', () => {
  it('leaves plaintext with newlines alone', () => {
    expect(emailBodyToDisplayText('Linia 1\n\nLinia 2')).toBe(
      'Linia 1\n\nLinia 2',
    );
  });

  it('turns a mashed WP-style HTML reply into paragraphs', () => {
    const html =
      '<div>Dzień dobry Pani Małgosiu, w załączeniu potwierdzenie.</div>' +
      '<div>Pozdrawiam serdecznie</div>' +
      '<div>Agnieszka Wójcik</div>' +
      '<blockquote>Dnia 07 września 2026, 12:04, Małgorzata napisał(a):<br>Poprzednia treść</blockquote>';
    const text = emailBodyToDisplayText(html);
    expect(text.split('\n')).toEqual([
      'Dzień dobry Pani Małgosiu, w załączeniu potwierdzenie.',
      'Pozdrawiam serdecznie',
      'Agnieszka Wójcik',
      '',
      'Dnia 07 września 2026, 12:04, Małgorzata napisał(a):',
      'Poprzednia treść',
    ]);
  });

  it('restores paragraphs in WP plaintext that Twenty already flattened', () => {
    const mashed =
      'Dzień dobry Pani Małgosiu, W załączeniu potwierdzenie przelewu.  ' +
      'Pozdrawiam, Agnieszka Wójcik  ' +
      'Dnia 07 września 2026 15:18    Gosia z Owocnych  &lt; gosia@owocni.pl &gt;  napisał(a): ' +
      'Dzień dobry Pani Agnieszko, Robert przekazał mi, że chciałaby Pani rozpocząć działania nad stroną.  ' +
      'W tym celu prosimy o opłacenie projektu.';
    const text = emailBodyToDisplayText(mashed);
    expect(text).toBe(
      [
        'Dzień dobry Pani Małgosiu,',
        'W załączeniu potwierdzenie przelewu.',
        'Pozdrawiam,',
        'Agnieszka Wójcik',
        '',
        'Dnia 07 września 2026 15:18 Gosia z Owocnych <gosia@owocni.pl> napisał(a):',
        'Dzień dobry Pani Agnieszko,',
        'Robert przekazał mi, że chciałaby Pani rozpocząć działania nad stroną.',
        'W tym celu prosimy o opłacenie projektu.',
      ].join('\n'),
    );
  });

  it('is stable when applied twice', () => {
    const mashed =
      'Dzień dobry Pani Małgosiu, W załączeniu potwierdzenie.  Pozdrawiam, Agnieszka Wójcik';
    const once = emailBodyToDisplayText(mashed);
    expect(emailBodyToDisplayText(once)).toBe(once);
  });
});
