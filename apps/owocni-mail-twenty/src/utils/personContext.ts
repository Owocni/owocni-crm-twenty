import type { CoreApiClient } from 'twenty-client-sdk/core';

export type PersonContext = {
  id: string | null;
  firstName: string;
  lastName: string;
  clientName: string;
  email: string;
  companyName: string;
};

export type MailResolveContext = {
  person: PersonContext | null;
  /** Original thread/message subject when opened from email Reply context. */
  replySubject: string | null;
  contextKind:
    | 'person'
    | 'opportunity'
    | 'message'
    | 'messageThread'
    | 'email'
    | null;
};

type PersonRow = {
  id?: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  emails?: { primaryEmail?: string | null } | null;
  company?: { name?: string | null } | null;
};

type ParticipantNode = {
  role?: string | null;
  handle?: string | null;
  personId?: string | null;
  workspaceMemberId?: string | null;
  person?: PersonRow | null;
};

const PERSON_FIELDS = {
  id: true,
  name: { firstName: true, lastName: true },
  emails: { primaryEmail: true },
  company: { name: true },
} as const;

const PARTICIPANT_FIELDS = {
  role: true,
  handle: true,
  personId: true,
  workspaceMemberId: true,
  person: PERSON_FIELDS,
} as const;

function emptyResolve(): MailResolveContext {
  return { person: null, replySubject: null, contextKind: null };
}

function toPersonContext(row: PersonRow | null | undefined): PersonContext | null {
  if (!row) {
    return null;
  }

  const firstName = row.name?.firstName ?? '';
  const lastName = row.name?.lastName ?? '';
  const email = row.emails?.primaryEmail?.trim() ?? '';

  if (!email && !firstName && !lastName && !row.id) {
    return null;
  }

  return {
    id: row.id ? String(row.id) : null,
    firstName,
    lastName,
    clientName: [firstName, lastName].filter(Boolean).join(' '),
    email,
    companyName: row.company?.name ?? '',
  };
}

function emailOnlyContext(email: string, recordId?: string | null): PersonContext {
  return {
    id: recordId ?? null,
    firstName: '',
    lastName: '',
    clientName: '',
    email,
    companyName: '',
  };
}

function personFromParticipants(
  nodes: ParticipantNode[],
  recordId?: string | null,
): PersonContext | null {
  const withPerson = nodes.find((node) => node.person);
  if (withPerson?.person) {
    const person = toPersonContext(withPerson.person);
    if (person?.email) {
      return person;
    }
  }

  const fromExternal = nodes.find(
    (node) =>
      String(node.role ?? '') === 'FROM' &&
      typeof node.handle === 'string' &&
      node.handle.includes('@') &&
      !node.workspaceMemberId,
  );

  const anyExternal = nodes.find(
    (node) =>
      typeof node.handle === 'string' &&
      node.handle.includes('@') &&
      !node.workspaceMemberId,
  );

  const handle =
    (typeof fromExternal?.handle === 'string' && fromExternal.handle) ||
    (typeof anyExternal?.handle === 'string' && anyExternal.handle) ||
    null;

  if (handle) {
    return emailOnlyContext(handle.toLowerCase(), recordId);
  }

  if (withPerson?.person) {
    return toPersonContext(withPerson.person);
  }

  return null;
}

async function findPersonById(
  coreClient: CoreApiClient,
  recordId: string,
): Promise<PersonContext | null> {
  try {
    const byId = await coreClient.query({
      person: {
        __args: {
          filter: { id: { eq: recordId } },
        },
        ...PERSON_FIELDS,
      },
    });

    return toPersonContext(byId.person as PersonRow);
  } catch {
    return null;
  }
}

async function findPersonByEmail(
  coreClient: CoreApiClient,
  email: string,
): Promise<PersonContext | null> {
  try {
    const byEmail = await coreClient.query({
      people: {
        __args: {
          filter: {
            emails: {
              primaryEmail: { eq: email },
            },
          },
          first: 1,
        },
        edges: {
          node: PERSON_FIELDS,
        },
      },
    });

    return toPersonContext(
      byEmail.people?.edges?.[0]?.node as PersonRow | undefined,
    );
  } catch {
    return null;
  }
}

