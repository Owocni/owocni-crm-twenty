import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import { prepareHtmlForPicker } from 'src/utils/prepareHtmlForPicker';
import {
  personVars,
  resolvePersonContext,
} from 'src/utils/personContext';

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
  const email = event.queryStringParameters?.email?.trim();

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

  let person = null;

  try {
    person = await resolvePersonContext(coreClient, { recordId, email });
  } catch (personError) {
    console.log('MAIL_TEMPLATE_PERSON_FAIL', personError);
  }

  const vars = personVars(person);
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
