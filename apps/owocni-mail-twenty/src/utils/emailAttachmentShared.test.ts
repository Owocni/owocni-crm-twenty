import { describe, expect, it } from 'vitest';

import {
  ATTACHMENT_FRAME_MESSAGE_TYPE,
  parseAttachmentFrameMessage,
} from './emailAttachmentShared';

describe('parseAttachmentFrameMessage', () => {
  const sessionId = 'sess-1';

  it('accepts a successful file payload for this session', () => {
    const parsed = parseAttachmentFrameMessage(
      {
        type: ATTACHMENT_FRAME_MESSAGE_TYPE,
        sessionId,
        ok: true,
        file: { id: 'file-1', name: 'brief.png', size: 1200 },
      },
      sessionId,
    );

    expect(parsed?.ok).toBe(true);
    expect(parsed?.file).toEqual({
      id: 'file-1',
      name: 'brief.png',
      size: 1200,
    });
  });

  it('accepts an error payload', () => {
    const parsed = parseAttachmentFrameMessage(
      {
        type: ATTACHMENT_FRAME_MESSAGE_TYPE,
        sessionId,
        ok: false,
        error: 'HTTP 401',
      },
      sessionId,
    );

    expect(parsed?.ok).toBe(false);
    expect(parsed?.error).toBe('HTTP 401');
  });

  it('ignores other sessions and unrelated messages', () => {
    expect(
      parseAttachmentFrameMessage(
        {
          type: ATTACHMENT_FRAME_MESSAGE_TYPE,
          sessionId: 'other',
          ok: true,
          file: { id: 'file-1', name: 'brief.png' },
        },
        sessionId,
      ),
    ).toBeNull();

    expect(parseAttachmentFrameMessage({ type: 'nope' }, sessionId)).toBeNull();
  });
});