async function findPersonFromOpportunity(
  coreClient: CoreApiClient,
  opportunityId: string,
): Promise<PersonContext | null> {
  try {
    // Custom fields (bizCardEmail) may be missing from a stale local schema —
    // cast keeps the selection for the remote workspace client.
    const result = await coreClient.query({
      opportunity: {
        __args: {
          filter: { id: { eq: opportunityId } },
        },
        pointOfContactId: true,
        pointOfContact: PERSON_FIELDS,
        company: { name: true },
        ...( { bizCardEmail: true } as Record<string, unknown> ),
      },
    } as never);

    const opportunity = (result as { opportunity?: {
      bizCardEmail?: string | null;
      pointOfContact?: PersonRow | null;
      company?: { name?: string | null } | null;
    } | null }).opportunity;

    if (!opportunity) {
      return null;
    }

    const companyName = opportunity.company?.name
      ? String(opportunity.company.name)
      : '';
    const cardEmail = opportunity.bizCardEmail?.trim().toLowerCase() || '';

    const contact = toPersonContext(opportunity.pointOfContact);

    if (contact?.email) {
      if (!contact.companyName && companyName) {
        contact.companyName = companyName;
      }

      return contact;
    }

    if (cardEmail) {
      const byEmail = await findPersonByEmail(coreClient, cardEmail);

      if (byEmail) {
        if (!byEmail.companyName && companyName) {
          byEmail.companyName = companyName;
        }

        return byEmail;
      }

      if (contact) {
        return {
          ...contact,
          email: cardEmail,
          companyName: contact.companyName || companyName,
        };
      }

      return {
        ...emailOnlyContext(cardEmail, opportunityId),
        companyName,
      };
    }

    if (contact) {
      if (!contact.companyName && companyName) {
        contact.companyName = companyName;
      }

      return contact;
    }
  } catch {
    // not an opportunity / field not in schema
  }

  return null;
}

async function findPersonFromMessage(
  coreClient: CoreApiClient,
  messageId: string,
): Promise<{ person: PersonContext | null; replySubject: string | null }> {
  try {
    const result = await coreClient.query({
      message: {
        __args: {
          filter: { id: { eq: messageId } },
        },
        subject: true,
        messageParticipants: {
          edges: {
            node: PARTICIPANT_FIELDS,
          },
        },
      },
    });

    const message = result.message as
      | {
          subject?: string | null;
          messageParticipants?: {
            edges?: Array<{ node: ParticipantNode }>;
          };
        }
      | null
      | undefined;

    if (!message) {
      return { person: null, replySubject: null };
    }

    const nodes =
      message.messageParticipants?.edges?.map((edge) => edge.node) ?? [];
    const person = personFromParticipants(nodes, messageId);

    if (person?.email && !person.firstName && !person.lastName) {
      const byEmail = await findPersonByEmail(coreClient, person.email);
      return {
        person: byEmail ?? person,
        replySubject: message.subject?.trim() || null,
      };
    }

    return {
      person,
      replySubject: message.subject?.trim() || null,
    };
  } catch {
    return { person: null, replySubject: null };
  }
}

/**
 * Emails UI usually selects a MessageThread (not Message). Resolve recipient
 * + reply subject from the thread's messages / participants.
 */
async function findPersonFromMessageThread(
  coreClient: CoreApiClient,
  threadId: string,
): Promise<{ person: PersonContext | null; replySubject: string | null }> {
  try {
    const threadResult = await coreClient.query({
      messageThread: {
        __args: {
          filter: { id: { eq: threadId } },
        },
        id: true,
        subject: true,
      },
    });

    const thread = threadResult.messageThread as
      | { id?: string; subject?: string | null }
      | null
      | undefined;

    if (!thread?.id) {
      return { person: null, replySubject: null };
    }

    const replySubject = thread.subject?.trim() || null;

    const messagesResult = await coreClient.query({
      messages: {
        __args: {
          filter: { messageThreadId: { eq: threadId } },
          first: 8,
          orderBy: [{ receivedAt: 'DescNullsLast' }],
        },
        edges: {
          node: {
            id: true,
            subject: true,
            messageParticipants: {
              edges: {
                node: PARTICIPANT_FIELDS,
              },
            },
          },
        },
      },
    });

    const messageNodes =
      (
        messagesResult.messages as {
          edges?: Array<{
            node: {
              id?: string;
              subject?: string | null;
              messageParticipants?: {
                edges?: Array<{ node: ParticipantNode }>;
              };
            };
          }>;
        } | null
      )?.edges?.map((edge) => edge.node) ?? [];

    for (const message of messageNodes) {
      const nodes =
        message.messageParticipants?.edges?.map((edge) => edge.node) ?? [];
      const person = personFromParticipants(nodes, threadId);

      if (person?.email) {
        if (!person.firstName && !person.lastName) {
          const byEmail = await findPersonByEmail(coreClient, person.email);
          return {
            person: byEmail ?? person,
            replySubject: replySubject || message.subject?.trim() || null,
          };
        }

        return {
          person,
          replySubject: replySubject || message.subject?.trim() || null,
        };
      }
    }

    return { person: null, replySubject };
  } catch {
    return { person: null, replySubject: null };
  }
}

