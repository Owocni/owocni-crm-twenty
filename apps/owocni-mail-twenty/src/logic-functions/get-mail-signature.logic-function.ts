import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import { prepareHtmlForPicker } from 'src/utils/prepareHtmlForPicker';
import { htmlFromRichTextField } from 'src/utils/mailSignature';

const handler = async (event: RoutePayload) => {
  const recordId = event.queryStringParameters?.recordId?.trim();

  if (!recordId) {
    return { error: 'recordId is required' };
  }

  const coreClient = new CoreApiClient();
  const result = await coreClient.query({
    mailSignatures: {
      __args: {
        filter: { id: { eq: recordId } },
        first: 1,
      },
      edges: {
        node: {
          id: true,
          name: true,
          mailboxHandle: true,
          isActive: true,
          bodyHtml: { markdown: true },
        },
      },
    },
  });

  const node = result.mailSignatures?.edges?.[0]?.node;

  if (!node) {
    return { error: 'Stopka nie znaleziona' };
  }

  return {
    id: String(node.id),
    name: String(node.name ?? ''),
    mailboxHandle: String(node.mailboxHandle ?? ''),
    isActive: Boolean(node.isActive),
    bodyHtml: prepareHtmlForPicker(htmlFromRichTextField(node.bodyHtml)),
  };
};

export default defineLogicFunction({
  universalIdentifier: '4eadad6b-6784-4383-9d06-7a999cec10a5',
  name: 'get-mail-signature',
  description: 'Returns one mailbox signature for the HTML editor',
  timeoutSeconds: 20,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/signature',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
