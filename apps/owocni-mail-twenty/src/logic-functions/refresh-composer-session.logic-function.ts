import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import {
  dropComposerSession,
  pullComposerSession,
  pushComposerSession,
} from 'src/logic-functions/composer-session-store';
import { parseRouteBody, readStringField } from 'src/utils/parseRouteBody';

/**
 * Parent (auth SDK) pushes a rotated OAuth token bound to a high-entropy ticket.
 * The srcDoc iframe pulls by ticket without Bearer — expired iframe token cannot
 * call authenticated routes, and parent→iframe postMessage is unreliable.
 * Ticket is POST-only (never a query string). App secret stays off the client.
 */
const handler = async (event: RoutePayload) => {
  const payload = parseRouteBody(event);
  const action = readStringField(payload, 'action') || 'pull';
  const ticket = readStringField(payload, 'ticket');

  if (action === 'drop') {
    dropComposerSession(ticket);
    return { ok: true, dropped: true };
  }

  if (action === 'push') {
    const accessToken = readStringField(payload, 'accessToken', 'token');
    const sessionId = readStringField(payload, 'sessionId');
    const result = pushComposerSession({
      ticket,
      accessToken,
      sessionId,
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return { ok: true, pushed: true };
  }

  if (action !== 'pull') {
    return { ok: false, error: `Unknown action: ${action}` };
  }

  const session = pullComposerSession(ticket);

  if (!session) {
    return { ok: false, found: false, error: 'session not found' };
  }

  return {
    ok: true,
    found: true,
    accessToken: session.accessToken,
  };
};

export default defineLogicFunction({
  universalIdentifier: '3c9a1f70-8b2e-4d56-9a14-7e6c0b5d2f81',
  name: 'refresh-composer-session',
  description:
    'Binds a composer iframe ticket to a rotated OAuth token without remounting',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/refresh-composer-session',
    httpMethod: 'POST',
    isAuthRequired: false,
  },
});
