import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

type MailTemplateSummary = {
  id: string;
  name: string;
  category: string;
  priority: string;
  subjectTemplate: string;
};

type PersonRecord = {
  firstName: string;
  lastName: string;
  clientName: string;
  email: string;
  companyName: string;
};

const handler = async (event: RoutePayload) => {
  const recordId =
    typeof event.queryStringParameters?.recordId === 'string'
      ? event.queryStringParameters.recordId
      : null;

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

  let person: PersonRecord | null = null;

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

    person = {
      firstName,
      lastName,
      clientName: [firstName, lastName].filter(Boolean).join(' '),
      email: row?.emails?.primaryEmail ?? '',
      companyName: row?.company?.name ?? '',
    };
  }

  return { templates, person };
};

export default defineLogicFunction({
  universalIdentifier: '7182f1e9-c895-4663-828a-9b73d3beac22',
  name: 'list-mail-picker-data',
  description: 'Returns mail templates and optional person context for the picker',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/picker-data',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
