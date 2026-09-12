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
    expect(html).toContain('owocni-mail-flush-result');
    expect(html).toContain('owocni-mail-html-changed');
    expect(html).toContain('parent.postMessage');
    expect(html).toContain('placeCaretInReply');
    expect(html).not.toContain('id="owocni-v2-send"');
    expect(html).not.toContain('id="owocni-v2-to"');
  });

  it('bakes composer v2 send controls into the same editor document', () => {
    const html = buildVisualEditorSrcDoc({
      bodyHtml: '<p>cześć</p>',
      sessionId: 'sess',
      draftSaveUrl: 'https://example.com/s/mail/editor-draft',
      accessToken: 'tok',
      composerV2: {
        sendUrl: 'https://example.com/s/mail/send-template',
        sessionRefreshUrl: 'https://example.com/s/mail/refresh-composer-session',
        sessionTicket: 'a'.repeat(64),
        uploadUrl: 'https://example.com/s/mail/upload-attachment',
        envelope: { to: 'test9959058@fastman.eu', subject: 'Test' },
      },
    });

    expect(html).toContain('id="owocni-v2-send"');
    expect(html).toContain('Wyślij email');
    expect(html).toContain('composerV2: true');
    expect(html).toContain('test9959058@fastman.eu');
    expect(html).toContain('/s/mail/send-template');
    expect(html).toContain('v2envelope:');
    expect(html).toContain('editorSessionId');
    expect(html).toContain('/s/mail/refresh-composer-session');
    expect(html).toContain('action: \'pull\'');
    expect(html).toContain('a'.repeat(64));
    expect(html).toContain('Możesz pisać');
    expect(html).toContain('attemptId: v2AttemptId');
    expect(html).toContain('bodyHash: v2Hash(html)');
    expect(html).toContain('htmlBodyBase64: toBase64(html)');
    expect(html).toContain('id="owocni-v2-to"');
    expect(html).toContain('id="owocni-v2-to-row"');
    expect(html).toContain('id="owocni-v2-cc-toggle"');
    expect(html).toContain('id="owocni-v2-bcc-toggle"');
    expect(html).not.toContain('id="owocni-v2-copies"');
    expect(html).toContain('label[hidden] { display: none !important; }');
    expect(html).toContain('id="owocni-v2-subject"');
    expect(html).toContain('id="owocni-v2-file"');
    expect(html).toContain('test9959058@fastman.eu');
    expect(html).toContain('/s/mail/upload-attachment');
    expect(html).not.toContain('/mail/editor-frame');
  });

  it('dual-writes typed HTML to the durable compose key', () => {
    const html = buildVisualEditorSrcDoc({
      bodyHtml: '<p>cześć</p>',
      sessionId: 'sess',
      durableSessionId: 'compose:marta%40owocni.pl:opp-1',
      draftSaveUrl: 'https://example.com/s/mail/editor-draft',
      accessToken: 'tok',
    });

    expect(html).toContain('compose:marta%40owocni.pl:opp-1');
    expect(html).toContain('durableSessionId');
  });

  it('follows the caret after paste instead of jumping to the mail end', () => {
    const html = buildVisualEditorSrcDoc({
      bodyHtml: '<p>cześć</p>',
      sessionId: 'sess',
      draftSaveUrl: 'https://example.com/s/mail/editor-draft',
      accessToken: 'tok',
    });

    expect(html).toContain("addEventListener('paste'");
    expect(html).toContain('followPasteCaret');
    expect(html).toContain('scrollCaretIntoEditor');
    expect(html).not.toContain('editor.scrollTop = editor.scrollHeight');
    expect(html).not.toContain('previousScrollTop');
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