/**
 * Resolve recipient from Person / Opportunity / Message / MessageThread, or raw email.
 */
export async function resolveMailContext(
  coreClient: CoreApiClient,
  options: { recordId?: string | null; email?: string | null },
): Promise<MailResolveContext> {
  const recordId = options.recordId?.trim() || null;
  const email = options.email?.trim().toLowerCase() || null;

  if (email) {
    const byEmail = await findPersonByEmail(coreClient, email);
    const replySubject = await findReplySubjectByEmail(coreClient, email);

    if (byEmail) {
      return {
        person: byEmail,
        replySubject,
        contextKind: 'email',
      };
    }
  }

  if (recordId) {
    const asPerson = await findPersonById(coreClient, recordId);
    if (asPerson?.email) {
      const replySubject =
        (await findReplySubjectByEmail(coreClient, asPerson.email)) ?? null;
      return {
        person: asPerson,
        replySubject,
        contextKind: 'person',
      };
    }

    const asOpportunity = await findPersonFromOpportunity(coreClient, recordId);
    if (asOpportunity?.email) {
      const replySubject =
        (await findReplySubjectByEmail(coreClient, asOpportunity.email)) ?? null;
      return {
        person: asOpportunity,
        replySubject,
        contextKind: 'opportunity',
      };
    }

    const asMessage = await findPersonFromMessage(coreClient, recordId);
    if (asMessage.person?.email || asMessage.replySubject) {
      return {
        person: asMessage.person,
        replySubject: asMessage.replySubject,
        contextKind: 'message',
      };
    }

    const asThread = await findPersonFromMessageThread(coreClient, recordId);
    if (asThread.person?.email || asThread.replySubject) {
      return {
        person: asThread.person,
        replySubject: asThread.replySubject,
        contextKind: 'messageThread',
      };
    }

    if (asPerson) {
      return { person: asPerson, replySubject: null, contextKind: 'person' };
    }

    if (asOpportunity) {
      return {
        person: asOpportunity,
        replySubject: null,
        contextKind: 'opportunity',
      };
    }
  }

  if (email) {
    const replySubject = await findReplySubjectByEmail(coreClient, email);
    return {
      person: emailOnlyContext(email, recordId),
      replySubject,
      contextKind: 'email',
    };
  }

  return emptyResolve();
}

async function findReplySubjectByEmail(
  coreClient: CoreApiClient,
  email: string,
): Promise<string | null> {
  try {
    const result = await coreClient.query({
      messageParticipants: {
        __args: {
          filter: { handle: { eq: email } },
          first: 5,
          orderBy: [{ createdAt: 'DescNullsLast' }],
        },
        edges: {
          node: {
            message: {
              subject: true,
            },
          },
        },
      },
    });

    const subjects =
      (
        result.messageParticipants as {
          edges?: Array<{ node?: { message?: { subject?: string | null } } }>;
        } | null
      )?.edges
        ?.map((edge) => edge.node?.message?.subject?.trim())
        .filter((subject): subject is string => Boolean(subject)) ?? [];

    return subjects[0] ?? null;
  } catch {
    return null;
  }
}

/** @deprecated Prefer resolveMailContext — kept for call sites that only need Person. */
export async function resolvePersonContext(
  coreClient: CoreApiClient,
  options: { recordId?: string | null; email?: string | null },
): Promise<PersonContext | null> {
  const resolved = await resolveMailContext(coreClient, options);
  return resolved.person;
}

export function personVars(person: PersonContext | null): Record<string, string> {
  return {
    firstName: person?.firstName ?? '',
    lastName: person?.lastName ?? '',
    client_name: person?.clientName ?? '',
    companyName: person?.companyName ?? '',
    email: person?.email ?? '',
  };
}
