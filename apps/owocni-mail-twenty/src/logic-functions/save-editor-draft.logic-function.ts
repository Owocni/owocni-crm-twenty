import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import {
  getEditorDraft,
  saveEditorDraft,
} from 'src/logic-functions/editor-draft-store';
import { parseRouteBody, readStringField } from 'src/utils/parseRouteBody';

const MAX_HTML_LENGTH = 512_000;

const handler = async (event: RoutePayload) => {
  const payload = parseRouteBody(event);
  const sessionId = readStringField(payload, 'sessionId');
  const action = readStringField(payload, 'action');

  if (!sessionId) {
    return { ok: false, error: 'sessionId is required' };
  }

  if (action === 'read') {
    const html = getEditorDraft(sessionId);

    return {
      ok: true,
      found: html !== null,
      html: html ?? '',
    };
  }

  const html = readStringField(payload, 'html', 'htmlBody', 'body');

  if (!html) {
    return { ok: false, error: 'html is required' };
  }

  if (html.length > MAX_HTML_LENGTH) {
    return { ok: false, error: 'html is too large' };
  }

  saveEditorDraft(sessionId, html);

  return { ok: true, length: html.length };
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
