import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { getEditorDraft } from 'src/logic-functions/editor-draft-store';
import {
  buildVisualEditorSrcDoc,
  EMPTY_EDITOR_BODY,
} from 'src/utils/visualEditorRuntime';

/**
 * Real-origin editor document for FC host with origin "null"
 * (blob:null iframes are blocked by the browser).
 * Content comes from durable mailEditorDraft (seeded by parent before navigate).
 */
const handler = async (event: RoutePayload) => {
  const sessionId = event.queryStringParameters?.sessionId?.trim() ?? '';
  const accessToken = event.queryStringParameters?.token?.trim() ?? '';

  if (!sessionId) {
    return new Response('<p>Brak sessionId</p>', {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  let html = EMPTY_EDITOR_BODY;

  try {
    const draft = await getEditorDraft(sessionId);
    if (draft && draft.trim()) {
      html = draft;
    }
  } catch {
    // fall through to empty body
  }

  const page = buildVisualEditorSrcDoc({
    bodyHtml: html,
    sessionId,
    accessToken,
    draftSaveUrl: '/s/mail/editor-draft',
  });

  return new Response(page, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
};

export default defineLogicFunction({
  universalIdentifier: 'c8e4f1a2-9b7d-4c3e-8f6a-2d1e0b9c8a7f',
  name: 'get-editor-frame',
  description: 'Serves the visual mail editor HTML document for an iframe',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/editor-frame',
    httpMethod: 'GET',
    isAuthRequired: false,
  },
});
