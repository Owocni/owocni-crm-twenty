import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import { prepareHtmlForPicker } from 'src/utils/prepareHtmlForPicker';

function applyVars(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    text,
  );
}

function resolveSubject(
  name: string,
  subjectTemplate: string,
  vars: Record<string, string>,
): string {
  const fromField = applyVars(subjectTemplate, vars).trim();
  if (fromField) {
    return fromField;
  }

  const nameParts = name.split(' — ');
  if (nameParts.length >= 2) {
    return applyVars(nameParts.slice(1).join(' — '), vars).trim();
  }

  return '';
}

const handler = async (event: RoutePayload) => {
  const templateId = event.queryStringParameters?.templateId?.trim();
  const recordId = event.queryStringParameters?.recordId?.trim();

  if (!templateId) {
    return { error: 'templateId is required' };
  }

  const coreClient = new CoreApiClient();

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
    return { error: 'Template not found' };
  }

  let vars: Record<string, string> = {
    firstName: '',
    lastName: '',
    client_name: '',
    companyName: '',
    email: '',
  };

  if (recordId) {
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

    const row = personResult.person;
    const firstName = row?.name?.firstName ?? '';
    const lastName = row?.name?.lastName ?? '';

    vars = {
      firstName,
      lastName,
      client_name: [firstName, lastName].filter(Boolean).join(' '),
      companyName: row?.company?.name ?? '',
      email: row?.emails?.primaryEmail ?? '',
    };
  }

  const subjectTemplate = String(template.subjectTemplate ?? '');
  const bodyMarkdown =
    typeof template.bodyHtmlTemplate === 'object' &&
    template.bodyHtmlTemplate !== null &&
    'markdown' in template.bodyHtmlTemplate
      ? String(
          (template.bodyHtmlTemplate as { markdown?: string }).markdown ?? '',
        )
      : '';

  const subject = resolveSubject(String(template.name ?? ''), subjectTemplate, vars);
  const bodyHtml = prepareHtmlForPicker(applyVars(bodyMarkdown, vars));

  return {
    id: String(template.id),
    subject,
    body: bodyHtml,
    bodyHtml,
    subjectFromTemplate: Boolean(applyVars(subjectTemplate, vars).trim()),
  };
};

export default defineLogicFunction({
  universalIdentifier: '6db1c9d2-d6bc-4666-a0ea-e6a5a20fc465',
  name: 'get-mail-template',
  description: 'Returns one mail template with variables applied for the picker',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/template',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
