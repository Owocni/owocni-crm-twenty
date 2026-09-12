import { describe, expect, it, vi } from 'vitest';

import { isComposerV2Payload, readComposerV2Enabled, writeComposerV2Enabled } from './composerV2Flag';
import {
  composerV2EnvelopeKey,
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

  it('defaults to on unless localStorage opts out', () => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
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
