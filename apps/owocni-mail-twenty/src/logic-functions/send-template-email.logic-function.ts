import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import { getEditorDraft, getEditorDraftFresh, saveEditorDraft, clearEditorDraft } from 'src/logic-functions/editor-draft-store';
import {
  findSendableEmailAccount,
  mapSendEmailError,
  resolveContinuationHandles,
} from 'src/utils/findSendableEmailAccount';
import {
  parseRouteBody,
  readNumberField,
  readStringField,
} from 'src/utils/parseRouteBody';
import {
  personVars,
  resolvePersonContext,
} from 'src/utils/personContext';
import { decideInReplyTo } from 'src/utils/replyThreading';
import { resolveSendHtmlBody } from 'src/utils/resolveSendHtmlBody';
import {
  assertInternalHandoffRecipients,
  handoffPendingDraftKey,
  injectHandoffMarker,
  toInternalHandoffSubject,
} from 'src/utils/internalHandoff';
import { attachInternalHandoffThread } from 'src/utils/attachInternalHandoffThread';
import {
  clampDelayMs,
  isSendJobTerminal,
  sendJobDraftKey,
  waitUnlessCancelled,
} from 'src/utils/delayedSend';
import { readAttachmentRefs } from 'src/utils/uploadEmailAttachment';
import {
  emailsExcluding,
  formatEmailList,
  parseEmailList,
} from 'src/utils/parseEmailList';
import { isComposerV2Payload } from 'src/utils/composerV2Flag';
import { isUnintendedEmptyReply } from 'src/utils/mailSignature';
import {
  composerV2EnvelopeKey,
  parseComposerV2EnvelopeJson,
} from 'src/utils/composerV2Iframe';
import {
  composerSendAttemptKey,
  hashSendBody,
  parseComposerSendAttempt,
  serializeComposerSendAttempt,
} from 'src/utils/composerSendAttempt';

function applyVars(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    text,
  );
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    const graphQLError = error as Error & {
      errors?: Array<{ message?: string }>;
    };

    const nested = graphQLError.errors
      ?.map((entry) => entry.message)
      .filter(Boolean)
      .join('; ');

    if (nested) {
      return mapSendEmailError(nested);
    }

    return mapSendEmailError(error.message);
  }

  return mapSendEmailError(String(error));
}

function looksLikeUnknownCcBccField(error: unknown): boolean {
  const text = formatError(error).toLowerCase();
  return (
    (text.includes('cc') || text.includes('bcc')) &&
    (text.includes('unknown') ||
      text.includes('not defined') ||
      text.includes('cannot query field') ||
      text.includes('field undefined'))
  );
}

