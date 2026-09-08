import { describe, expect, it } from 'vitest';

import {
  buildVisualEditorSrcDoc,
  EDITOR_FONT_SIZES,
  EDITOR_TEXT_COLORS,
  normalizeEditorLinkUrl,
} from './visualEditorRuntime';

describe('buildVisualEditorSrcDoc', () => {
  it('puts format controls inside the editor document', () => {
    const html = buildVisualEditorSrcDoc({
      bodyHtml: '<p>cześć</p>',
      sessionId: 'sess',
      draftSaveUrl: 'https://example.com/s/mail/editor-draft',
      accessToken: 'tok',
    });

    expect(html).toContain('id="owocni-toolbar"');
    expect(html).toContain('id="editor"');
    expect(html).toContain('data-cmd="bold"');
    expect(html).toContain('data-cmd="fontSize"');
    expect(html).toContain('data-cmd="foreColor"');
    expect(html).toContain('data-cmd="createLink"');
    expect(html).toContain('id="owocni-link-bar"');
    expect(html).toContain('type="color"');
    expect(html).toContain('#008000');
    expect(html).toContain("event.preventDefault()");
    expect(html).toContain('<p>cześć</p>');
    expect(html).toContain('contenteditable="true"');
  });
});

describe('EDITOR_FONT_SIZES', () => {
  it('offers common mail sizes', () => {
    expect(EDITOR_FONT_SIZES.map((size) => size.value)).toEqual([
      '12px',
      '13px',
      '14px',
      '16px',
      '18px',
      '24px',
    ]);
  });
});

describe('EDITOR_TEXT_COLORS', () => {
  it('includes Owocni green and RODO gray', () => {
    expect(EDITOR_TEXT_COLORS.map((color) => color.value)).toEqual([
      '#222222',
      '#008000',
      '#38761d',
      '#808080',
      '#1155cc',
    ]);
  });
});

describe('normalizeEditorLinkUrl', () => {
  it('adds https to a bare domain', () => {
    expect(normalizeEditorLinkUrl('www.owocni.pl')).toBe(
      'https://www.owocni.pl',
    );
    expect(normalizeEditorLinkUrl('owocni.pl/oferta')).toBe(
      'https://owocni.pl/oferta',
    );
  });

  it('keeps http(s) and mailto', () => {
    expect(normalizeEditorLinkUrl('https://owocni.pl')).toBe(
      'https://owocni.pl',
    );
    expect(normalizeEditorLinkUrl('mailto:gosia@owocni.pl')).toBe(
      'mailto:gosia@owocni.pl',
    );
  });

  it('rejects javascript and empty input', () => {
    expect(normalizeEditorLinkUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeEditorLinkUrl('  ')).toBeNull();
    expect(normalizeEditorLinkUrl('nie link')).toBeNull();
  });
});
