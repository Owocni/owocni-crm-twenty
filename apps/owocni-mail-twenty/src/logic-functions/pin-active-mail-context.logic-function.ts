import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import { pinActiveMailContext } from 'src/utils/activeMailContextStore';
import { parseRouteBody, readStringField } from 'src/utils/parseRouteBody';

const handler = async (event: RoutePayload) => {
  const key = event.userWorkspaceId?.trim();
  if (!key) {
    return { ok: false, error: 'missing userWorkspaceId' };
  }

  const body = parseRouteBody(event);
  const recordId = readStringField(body, 'recordId');
  if (!recordId) {
    return { ok: false, error: 'recordId required' };
  }

  const pinned = pinActiveMailContext(key, {
    recordId,
    email: readStringField(body, 'email') || undefined,
    replySubject: readStringField(body, 'replySubject') || undefined,
    objectNameSingular:
      readStringField(body, 'objectNameSingular') || undefined,
  });

  return { ok: true, context: pinned };
};

export default defineLogicFunction({
  universalIdentifier: 'e5f6a7b8-c9d0-4e1f-a2a3-4c5d6e7f8a9b',
  name: 'pin-active-mail-context',
  description: 'Pin current lead/thread so Szablony can restore after Reply',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/active-context',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