const handler = async (event: RoutePayload) => {
  try {
    const payload = parseRouteBody(event);
    const action = readStringField(payload, 'action');
    // Only explicit jobId — draftSessionId is the HTML store and must not
    // inherit a cancelled flag from „Wyślij teraz”.
    const jobId = readStringField(payload, 'jobId');

    if (action === 'cancel') {
      if (!jobId) {
        return { ok: false, error: 'jobId is required' };
      }

      await saveEditorDraft(sendJobDraftKey(jobId), 'cancelled');
      return { ok: true, cancelled: true };
    }

    if (jobId) {
      const jobStatus = (await getEditorDraftFresh(sendJobDraftKey(jobId)))?.trim();

      if (jobStatus === 'cancelled') {
        return { ok: true, cancelled: true };
      }

      if (jobStatus === 'sent') {
        return { ok: true, alreadySent: true };
      }
    }

    const composerV2 = isComposerV2Payload(payload);
    const delayMs = composerV2
      ? 0
      : clampDelayMs(readNumberField(payload, 'delayMs'));

    if (jobId && delayMs > 0) {
      const waited = await waitUnlessCancelled({
        delayMs,
        isCancelled: async () =>
          isSendJobTerminal(
            await getEditorDraftFresh(sendJobDraftKey(jobId)),
          ),
      });

      if (waited === 'cancelled') {
        return { ok: true, cancelled: true };
      }

      const afterWait = (await getEditorDraftFresh(sendJobDraftKey(jobId)))?.trim();

      if (afterWait === 'cancelled') {
        return { ok: true, cancelled: true };
      }

      if (afterWait === 'sent') {
        return { ok: true, alreadySent: true };
      }
    }

    const templateId = readStringField(payload, 'templateId');
    const recordId = readStringField(payload, 'recordId');
    const customSubject = readStringField(payload, 'subject');
    const customTo = readStringField(payload, 'to');
    const requestedAccountId = readStringField(payload, 'connectedAccountId');
    const inReplyToMessageId = readStringField(payload, 'inReplyToMessageId');
    const sendMode = readStringField(payload, 'mode', 'sendMode');
    const opportunityId = readStringField(
      payload,
      'opportunityId',
      'opportunityRecordId',
    );
    const internalHandoff = sendMode === 'internal';
    const isForward = sendMode === 'forward';
    const composeDraftKey = readStringField(payload, 'composeDraftKey');
    let attachmentFiles = readAttachmentRefs(payload);
    const ccRaw = readStringField(payload, 'cc', 'ccEmails');
    const bccRaw = readStringField(payload, 'bcc', 'bccEmails');

    if (composerV2 && attachmentFiles.length === 0) {
      const editorSessionId = readStringField(
        payload,
        'editorSessionId',
        'sessionId',
      );
      if (editorSessionId) {
        const stored = parseComposerV2EnvelopeJson(
          await getEditorDraftFresh(composerV2EnvelopeKey(editorSessionId)),
        );
        if (stored) {
          attachmentFiles = readAttachmentRefs(
            stored as Record<string, unknown>,
          );
        }
      }
    }
    const { html: customBody, clientSent: clientSentBody } =
      await resolveSendHtmlBody(payload, composerV2 ? undefined : getEditorDraft);

    if (composerV2 && isUnintendedEmptyReply(customBody)) {
      return {
        ok: false,
        error:
          'Treść maila jest pusta (sama stopka, cytat albo placeholder).',
      };
    }

    if (!recordId && !customTo) {
      return { ok: false, error: 'recordId or to is required' };
    }

    if (!customBody && !templateId) {
      return { ok: false, error: 'templateId or body is required' };
    }

    if (clientSentBody && !customBody) {
      return {
        ok: false,
        error:
          'Treść z edytora nie dotarła (pusta). Spróbuj przełączyć na „Kod HTML”, sprawdź treść i wyślij ponownie.',
      };
    }

    const attemptId = readStringField(payload, 'attemptId');
    const bodyHash = hashSendBody(customBody);
    if (composerV2 && attemptId) {
      const attemptKey = composerSendAttemptKey(attemptId);
      const existing = parseComposerSendAttempt(
        await getEditorDraftFresh(attemptKey),
      );
      if (existing?.status === 'sent') {
        return {
          ok: true,
          alreadySent: true,
          bodyHash: existing.bodyHash,
        };
      }
      await saveEditorDraft(
        attemptKey,
        serializeComposerSendAttempt('sending', bodyHash),
      );
    }

    const coreClient = new CoreApiClient();
    const metadataClient = new MetadataApiClient();

    let subject = customSubject ?? '';
    let htmlBody = '';
    let templateName = 'Własna treść';

    const person = await resolvePersonContext(coreClient, {
      recordId,
      email: internalHandoff ? undefined : customTo,
    });
    const email = internalHandoff
      ? customTo
      : customTo || person?.email?.trim();

    if (!email) {
      return { ok: false, error: 'Person has no primary email' };
    }

    if (internalHandoff) {
      const gate = assertInternalHandoffRecipients({
        to: email,
        cc: ccRaw,
        bcc: bccRaw,
        clientEmail: person?.email,
      });
      if (!gate.ok) {
        return { ok: false, error: gate.error };
      }
      if (!opportunityId) {
        return {
          ok: false,
          error: 'Przekazanie wewnętrzne tylko z karty leada.',
        };
      }
    }

    const cc = formatEmailList(
      emailsExcluding(parseEmailList(ccRaw), email),
    );
    const bcc = formatEmailList(
      emailsExcluding(parseEmailList(bccRaw), email).filter(
        (address) => !parseEmailList(cc).includes(address),
      ),
    );
    const copies = {
      ...(cc ? { cc } : {}),
      ...(bcc ? { bcc } : {}),
    };

    // Client-composed body always wins — never reload template from DB when htmlBody was sent.
    if (clientSentBody || customBody) {
      htmlBody = customBody;
      subject = customSubject ?? subject;

      if (templateId) {
        const templateResult = await coreClient.query({
          mailTemplates: {
            __args: {
              filter: {
                and: [{ id: { eq: templateId } }, { isActive: { eq: true } }],
              },
              first: 1,
            },
            edges: {
              node: {
                id: true,
                name: true,
              },
            },
          },
        });

        templateName =
          templateResult.mailTemplates?.edges?.[0]?.node?.name ?? templateName;
      }
    } else if (templateId) {
      const templateResult = await coreClient.query({
        mailTemplates: {
          __args: {
            filter: {
              and: [{ id: { eq: templateId } }, { isActive: { eq: true } }],
            },
            first: 1,
          },
          edges: {
            node: {
              id: true,
              name: true,
              subjectTemplate: true,
              bodyHtmlTemplate: { markdown: true },
            },
          },
        },
      });

      const template = templateResult.mailTemplates?.edges?.[0]?.node;

      if (!template) {
        return { ok: false, error: 'Template not found' };
      }

      const vars = personVars(person);

      templateName = template.name;
      subject =
        customSubject || applyVars(String(template.subjectTemplate ?? ''), vars);
      const bodyMarkdown =
        typeof template.bodyHtmlTemplate === 'object' &&
        template.bodyHtmlTemplate !== null &&
        'markdown' in template.bodyHtmlTemplate
          ? String(
              (template.bodyHtmlTemplate as { markdown?: string }).markdown ?? '',
            )
          : '';
      htmlBody = applyVars(bodyMarkdown, vars);
    }

    if (!htmlBody) {
      return { ok: false, error: 'Email body is empty' };
    }

    if (internalHandoff) {
      subject = toInternalHandoffSubject(subject);
      htmlBody = injectHandoffMarker(htmlBody, opportunityId);
    }

    let continuationHandles: string[] = [];

    try {
      continuationHandles =
        internalHandoff || isForward
          ? []
          : await resolveContinuationHandles(coreClient, {
              recordId,
              recipientEmail: email,
            });
    } catch {
      continuationHandles = [];
    }

    let connectedAccount;

    try {
      connectedAccount = await findSendableEmailAccount(metadataClient, {
        preferredAccountId: requestedAccountId,
        continuationHandles,
        recordId,
        recipientEmail: email,
      });
    } catch (accountError) {
      return {
        ok: false,
        error: formatError(accountError),
      };
    }

    if (!connectedAccount?.id) {
      return {
        ok: false,
        error: mapSendEmailError('No message channel found'),
      };
    }

    let inReplyTo: string | undefined;

    if (inReplyToMessageId && !internalHandoff && !isForward) {
      try {
        const messageResult = await coreClient.query({
          message: {
            __args: { filter: { id: { eq: inReplyToMessageId } } },
            headerMessageId: true,
            messageParticipants: {
              edges: {
                node: {
                  handle: true,
                },
              },
            },
          },
        } as never);

        const message = (
          messageResult as {
            message?: {
              headerMessageId?: string | null;
              messageParticipants?: {
                edges?: Array<{ node?: { handle?: string | null } }>;
              };
            } | null;
          }
        ).message;

        const decided = decideInReplyTo({
          recipientEmail: email,
          headerMessageId: message?.headerMessageId,
          participantHandles:
            message?.messageParticipants?.edges?.map(
              (edge) => edge.node?.handle,
            ) ?? [],
        });

        if (decided.ok) {
          inReplyTo = decided.headerMessageId;
        }
      } catch {
        // Threading optional — still send as new message from own mailbox.
      }
    }

    let sendResult;
    let copiesDropped = false;

    const sendInputBase = {
      connectedAccountId: connectedAccount.id,
      to: email,
      subject: subject || '(brak tematu)',
      body: htmlBody,
      ...copies,
      ...(attachmentFiles.length > 0 ? { files: attachmentFiles } : {}),
    };
    const sendInputWithoutCopies = {
      connectedAccountId: connectedAccount.id,
      to: email,
      subject: subject || '(brak tematu)',
      body: htmlBody,
      ...(attachmentFiles.length > 0 ? { files: attachmentFiles } : {}),
    };

    const mutateSend = (input: Record<string, unknown>) =>
      metadataClient.mutation({
        sendEmail: {
          __args: { input },
          success: true,
          error: true,
        },
      });

    try {
      sendResult = await mutateSend({
        ...sendInputBase,
        ...(inReplyTo ? { inReplyTo } : {}),
      });
    } catch (sendError) {
      if (inReplyTo) {
        try {
          sendResult = await mutateSend(sendInputBase);
        } catch (retryError) {
          if (Object.keys(copies).length > 0 && looksLikeUnknownCcBccField(retryError)) {
            copiesDropped = true;
            try {
              sendResult = await mutateSend(sendInputWithoutCopies);
            } catch (droppedError) {
              return { ok: false, error: formatError(droppedError) };
            }
          } else {
            return { ok: false, error: formatError(retryError) };
          }
        }
      } else if (
        Object.keys(copies).length > 0 &&
        looksLikeUnknownCcBccField(sendError)
      ) {
        copiesDropped = true;
        try {
          sendResult = await mutateSend(sendInputWithoutCopies);
        } catch (droppedError) {
          return { ok: false, error: formatError(droppedError) };
        }
      } else {
        return { ok: false, error: formatError(sendError) };
      }
    }

    if (!sendResult.sendEmail?.success) {
      return {
        ok: false,
        error: mapSendEmailError(
          sendResult.sendEmail?.error ?? 'sendEmail failed',
        ),
      };
    }

    if (jobId) {
      await saveEditorDraft(sendJobDraftKey(jobId), 'sent');
    }

    if (composeDraftKey) {
      await clearEditorDraft(composeDraftKey);
    }

    let threadAttached = false;
    if (internalHandoff && opportunityId) {
      await saveEditorDraft(
        handoffPendingDraftKey(opportunityId),
        JSON.stringify({
          subject: subject || '(brak tematu)',
          to: email,
          from: connectedAccount.handle,
          sentAt: new Date().toISOString(),
        }),
      );
      const attached = await attachInternalHandoffThread({
        coreClient,
        opportunityId,
        subject: subject || '(brak tematu)',
        to: email,
        from: connectedAccount.handle,
      });
      threadAttached = attached.attached;
      if (threadAttached) {
        await saveEditorDraft(handoffPendingDraftKey(opportunityId), 'attached');
      }
    }

    if (composerV2 && attemptId) {
      await saveEditorDraft(
        composerSendAttemptKey(attemptId),
        serializeComposerSendAttempt('sent', bodyHash),
      );
    }

    return {
      ok: true,
      to: email,
      cc: copiesDropped ? '' : cc,
      bcc: copiesDropped ? '' : bcc,
      copiesDropped,
      subject,
      templateName,
      from: connectedAccount.handle,
      bodySource: clientSentBody || customBody ? 'client' : 'template',
      bodyLength: htmlBody.length,
      bodyHash,
      ...(internalHandoff ? { internalHandoff: true, threadAttached } : {}),
    };
  } catch (unexpectedError) {
    return {
      ok: false,
      error: formatError(unexpectedError),
    };
  }
};

export default defineLogicFunction({
  universalIdentifier: 'd29a3e9b-1727-4c1e-badf-8372b80ab735',
  name: 'send-template-email',
  description: 'Sends a composed or templated email to the person on the record',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/send-template',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
