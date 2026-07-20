import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

export type RecipientSearchHit = {
  recordId: string;
  kind: 'opportunity' | 'person';
  label: string;
  email: string;
  companyName?: string;
};

type OpportunityNode = {
  id?: string;
  name?: string | null;
  bizCardEmail?: string | null;
  pointOfContact?: {
    id?: string;
    name?: { firstName?: string | null; lastName?: string | null } | null;
    emails?: { primaryEmail?: string | null } | null;
  } | null;
  company?: { name?: string | null } | null;
};

type PersonNode = {
  id?: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  emails?: { primaryEmail?: string | null } | null;
  company?: { name?: string | null } | null;
};

function personLabel(node: PersonNode): string {
  return [node.name?.firstName, node.name?.lastName].filter(Boolean).join(' ');
}

async function searchOpportunities(
  coreClient: CoreApiClient,
  query: string,
): Promise<RecipientSearchHit[]> {
  try {
    const result = await coreClient.query({
      opportunities: {
        __args: {
          filter: {
            or: [
              { name: { ilike: `%${query}%` } },
              { bizCardEmail: { ilike: `%${query}%` } },
            ],
          },
          first: 8,
          orderBy: [{ updatedAt: 'DescNullsLast' }],
        },
        edges: {
          node: {
            id: true,
            name: true,
            ...( { bizCardEmail: true } as Record<string, unknown> ),
            pointOfContact: {
              id: true,
              name: { firstName: true, lastName: true },
              emails: { primaryEmail: true },
            },
            company: { name: true },
          },
        },
      },
    } as never);

    const edges =
      (
        result as {
          opportunities?: { edges?: Array<{ node?: OpportunityNode }> };
        }
      ).opportunities?.edges ?? [];

    const hits: RecipientSearchHit[] = [];

    for (const edge of edges) {
      const node = edge.node;
      if (!node?.id) {
        continue;
      }

      const contactEmail =
        node.pointOfContact?.emails?.primaryEmail?.trim().toLowerCase() || '';
      const cardEmail = node.bizCardEmail?.trim().toLowerCase() || '';
      const email = contactEmail || cardEmail;

      if (!email) {
        continue;
      }

      hits.push({
        recordId: String(node.id),
        kind: 'opportunity',
        label: (node.name ?? '').trim() || email,
        email,
        companyName: node.company?.name ?? undefined,
      });
    }

    return hits;
  } catch {
    return [];
  }
}

async function searchPeople(
  coreClient: CoreApiClient,
  query: string,
): Promise<RecipientSearchHit[]> {
  try {
    const result = await coreClient.query({
      people: {
        __args: {
          filter: {
            or: [
              { name: { firstName: { ilike: `%${query}%` } } },
              { name: { lastName: { ilike: `%${query}%` } } },
              { emails: { primaryEmail: { ilike: `%${query}%` } } },
            ],
          },
          first: 8,
          orderBy: [{ updatedAt: 'DescNullsLast' }],
        },
        edges: {
          node: {
            id: true,
            name: { firstName: true, lastName: true },
            emails: { primaryEmail: true },
            company: { name: true },
          },
        },
      },
    });

    const edges =
      (
        result as {
          people?: { edges?: Array<{ node?: PersonNode }> };
        }
      ).people?.edges ?? [];

    const hits: RecipientSearchHit[] = [];

    for (const edge of edges) {
      const node = edge.node;
      if (!node?.id) {
        continue;
      }

      const email = node.emails?.primaryEmail?.trim().toLowerCase() || '';
      if (!email) {
        continue;
      }

      const label = personLabel(node) || email;

      hits.push({
        recordId: String(node.id),
        kind: 'person',
        label,
        email,
        companyName: node.company?.name ?? undefined,
      });
    }

    return hits;
  } catch {
    return [];
  }
}

const handler = async (event: RoutePayload) => {
  const raw =
    typeof event.queryStringParameters?.q === 'string'
      ? event.queryStringParameters.q.trim()
      : '';

  if (raw.length < 2) {
    return { hits: [] as RecipientSearchHit[], query: raw };
  }

  const coreClient = new CoreApiClient();
  const [opportunities, people] = await Promise.all([
    searchOpportunities(coreClient, raw),
    searchPeople(coreClient, raw),
  ]);

  // Prefer opportunities (leads), then people; dedupe by email.
  const seen = new Set<string>();
  const hits: RecipientSearchHit[] = [];

  for (const hit of [...opportunities, ...people]) {
    if (seen.has(hit.email)) {
      continue;
    }
    seen.add(hit.email);
    hits.push(hit);
  }

  return { hits: hits.slice(0, 12), query: raw };
};

export default defineLogicFunction({
  universalIdentifier: 'b3c8e1a4-7f2d-4c9b-a1e5-6d8f0b2c4e7a',
  name: 'search-mail-recipients',
  description:
    'Search opportunities and people by name/email for mail recipient picker',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/search-recipients',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
