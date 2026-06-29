import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import {
  findSendableEmailAccount,
  mapSendEmailError,
} from 'src/utils/findSendableEmailAccount';
import { parseRouteBody, readStringField } from 'src/utils/parseRouteBody';

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
    const customBody = readStringField(
      payload,
      'htmlBody',
      'composedBody',
      'body',
      'messageHtml',
    );
    const customTo = readStringField(payload, 'to');
    const requestedAccountId = readStringField(payload, 'connectedAccountId');

    if (!recordId) {
      return { ok: false, error: 'recordId is required' };
    }

    if (!customBody && !templateId) {
      return { ok: false, error: 'templateId or body is required' };
    }

    const coreClient = new CoreApiClient();
    const metadataClient = new MetadataApiClient();

    let subject = customSubject ?? '';
    let htmlBody = '';
    let templateName = 'Własna treść';

    const personResult = await coreClient.query({
      person: {
        __args: {
          filter: { id: { eq: recordId } },
        },
        name: { firstName: true, lastName: true },
        emails: { primaryEmail: true },
        company: { name: true },
      },
    });

    const person = personResult.person;
    const email = customTo || person?.emails?.primaryEmail?.trim();

    if (!email) {
      return { ok: false, error: 'Person has no primary email' };
    }

    if (customBody) {
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

      const firstName = person?.name?.firstName ?? '';
      const lastName = person?.name?.lastName ?? '';
      const vars = {
        firstName,
        lastName,
        client_name: [firstName, lastName].filter(Boolean).join(' '),
        companyName: person?.company?.name ?? '',
        email,
      };

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

    let connectedAccount;

    try {
      connectedAccount = await findSendableEmailAccount(
        metadataClient,
        requestedAccountId,
      );
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

    let sendResult;

    try {
      sendResult = await metadataClient.mutation({
        sendEmail: {
          __args: {
            input: {
              connectedAccountId: connectedAccount.id,
              to: email,
              subject: subject || '(brak tematu)',
              body: htmlBody,
            },
          },
          success: true,
          error: true,
        },
      });
    } catch (sendError) {
      return {
        ok: false,
        error: formatError(sendError),
      };
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
      bodySource: customBody ? 'client' : 'template',
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
