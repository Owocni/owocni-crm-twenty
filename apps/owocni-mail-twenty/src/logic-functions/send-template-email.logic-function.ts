import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import {
  findSendableEmailAccount,
  mapSendEmailError,
  resolveContinuationHandles,
} from 'src/utils/findSendableEmailAccount';
import {
  parseRouteBody,
  payloadHasClientBody,
  readClientHtmlBody,
  readStringField,
} from 'src/utils/parseRouteBody';
import {
  personVars,
  resolvePersonContext,
} from 'src/utils/personContext';
import { decideInReplyTo } from 'src/utils/replyThreading';
import { readAttachmentRefs } from 'src/utils/uploadEmailAttachment';

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

const handler = async (event: RoutePayload) => {
  try {
    const payload = parseRouteBody(event);

    const templateId = readStringField(payload, 'templateId');
    const recordId = readStringField(payload, 'recordId');
    const customSubject = readStringField(payload, 'subject');
    const customBody = readClientHtmlBody(payload);
    const customTo = readStringField(payload, 'to');
    const requestedAccountId = readStringField(payload, 'connectedAccountId');
    const inReplyToMessageId = readStringField(payload, 'inReplyToMessageId');
    const attachmentFiles = readAttachmentRefs(payload);
    const clientSentBody = payloadHasClientBody(payload);

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

    const coreClient = new CoreApiClient();
    const metadataClient = new MetadataApiClient();

    let subject = customSubject ?? '';
    let htmlBody = '';
    let templateName = 'Własna treść';

    const person = await resolvePersonContext(coreClient, {
      recordId,
      email: customTo,
    });
    const email = customTo || person?.email?.trim();

    if (!email) {
      return { ok: false, error: 'Person has no primary email' };
    }

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

    let continuationHandles: string[] = [];

    try {
      continuationHandles = await resolveContinuationHandles(coreClient, {
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

    if (inReplyToMessageId) {
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

    const sendInputBase = {
      connectedAccountId: connectedAccount.id,
      to: email,
      subject: subject || '(brak tematu)',
      body: htmlBody,
      ...(attachmentFiles.length > 0 ? { files: attachmentFiles } : {}),
    };

    try {
      sendResult = await metadataClient.mutation({
        sendEmail: {
          __args: {
            input: {
              ...sendInputBase,
              ...(inReplyTo ? { inReplyTo } : {}),
            },
          },
          success: true,
          error: true,
        },
      });
    } catch (sendError) {
      // Older Twenty builds may reject unknown inReplyTo — retry without threading.
      if (inReplyTo) {
        try {
          sendResult = await metadataClient.mutation({
            sendEmail: {
              __args: {
                input: sendInputBase,
              },
              success: true,
              error: true,
            },
          });
        } catch (retryError) {
          return {
            ok: false,
            error: formatError(retryError),
          };
        }
      } else {
        return {
          ok: false,
          error: formatError(sendError),
        };
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

    return {
      ok: true,
      to: email,
      subject,
      templateName,
      from: connectedAccount.handle,
      bodySource: clientSentBody || customBody ? 'client' : 'template',
      bodyLength: htmlBody.length,
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
