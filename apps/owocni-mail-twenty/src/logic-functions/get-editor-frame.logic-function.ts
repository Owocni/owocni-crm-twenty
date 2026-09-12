import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

/**
 * Closed in composer v2 slice 4. The visual editor is srcDoc (origin null).
 * This public GET previously served HTML (and optionally a token query) without
 * auth — do not reopen it.
 */
const handler = async (_event: RoutePayload) => {
  return new Response('Gone', {
    status: 410,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
};

export default defineLogicFunction({
  universalIdentifier: 'c8e4f1a2-9b7d-4c3e-8f6a-2d1e0b9c8a7f',
  name: 'get-editor-frame',
  description: 'Closed — visual editor uses srcDoc; public /mail/editor-frame is gone',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/editor-frame',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
