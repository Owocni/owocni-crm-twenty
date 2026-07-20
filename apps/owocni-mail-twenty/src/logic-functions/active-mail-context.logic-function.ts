import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import { readActiveMailContext } from 'src/utils/activeMailContextStore';
import { resolveMailContext } from 'src/utils/personContext';

/** GET — restore pinned lead/thread after native Reply cleared hooks. */
const handler = async (event: RoutePayload) => {
  const key = event.userWorkspaceId?.trim();
  if (!key) {
    return { ok: false, error: 'missing userWorkspaceId' };
  }

  const pinned = readActiveMailContext(key);
  if (!pinned) {
    return {
      ok: true,
      context: null,
      person: null,
      replySubject: null,
      contextKind: null,
    };
  }

  const coreClient = new CoreApiClient();
  const resolved = await resolveMailContext(coreClient, {
    recordId: pinned.recordId,
    email: pinned.email ?? null,
  });

  return {
    ok: true,
    context: pinned,
    person: resolved.person,
    replySubject: resolved.replySubject || pinned.replySubject || null,
    contextKind: resolved.contextKind,
  };
};

export default defineLogicFunction({
  universalIdentifier: 'd4e5f6a7-b8c9-4d0e-9f2a-3b4c5d6e7f8a',
  name: 'active-mail-context',
  description:
    'Restore pinned lead/thread for Szablony after native Reply clears hooks',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/active-context',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
