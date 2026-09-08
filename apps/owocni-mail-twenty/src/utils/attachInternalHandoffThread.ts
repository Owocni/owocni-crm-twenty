import type { CoreApiClient } from 'twenty-client-sdk/core';

import { extractEmailFromHandle } from 'src/utils/personContext';

type ParticipantRow = {
  handle?: string | null;
  role?: string | null;
  message?: {
    id?: string | null;
    subject?: string | null;
    messageThreadId?: string | null;
    messageParticipants?: {
      edges?: Array<{
        node?: { handle?: string | null; role?: string | null };
      }>;
    };
  } | null;
};

function normalizeHandoffSubject(subject: string | null | undefined): string {
  return (subject ?? '')
    .trim()
    .replace(/^(re|odp|fw|fwd)\s*:\s*/gi, '')
    .trim()
    .toLowerCase();
}

function handleOf(handle: string | null | undefined): string {
  return extractEmailFromHandle(handle ?? '');
}

export function pickHandoffMessageThreadId(input: {
  subject: string;
  to: string;
  from: string;
  rows: ParticipantRow[];
}): string | null {
  const wantSubject = normalizeHandoffSubject(input.subject);
  const wantTo = extractEmailFromHandle(input.to);
  const wantFrom = extractEmailFromHandle(input.from);
  if (!wantSubject || !wantTo || !wantFrom) {
    return null;
  }

  for (const row of input.rows) {
    const message = row.message;
    const threadId = message?.messageThreadId?.trim();
    if (!threadId) {
      continue;
    }
    if (normalizeHandoffSubject(message.subject) !== wantSubject) {
      continue;
    }

    const nodes = [
      { handle: row.handle, role: row.role },
      ...(message.messageParticipants?.edges?.map((edge) => edge.node) ?? []),
    ];
    const handles = nodes.map((node) => handleOf(node?.handle));
    if (handles.includes(wantTo) && handles.includes(wantFrom)) {
      return threadId;
    }
  }

  return null;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function findHandoffThreadId(
  coreClient: CoreApiClient,
  input: { subject: string; to: string; from: string },
): Promise<string | null> {
  const to = extractEmailFromHandle(input.to);
  if (!to) {
    return null;
  }

  try {
    const result = await coreClient.query({
      messageParticipants: {
        __args: {
          filter: { handle: { eq: to } },
          first: 20,
          orderBy: [{ createdAt: 'DescNullsLast' }],
        },
        edges: {
          node: {
            role: true,
            handle: true,
            message: {
              id: true,
              subject: true,
              messageThreadId: true,
              messageParticipants: {
                edges: {
                  node: {
                    handle: true,
                    role: true,
                  },
                },
              },
            },
          },
        },
      },
    } as never);

    const rows =
      (
        result as {
          messageParticipants?: { edges?: Array<{ node?: ParticipantRow }> };
        }
      ).messageParticipants?.edges?.map((edge) => edge.node) ?? [];

    return pickHandoffMessageThreadId({
      subject: input.subject,
      to,
      from: input.from,
      rows: rows.filter((row): row is ParticipantRow => Boolean(row)),
    });
  } catch {
    return null;
  }
}

async function createOpportunityThreadTarget(
  coreClient: CoreApiClient,
  threadId: string,
  opportunityId: string,
): Promise<string | null> {
  try {
    const existing = await coreClient.query({
      messageThreadTargets: {
        __args: {
          filter: {
            and: [
              { messageThreadId: { eq: threadId } },
              { targetOpportunityId: { eq: opportunityId } },
            ],
          },
          first: 1,
        },
        edges: {
          node: { id: true },
        },
      },
    } as never);
    const existingId = (
      existing as {
        messageThreadTargets?: { edges?: Array<{ node?: { id?: string } }> };
      }
    ).messageThreadTargets?.edges?.[0]?.node?.id;
    if (existingId) {
      return existingId;
    }
  } catch {
    // create anyway
  }

  try {
    const result = await coreClient.mutation({
      createMessageThreadTarget: {
        __args: {
          data: {
            messageThreadId: threadId,
            targetOpportunityId: opportunityId,
            isManuallyAssigned: true,
            isAutomaticallyAssigned: false,
          },
        },
        id: true,
      },
    } as never);

    return (
      (
        result as {
          createMessageThreadTarget?: { id?: string | null };
        }
      ).createMessageThreadTarget?.id ?? null
    );
  } catch {
    return null;
  }
}

export async function attachInternalHandoffThread(input: {
  coreClient: CoreApiClient;
  opportunityId: string;
  subject: string;
  to: string;
  from: string;
}): Promise<{ threadId: string | null; attached: boolean }> {
  const attempts = 3;
  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) {
      await sleep(2000);
    }
    const threadId = await findHandoffThreadId(input.coreClient, {
      subject: input.subject,
      to: input.to,
      from: input.from,
    });
    if (!threadId) {
      continue;
    }
    const targetId = await createOpportunityThreadTarget(
      input.coreClient,
      threadId,
      input.opportunityId,
    );
    return { threadId, attached: Boolean(targetId) };
  }

  return { threadId: null, attached: false };
}

async function findThreadIdsByHandoffMarker(
  coreClient: CoreApiClient,
  opportunityId: string,
): Promise<string[]> {
  const marker = `owocni-handoff:${opportunityId.trim()}`;
  if (!opportunityId.trim()) {
    return [];
  }

  try {
    const result = await coreClient.query({
      messages: {
        __args: {
          filter: { subject: { ilike: '%Wewnętrzne%' } },
          first: 40,
          orderBy: [{ receivedAt: 'DescNullsLast' }],
        },
        edges: {
          node: {
            text: true,
            messageThreadId: true,
          },
        },
      },
    } as never);

    const nodes =
      (
        result as {
          messages?: {
            edges?: Array<{
              node?: { text?: string | null; messageThreadId?: string | null };
            }>;
          };
        }
      ).messages?.edges?.map((edge) => edge.node) ?? [];

    return [
      ...new Set(
        nodes
          .filter((node) => node?.text?.includes(marker))
          .map((node) => node?.messageThreadId?.trim())
          .filter((threadId): threadId is string => Boolean(threadId)),
      ),
    ];
  } catch {
    return [];
  }
}

export async function ensureInternalHandoffAttached(input: {
  coreClient: CoreApiClient;
  opportunityId: string;
  pending?: { subject: string; to: string; from: string } | null;
}): Promise<boolean> {
  if (input.pending?.to && input.pending.from) {
    const fromPending = await attachInternalHandoffThread({
      coreClient: input.coreClient,
      opportunityId: input.opportunityId,
      subject: input.pending.subject,
      to: input.pending.to,
      from: input.pending.from,
    });
    if (fromPending.attached) {
      return true;
    }
  }

  const threadIds = await findThreadIdsByHandoffMarker(
    input.coreClient,
    input.opportunityId,
  );
  let attached = false;
  for (const threadId of threadIds) {
    const targetId = await createOpportunityThreadTarget(
      input.coreClient,
      threadId,
      input.opportunityId,
    );
    if (targetId) {
      attached = true;
    }
  }
  return attached;
}
