import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import { listMailThreadList } from 'src/utils/personContext';

const handler = async (event: RoutePayload) => {
  const recordId =
    typeof event.queryStringParameters?.recordId === 'string'
      ? event.queryStringParameters.recordId.trim()
      : null;
  const email =
    typeof event.queryStringParameters?.email === 'string'
      ? event.queryStringParameters.email.trim()
      : null;

  const listed = await listMailThreadList(new CoreApiClient(), {
    recordId,
    email,
  });

  return {
    ...listed,
    templates: [],
    debug: {
      recordId,
      emailParam: email,
      threadMessageCount: listed.threadMessages.length,
      includeText: false,
    },
  };
};

export default defineLogicFunction({
  universalIdentifier: 'a4c81b2e-9f3d-4e17-8c6a-2d5b7e91f0a3',
  name: 'list-mail-thread-list',
  description:
    'Light Mail-tab thread list without bodies, templates, or signatures',
  timeoutSeconds: 20,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/thread-list',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
