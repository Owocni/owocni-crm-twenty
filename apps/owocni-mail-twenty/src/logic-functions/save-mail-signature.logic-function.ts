import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import { parseRouteBody, readStringField } from 'src/utils/parseRouteBody';
import { htmlFromRichTextField } from 'src/utils/mailSignature';

const MAX_HTML_LENGTH = 512_000;

const handler = async (event: RoutePayload) => {
  const payload = parseRouteBody(event);
  const recordId = readStringField(payload, 'recordId', 'id');
  const name = readStringField(payload, 'name');
  const mailboxHandle = readStringField(payload, 'mailboxHandle');
  const bodyHtml = readStringField(payload, 'bodyHtml', 'html');

  if (!recordId) {
    return { ok: false, error: 'recordId is required' };
  }

  if (bodyHtml.length > MAX_HTML_LENGTH) {
    return { ok: false, error: 'html is too large' };
  }

  const coreClient = new CoreApiClient();
  const data: Record<string, unknown> = {
    bodyHtml: { markdown: bodyHtml },
  };

  if (name) {
    data.name = name;
  }

  if (mailboxHandle) {
    data.mailboxHandle = mailboxHandle;
  }

  const result = await coreClient.mutation({
    updateMailSignature: {
      __args: {
        id: recordId,
        data,
      },
      id: true,
      name: true,
      mailboxHandle: true,
      bodyHtml: { markdown: true },
    },
  } as never);

  const updated = (
    result as {
      updateMailSignature?: {
        id?: string;
        name?: string;
        mailboxHandle?: string;
        bodyHtml?: unknown;
      };
    }
  ).updateMailSignature;

  if (!updated?.id) {
    return { ok: false, error: 'Nie udało się zapisać stopki' };
  }

  return {
    ok: true,
    id: updated.id,
    name: updated.name ?? name,
    mailboxHandle: updated.mailboxHandle ?? mailboxHandle,
    bodyHtml: htmlFromRichTextField(updated.bodyHtml) || bodyHtml,
  };
};

export default defineLogicFunction({
  universalIdentifier: 'fb59f2f1-e82b-43f6-8be7-df8eda1b585e',
  name: 'save-mail-signature',
  description: 'Saves mailbox signature HTML from the visual editor',
  timeoutSeconds: 20,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/signature-save',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
