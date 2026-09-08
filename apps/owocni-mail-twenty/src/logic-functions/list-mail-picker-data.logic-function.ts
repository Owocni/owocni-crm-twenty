import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import { prepareHtmlForPicker } from 'src/utils/prepareHtmlForPicker';
import {
  catalogFromCrmRows,
  htmlFromRichTextField,
  mergeSignatureCatalog,
  type SignatureCatalog,
} from 'src/utils/mailSignature';
import {
  isInternalMailbox,
  listInternalThreadMessagesForOpportunity,
  listThreadMessagesByEmail,
  listThreadMessagesByThreadId,
  resolveMailContext,
  type PersonContext,
  type ReplyMessagePreview,
  type ThreadMessage,
} from 'src/utils/personContext';
import { getEditorDraft, saveEditorDraft } from 'src/logic-functions/editor-draft-store';
import { ensureInternalHandoffAttached } from 'src/utils/attachInternalHandoffThread';
import { handoffPendingDraftKey } from 'src/utils/internalHandoff';
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

async function loadSignatureCatalog(
  coreClient: CoreApiClient,
): Promise<SignatureCatalog> {
  try {
    const signaturesResult = await coreClient.query({
      mailSignatures: {
        __args: {
          filter: { isActive: { eq: true } },
          first: 50,
        },
        edges: {
          node: {
            mailboxHandle: true,
            bodyHtml: { markdown: true },
          },
        },
      },
    });

    const rows = (signaturesResult.mailSignatures?.edges ?? [])
      .map((edge: { node?: Record<string, unknown> }) => edge.node)
      .filter(Boolean)
      .map((node: Record<string, unknown>) => ({
        mailboxHandle: String(node.mailboxHandle ?? ''),
        bodyHtml: prepareHtmlForPicker(htmlFromRichTextField(node.bodyHtml)),
      }));

    return mergeSignatureCatalog(catalogFromCrmRows(rows));
  } catch (signatureError) {
    console.log('MAIL_SIGNATURES_LOAD_FAIL', signatureError);

    return mergeSignatureCatalog(null);
  }
}

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
  const signatureByHandle = await loadSignatureCatalog(coreClient);

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
  let replyMessage: ReplyMessagePreview | null = null;
  let threadMessages: ThreadMessage[] = [];
  let contextKind: string | null = null;
  let resolvedThreadId: string | null = null;
  let resolveError: string | null = null;

  try {
    const resolved = await resolveMailContext(coreClient, { recordId, email });
    person = resolved.person;
    replySubject = resolved.replySubject;
    replyMessage = resolved.replyMessage;
    contextKind = resolved.contextKind;
    const threadId =
      resolved.threadId ||
      (contextKind === 'messageThread' && recordId ? recordId : null);
    resolvedThreadId = threadId;
    const threadEmail = person?.email?.trim() || email;
    const mailContext =
      contextKind === 'message' || contextKind === 'messageThread';

    if (threadId) {
      threadMessages = await listThreadMessagesByThreadId(coreClient, threadId);
    } else if (
      threadEmail &&
      !mailContext &&
      !isInternalMailbox(threadEmail)
    ) {
      threadMessages = await listThreadMessagesByEmail(coreClient, threadEmail);
    }

    if (contextKind === 'opportunity' && recordId) {
      try {
        const pendingRaw = await getEditorDraft(handoffPendingDraftKey(recordId));
        let pending: { subject: string; to: string; from: string } | null =
          null;
        if (pendingRaw && pendingRaw !== 'attached') {
          try {
            const parsed = JSON.parse(pendingRaw) as {
              subject?: string;
              to?: string;
              from?: string;
            };
            if (parsed.to && parsed.from) {
              pending = {
                subject: parsed.subject ?? '',
                to: parsed.to,
                from: parsed.from,
              };
            }
          } catch {
            pending = null;
          }
        }
        const attached = await ensureInternalHandoffAttached({
          coreClient,
          opportunityId: recordId,
          pending,
        });
        if (attached) {
          await saveEditorDraft(handoffPendingDraftKey(recordId), 'attached');
        }
      } catch {
        // History still loads even if attach retry fails.
      }

      const internalMessages =
        await listInternalThreadMessagesForOpportunity(coreClient, recordId);
      if (internalMessages.length > 0) {
        const seen = new Set(
          threadMessages.map((message) => message.messageId).filter(Boolean),
        );
        threadMessages = [
          ...threadMessages,
          ...internalMessages.filter(
            (message) =>
              message.messageId && !seen.has(message.messageId),
          ),
        ].sort((left, right) => {
          const leftAt = left.receivedAt ? Date.parse(left.receivedAt) : 0;
          const rightAt = right.receivedAt ? Date.parse(right.receivedAt) : 0;
          return rightAt - leftAt;
        });
      }
    }

    if (threadMessages.length === 0 && replyMessage?.messageId) {
      threadMessages = [
        {
          ...replyMessage,
          direction: 'in',
          channel: isInternalMailbox(replyMessage.fromEmail ?? '')
            ? 'internal'
            : 'client',
        },
      ];
    }
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
    signatureByHandle,
    person,
    replySubject,
    replyMessage,
    threadMessages,
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
      replyMessageId: replyMessage?.messageId ?? null,
      replyMessageTextLen: replyMessage?.text?.length ?? 0,
      threadMessageCount: threadMessages.length,
      threadId: resolvedThreadId,
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
  description:
    'Returns mail templates, per-mailbox signatures, and optional person context for the picker',
  timeoutSeconds: 45,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/picker-data',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
