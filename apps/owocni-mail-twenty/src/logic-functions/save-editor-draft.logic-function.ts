import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import {
  clearEditorDraft,
  getEditorDraft,
  getEditorDraftFresh,
  saveEditorDraft,
  upsertComposeDraft,
} from 'src/logic-functions/editor-draft-store';
import {
  isComposeDraftKey,
  type ComposeDraftEnvelope,
  type ComposeDraftMode,
} from 'src/utils/composeDraft';
import { isEmptyComposeHtml } from 'src/utils/mailSignature';
import { parseRouteBody, readStringField } from 'src/utils/parseRouteBody';

const MAX_HTML_LENGTH = 512_000;

function readComposeDraftPatch(
  payload: Record<string, unknown>,
): Partial<ComposeDraftEnvelope> | null {
  const raw = payload.composeDraft;

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const entry = raw as Record<string, unknown>;
  const patch: Partial<ComposeDraftEnvelope> = {};

  if (typeof entry.html === 'string') {
    patch.html = entry.html;
  }
  if (typeof entry.subject === 'string') {
    patch.subject = entry.subject;
  }
  if (typeof entry.to === 'string') {
    patch.to = entry.to;
  }
  if (typeof entry.cc === 'string') {
    patch.cc = entry.cc;
  }
  if (typeof entry.bcc === 'string') {
    patch.bcc = entry.bcc;
  }
  if (typeof entry.selectedId === 'string') {
    patch.selectedId = entry.selectedId;
  }
  if (
    entry.mode === 'reply' ||
    entry.mode === 'internal' ||
    entry.mode === 'forward'
  ) {
    patch.mode = entry.mode as ComposeDraftMode;
  }
  if (typeof entry.handoffTo === 'string') {
    patch.handoffTo = entry.handoffTo;
  }
  if (typeof entry.replyMessageId === 'string') {
    patch.replyMessageId = entry.replyMessageId;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function readHtmlFromPayload(payload: Record<string, unknown>): string {
  const encoded = readStringField(payload, 'htmlBase64', 'htmlBodyBase64');

  if (encoded) {
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8').trim();
      if (decoded) {
        return decoded;
      }
    } catch {
      // fall through
    }
  }

  return readStringField(payload, 'html', 'htmlBody', 'body');
}

/**
 * Single POST endpoint for visual-editor drafts (save + action:read + delete).
 * Memory + best-effort DB. Compose keys store a JSON envelope (body + subject).
 */
const handler = async (event: RoutePayload) => {
  const payload = parseRouteBody(event);
  const sessionId = readStringField(payload, 'sessionId');
  const durableSessionId = readStringField(
    payload,
    'durableSessionId',
    'composeDraftKey',
  );
  const action = readStringField(payload, 'action');

  if (!sessionId) {
    return { ok: false, error: 'sessionId is required' };
  }

  if (action === 'delete') {
    try {
      await clearEditorDraft(sessionId);
      if (durableSessionId) {
        await clearEditorDraft(durableSessionId);
      }
      return { ok: true, deleted: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (action === 'read') {
    try {
      const html = isComposeDraftKey(sessionId)
        ? await getEditorDraftFresh(sessionId)
        : await getEditorDraft(sessionId);

      return {
        ok: true,
        found: html !== null,
        html: html ?? '',
        length: html?.length ?? 0,
      };
    } catch (error) {
      return {
        ok: false,
        found: false,
        html: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const html = readHtmlFromPayload(payload);
  const composePatch = readComposeDraftPatch(payload);

  if (html.length > MAX_HTML_LENGTH) {
    return { ok: false, error: 'html is too large' };
  }

  try {
    if (isComposeDraftKey(sessionId) && (composePatch || html)) {
      const patch: Partial<ComposeDraftEnvelope> = {
        ...(composePatch ?? {}),
        ...(html ? { html } : {}),
      };
      const result = await upsertComposeDraft(sessionId, patch);

      return {
        ok: true,
        length: html.length,
        memory: result.memory,
        db: result.db,
        dbError: result.dbError,
        compose: true,
      };
    }

    if (!html) {
      return { ok: false, error: 'html is required' };
    }

    const result = await saveEditorDraft(sessionId, html);
    let durableDb = true;
    let durableError: string | undefined;

    if (durableSessionId && isComposeDraftKey(durableSessionId)) {
      if (!isEmptyComposeHtml(html)) {
        const durable = await upsertComposeDraft(durableSessionId, { html });
        durableDb = durable.db;
        durableError = durable.dbError;
      }
    }

    return {
      ok: true,
      length: html.length,
      memory: result.memory,
      db: result.db,
      dbError: result.dbError,
      durableDb,
      durableError,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export default defineLogicFunction({
  universalIdentifier: 'a1f3c8e2-4b5d-4e6f-9a0b-1c2d3e4f5a6b',
  name: 'save-editor-draft',
  description: 'Stores and reads visual editor HTML drafts for the mail template picker',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/editor-draft',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
