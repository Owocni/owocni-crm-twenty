import type { CoreApiClient } from 'twenty-client-sdk/core';

export type RecentRecipient = {
  email: string;
  subject: string;
  messageId?: string;
  role?: string;
};

export type SuggestedReply = {
  email: string;
  subject: string;
  messageId: string | null;
  threadId: string | null;
  role: string | null;
};

const INTERNAL_DOMAINS = ['owocni.pl', 'twenty.com'];

function isInternalEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return INTERNAL_DOMAINS.some(
    (internal) => domain === internal || domain.endsWith(`.${internal}`),
  );
}

type PersonRow = {
  id?: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  emails?: { primaryEmail?: string | null } | null;
};

/**
 * Avoid heavy messages/messageParticipants scans (Query read timeout in this workspace).
 * Path: latest messageThreads → one message → external participant.
 */
export async function findSuggestedReply(coreClient: CoreApiClient): Promise<{
  recipients: RecentRecipient[];
  suggestedReply: SuggestedReply | null;
  debug: Record<string, unknown>;
}> {
  const debug: Record<string, unknown> = {
    path: 'messageThreads→messages→participants',
    threads: 0,
    messages: 0,
    participants: 0,
    error: null as string | null,
  };

  try {
    const threadsResult = await coreClient.query({
      messageThreads: {
        __args: {
          first: 5,
          orderBy: [{ updatedAt: 'DescNullsLast' }],
        },
        edges: {
          node: {
            id: true,
            subject: true,
          },
        },
      },
    });

    const threads =
      (
        threadsResult.messageThreads as {
          edges?: Array<{
            node?: { id?: string; subject?: string | null };
          }>;
        } | null
      )?.edges ?? [];

    debug.threads = threads.length;

    for (const threadEdge of threads) {
      const thread = threadEdge.node;
      if (!thread?.id) {
        continue;
      }

      const messagesResult = await coreClient.query({
        messages: {
          __args: {
            filter: { messageThreadId: { eq: thread.id } },
            first: 1,
            orderBy: [{ receivedAt: 'DescNullsLast' }],
          },
          edges: {
            node: {
              id: true,
              subject: true,
              messageThreadId: true,
              messageParticipants: {
                edges: {
                  node: {
                    handle: true,
                    role: true,
                    workspaceMemberId: true,
                    person: {
                      id: true,
                      name: { firstName: true, lastName: true },
                      emails: { primaryEmail: true },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const message = (
        messagesResult.messages as {
          edges?: Array<{
            node?: {
              id?: string;
              subject?: string | null;
              messageThreadId?: string | null;
              messageParticipants?: {
                edges?: Array<{
                  node?: {
                    handle?: string | null;
                    role?: string | null;
                    workspaceMemberId?: string | null;
                    person?: PersonRow | null;
                  };
                }>;
              };
            };
          }>;
        } | null
      )?.edges?.[0]?.node;

      if (!message) {
        continue;
      }

      debug.messages = Number(debug.messages) + 1;

      const participants =
        message.messageParticipants?.edges?.map((edge) => edge.node) ?? [];
      debug.participants = Number(debug.participants) + participants.length;

      const withPersonEmail = participants.find(
        (node) => node?.person?.emails?.primaryEmail?.includes('@'),
      );
      const fromExternal = participants.find(
        (node) =>
          node?.role === 'FROM' &&
          !node.workspaceMemberId &&
          node.handle?.includes('@') &&
          !isInternalEmail(node.handle),
      );
      const anyExternal = participants.find(
        (node) =>
          !node?.workspaceMemberId &&
          node?.handle?.includes('@') &&
          !isInternalEmail(node.handle),
      );

      const email =
        withPersonEmail?.person?.emails?.primaryEmail?.trim().toLowerCase() ||
        fromExternal?.handle?.trim().toLowerCase() ||
        anyExternal?.handle?.trim().toLowerCase() ||
        '';

      if (!email) {
        continue;
      }

      const subject = (message.subject || thread.subject || '').trim();
      const role = String(
        withPersonEmail?.role || fromExternal?.role || anyExternal?.role || '',
      );

      const suggestedReply: SuggestedReply = {
        email,
        subject,
        messageId: message.id ?? null,
        threadId: message.messageThreadId ?? thread.id,
        role: role || null,
      };

      return {
        recipients: [
          {
            email,
            subject,
            messageId: message.id,
            role,
          },
        ],
        suggestedReply,
        debug,
      };
    }

    return { recipients: [], suggestedReply: null, debug };
  } catch (error) {
    debug.error = error instanceof Error ? error.message : String(error);
    return { recipients: [], suggestedReply: null, debug };
  }
}
