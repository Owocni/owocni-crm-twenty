import { describe, expect, it, vi } from 'vitest';

import { isComposerV2Payload, readComposerV2Enabled, writeComposerV2Enabled } from './composerV2Flag';
import {
  composerV2EnvelopeKey,
  composerV2RuntimeScript,
  escapeHtmlAttr,
  parseComposerV2EnvelopeJson,
} from './composerV2Iframe';
import { readAttachmentRefs } from './emailAttachmentShared';

describe('isComposerV2Payload', () => {
  it('accepts boolean and string flags', () => {
    expect(isComposerV2Payload({ composerV2: true })).toBe(true);
    expect(isComposerV2Payload({ composerV2: 'true' })).toBe(true);
    expect(isComposerV2Payload({ composerV2: 1 })).toBe(true);
    expect(isComposerV2Payload({ composerV2: false })).toBe(false);
    expect(isComposerV2Payload({})).toBe(false);
  });

  it('defaults to on; only session/query opts out (no UI toggle)', () => {
    const store: Record<string, string> = {};
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    });
    vi.stubGlobal('location', { search: '' });

    expect(readComposerV2Enabled()).toBe(true);
    writeComposerV2Enabled(false);
    expect(readComposerV2Enabled()).toBe(false);
    writeComposerV2Enabled(true);
    expect(readComposerV2Enabled()).toBe(true);
    vi.unstubAllGlobals();
  });

  it('ignores leftover localStorage from the weekend button', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => '0',
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal('location', { search: '' });

    expect(readComposerV2Enabled()).toBe(true);
    vi.unstubAllGlobals();
  });

  it('lets a developer restore the legacy composer via query', () => {
    const store: Record<string, string> = {};
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    });
    vi.stubGlobal('location', { search: '?owocniMailV2=0' });

    expect(readComposerV2Enabled()).toBe(false);
    expect(store['owocni.mail.composerV2']).toBe('0');
    vi.unstubAllGlobals();
  });
});

describe('composer v2 envelope store', () => {
  it('reads files from the stored envelope JSON', () => {
    const env = parseComposerV2EnvelopeJson(
      JSON.stringify({
        to: 'test9959058@fastman.eu',
        files: [{ id: 'file-1', name: 'oferta.pdf' }],
      }),
    );

    expect(composerV2EnvelopeKey('sess')).toBe('v2envelope:sess');
    expect(readAttachmentRefs(env as Record<string, unknown>)).toEqual([
      { id: 'file-1', name: 'oferta.pdf' },
    ]);
  });

  it('escapes envelope values for srcDoc attributes', () => {
    expect(escapeHtmlAttr('a"b<c>')).toBe('a&quot;b&lt;c&gt;');
  });
});

describe('composer v2 attachment picker', () => {
  it('copies picked files before clearing the input and shows upload status', () => {
    const src = composerV2RuntimeScript();
    const copyAt = src.indexOf(
      'Array.prototype.slice.call(fileInput.files || [], 0)',
    );
    const clearAt = src.indexOf("fileInput.value = ''");

    expect(copyAt).toBeGreaterThan(0);
    expect(clearAt).toBeGreaterThan(copyAt);
    expect(src).toContain('Trwa załączanie pliku');
    expect(src).toContain('Nie udało się dodać');
    expect(src).toContain('Nie odczytano pliku');
  });
});
