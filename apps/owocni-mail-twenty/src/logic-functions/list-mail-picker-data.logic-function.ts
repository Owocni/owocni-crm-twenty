import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import {
  resolveMailContext,
  type PersonContext,
} from 'src/utils/personContext';
import {
  findSuggestedReply,
  type RecentRecipient,
  type SuggestedReply,
} from 'src/utils/suggestedReply';

type MailTemplateSummary = {
  id: string;
  name: string;
  category: string;
  priority: string;
  subjectTemplate: string;
};

const handler = async (event: RoutePayload) => {
  const recordId =
    typeof event.queryStringParameters?.recordId === 'string'
      ? event.queryStringParameters.recordId
      : null;
  const email =
    typeof event.queryStringParameters?.email === 'string'
      ? event.queryStringParameters.email
      : null;
  const skipRecent = event.queryStringParameters?.skipRecent === '1';

  const coreClient = new CoreApiClient();

  const templatesResult = await coreClient.query({
    mailTemplates: {
      __args: {
        filter: { isActive: { eq: true } },
        first: 100,
      },
      edges: {
        node: {
          id: true,
          name: true,
          category: true,
          priority: true,
          subjectTemplate: true,
        },
      },
    },
  });

  const templates: MailTemplateSummary[] = (
    templatesResult.mailTemplates?.edges ?? []
  )
    .map((edge: { node: Record<string, unknown> }) => edge.node)
    .filter(Boolean)
    .map((node: Record<string, unknown>) => ({
      id: String(node.id),
      name: String(node.name ?? ''),
      category: String(node.category ?? 'GENERAL'),
      priority: String(node.priority ?? 'NICE'),
      subjectTemplate: String(node.subjectTemplate ?? ''),
    }))
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority === 'MUST' ? -1 : 1;
      }

      return a.name.localeCompare(b.name, 'pl');
    });

  let person: PersonContext | null = null;
  let replySubject: string | null = null;
  let contextKind: string | null = null;
  let resolveError: string | null = null;

  try {
    const resolved = await resolveMailContext(coreClient, { recordId, email });
    person = resolved.person;
    replySubject = resolved.replySubject;
    contextKind = resolved.contextKind;
  } catch (personError) {
    resolveError =
      personError instanceof Error ? personError.message : String(personError);
  }

  // Mailbox "latest" is NEVER merged into person/replySubject — that filled
  // unrelated leads (e.g. patrycjabierka) when recordId was missing.
  let recentRecipients: RecentRecipient[] = [];
  let suggestedReply: SuggestedReply | null = null;
  let recentDebug: Record<string, unknown> = { skipped: skipRecent };

  if (!skipRecent) {
    const recent = await findSuggestedReply(coreClient);
    recentRecipients = recent.recipients;
    suggestedReply = recent.suggestedReply;
    recentDebug = recent.debug;

    // Subject from mailbox only when it matches the already-resolved person.
    if (
      person?.email &&
      !replySubject &&
      suggestedReply?.email === person.email &&
      suggestedReply.subject
    ) {
      replySubject = suggestedReply.subject;
    }
  }

  return {
    templates,
    person,
    replySubject,
    contextKind,
    contextRecordId: recordId,
    recentRecipients,
    suggestedReply,
    debug: {
      recordId,
      emailParam: email,
      resolveError,
      personEmail: person?.email ?? null,
      replySubject,
      contextKind,
      recent: recentDebug,
      suggestedReply,
      note: 'suggestedReply not applied as person fallback',
    },
  };
};

export default defineLogicFunction({
  universalIdentifier: '7182f1e9-c895-4663-828a-9b73d3beac22',
  name: 'list-mail-picker-data',
  description: 'Returns mail templates and optional person context for the picker',
  timeoutSeconds: 45,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/picker-data',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
