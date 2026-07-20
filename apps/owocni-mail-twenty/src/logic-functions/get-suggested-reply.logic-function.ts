import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import { findSuggestedReply } from 'src/utils/suggestedReply';

/**
 * Dedicated lightweight suggestion for Reply → Szablony when hooks have no recordId.
 */
const handler = async (_event: RoutePayload) => {
  const coreClient = new CoreApiClient();
  const recent = await findSuggestedReply(coreClient);

  return {
    ok: true,
    suggestedReply: recent.suggestedReply,
    recentRecipients: recent.recipients,
    debug: recent.debug,
  };
};

export default defineLogicFunction({
  universalIdentifier: 'e7a91c2b-4d5f-4a8e-9b1c-3f6d8e0a2b4c',
  name: 'get-suggested-reply',
  description:
    'Returns latest external mailbox participant + subject for Reply autofill',
  timeoutSeconds: 45,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/suggested-reply',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
