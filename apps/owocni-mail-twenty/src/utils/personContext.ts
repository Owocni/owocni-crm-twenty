import type { CoreApiClient } from 'twenty-client-sdk/core';

export type PersonContext = {
  id: string | null;
  firstName: string;
  lastName: string;
  clientName: string;
  email: string;
  companyName: string;
};

export type ReplyMessagePreview = {
  messageId: string | null;
  fromEmail: string | null;
  fromLabel: string | null;
  subject: string | null;
  receivedAt: string | null;
  text: string;
};

export type ThreadMessage = ReplyMessagePreview & {
  direction: 'in' | 'out';
};

export type MailResolveContext = {
  person: PersonContext | null;
  /** Original thread/message subject when opened from email Reply context. */
  replySubject: string | null;
  /** Plaintext body of the message being replied to (when available). */
  replyMessage: ReplyMessagePreview | null;
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

const MESSAGE_PREVIEW_FIELDS = {
  id: true,
  subject: true,
  text: true,
  receivedAt: true,
  messageParticipants: {
    edges: {
      node: PARTICIPANT_FIELDS,
    },
  },
} as const;

/** Same preview plus CRM-only Message.direction (ADR #19). */
const MESSAGE_THREAD_FIELDS = {
  ...MESSAGE_PREVIEW_FIELDS,
  direction: true,
};

type MessagePreviewNode = {
  id?: string;
  subject?: string | null;
  text?: string | null;
  receivedAt?: string | null;
  direction?: unknown;
  messageParticipants?: {
    edges?: Array<{ node: ParticipantNode }>;
  };
};

function emptyResolve(): MailResolveContext {
  return {
    person: null,
    replySubject: null,
    replyMessage: null,
    contextKind: null,
  };
}

function participantLabel(node: ParticipantNode | null | undefined): string {
  if (!node) {
    return '';
  }

  const firstName = node.person?.name?.firstName ?? '';
  const lastName = node.person?.name?.lastName ?? '';
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (name) {
    return name;
  }

  return node.handle?.trim() ?? '';
}

function previewFromMessage(
  message: MessagePreviewNode | null | undefined,
): ReplyMessagePreview | null {
  if (!message?.id) {
    return null;
  }

  const text = message.text?.trim() ?? '';
  const subject = message.subject?.trim() || null;
  if (!text && !subject) {
    return null;
  }

  const nodes = message.messageParticipants?.edges?.map((edge) => edge.node) ?? [];
  const fromExternal = nodes.find(
    (node) =>
      participantRole(node.role) === 'FROM' &&
      typeof node.handle === 'string' &&
      extractEmailFromHandle(node.handle).includes('@') &&
      !node.workspaceMemberId &&
      !isInternalMailbox(node.handle),
  );
  const anyExternal = nodes.find(
    (node) =>
      typeof node.handle === 'string' &&
      node.handle.includes('@') &&
      !node.workspaceMemberId &&
      !isInternalMailbox(node.handle),
  );
  const from = fromExternal ?? anyExternal;
  const fromEmail = from?.handle?.trim().toLowerCase() ?? null;
  const fromLabel = participantLabel(from) || fromEmail;

    return {
      messageId: message.id,
      fromEmail,
      fromLabel,
      subject,
      receivedAt: message.receivedAt ?? null,
      text,
    };
  }

function threadMessageFromNode(
  message: MessagePreviewNode,
  parentParticipant?: ParticipantNode | null,
): ThreadMessage | null {
  const preview = previewFromMessage(message);
  if (!preview) {
    return null;
  }

  const nodes =
    message.messageParticipants?.edges?.map((edge) => edge.node) ?? [];

  return {
    ...preview,
    direction: directionFromMessage({
      direction: message.direction,
      participants: nodes,
      parentParticipant,
    }),
  };
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

/** GraphQL SELECT / enum may be a string or `{ value: 'FROM' }`. */
export function selectFieldValue(raw: unknown): string {
  if (typeof raw === 'string' || typeof raw === 'number') {
    return String(raw);
  }

  if (raw && typeof raw === 'object' && 'value' in raw) {
    return String((raw as { value?: unknown }).value ?? '');
  }

  return '';
}

function participantRole(role: unknown): string {
  return selectFieldValue(role).toUpperCase();
}

/** `"Marta Kowalska" <marta@owocni.pl>` → `marta@owocni.pl`. */
export function extractEmailFromHandle(
  handle: string | null | undefined,
): string {
  const raw = String(handle ?? '').trim().toLowerCase();
  if (!raw) {
    return '';
  }

  const angle = raw.match(/<([^<>]*@[^<>]+)>/);
  if (angle?.[1]) {
    return angle[1].trim().toLowerCase();
  }

  const email = raw.match(/[a-z0-9._%+\-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return (email?.[0] ?? raw).toLowerCase();
}

function isInternalMailbox(handle: string): boolean {
  const email = extractEmailFromHandle(handle);
  return (
    email.endsWith('@owocni.pl') ||
    email.endsWith('@copywriting.pl') ||
    email.endsWith('@studioowocni.pl')
  );
}

/** FROM workspace member or internal mailbox = our outbound mail. */
export function directionFromFromParticipant(input: {
  workspaceMemberId?: string | null;
  handle?: string | null;
}): 'in' | 'out' {
  if (input.workspaceMemberId) {
    return 'out';
  }

  if (input.handle && isInternalMailbox(input.handle)) {
    return 'out';
  }

  return 'in';
}

/**
 * Thread-list direction: company Message.direction first (OUTGOING/INCOMING),
 * then FROM participant, then the client's own role on this message
 * (FROM = inbound, TO/CC/BCC = we wrote to them).
 */
export function directionFromMessage(input: {
  direction?: unknown;
  participants?: ParticipantNode[];
  parentParticipant?: ParticipantNode | null;
}): 'in' | 'out' {
  const stored = selectFieldValue(input.direction).toUpperCase();
  if (stored === 'OUTGOING' || stored === 'OUT') {
    return 'out';
  }
  if (stored === 'INCOMING' || stored === 'IN') {
    return 'in';
  }

  const nodes = input.participants ?? [];
  const fromNodes = nodes.filter((node) => participantRole(node.role) === 'FROM');
  for (const node of fromNodes) {
    if (
      directionFromFromParticipant({
        workspaceMemberId: node.workspaceMemberId,
        handle: node.handle,
      }) === 'out'
    ) {
      return 'out';
    }
  }
  if (fromNodes.length > 0) {
    return 'in';
  }

  const parentRole = participantRole(input.parentParticipant?.role);
  if (parentRole === 'FROM') {
    return 'in';
  }
  if (parentRole === 'TO' || parentRole === 'CC' || parentRole === 'BCC') {
    return 'out';
  }

  return 'in';
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
      participantRole(node.role) === 'FROM' &&
      typeof node.handle === 'string' &&
      extractEmailFromHandle(node.handle).includes('@') &&
      !node.workspaceMemberId &&
      !isInternalMailbox(node.handle),
  );

  const anyExternal = nodes.find(
    (node) =>
      typeof node.handle === 'string' &&
      node.handle.includes('@') &&
      !node.workspaceMemberId &&
      !isInternalMailbox(node.handle),
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
): Promise<{
  person: PersonContext | null;
  replySubject: string | null;
  replyMessage: ReplyMessagePreview | null;
}> {
  try {
    const result = await coreClient.query({
      message: {
        __args: {
          filter: { id: { eq: messageId } },
        },
        ...MESSAGE_PREVIEW_FIELDS,
      },
    });

    const message = result.message as MessagePreviewNode | null | undefined;

    if (!message) {
      return { person: null, replySubject: null, replyMessage: null };
    }

    const replyMessage = previewFromMessage(message);
    const nodes =
      message.messageParticipants?.edges?.map((edge) => edge.node) ?? [];
    const person = personFromParticipants(nodes, messageId);

    if (person?.email && !person.firstName && !person.lastName) {
      const byEmail = await findPersonByEmail(coreClient, person.email);
      return {
        person: byEmail ?? person,
        replySubject: message.subject?.trim() || null,
        replyMessage,
      };
    }

    return {
      person,
      replySubject: message.subject?.trim() || null,
      replyMessage,
    };
  } catch {
    return { person: null, replySubject: null, replyMessage: null };
  }
}

/**
 * Emails UI usually selects a MessageThread (not Message). Resolve recipient
 * + reply subject from the thread's messages / participants.
 */
async function findPersonFromMessageThread(
  coreClient: CoreApiClient,
  threadId: string,
): Promise<{
  person: PersonContext | null;
  replySubject: string | null;
  replyMessage: ReplyMessagePreview | null;
}> {
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
      return { person: null, replySubject: null, replyMessage: null };
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
          node: MESSAGE_PREVIEW_FIELDS,
        },
      },
    });

    const messageNodes =
      (
        messagesResult.messages as {
          edges?: Array<{ node: MessagePreviewNode }>;
        } | null
      )?.edges?.map((edge) => edge.node) ?? [];

    let replyMessage: ReplyMessagePreview | null = null;
    for (const message of messageNodes) {
      const preview = previewFromMessage(message);
      if (preview?.text) {
        replyMessage = preview;
        break;
      }
    }

    if (!replyMessage && messageNodes[0]) {
      replyMessage = previewFromMessage(messageNodes[0]);
    }

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
            replyMessage,
          };
        }

        return {
          person,
          replySubject: replySubject || message.subject?.trim() || null,
          replyMessage,
        };
      }
    }

    return { person: null, replySubject, replyMessage };
  } catch {
    return { person: null, replySubject: null, replyMessage: null };
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

  let context: MailResolveContext = emptyResolve();

  if (email) {
    const byEmail = await findPersonByEmail(coreClient, email);
    const replySubject = await findReplySubjectByEmail(coreClient, email);

    if (byEmail) {
      context = {
        person: byEmail,
        replySubject,
        replyMessage: null,
        contextKind: 'email',
      };
    }
  }

  if (!context.person && recordId) {
    const asPerson = await findPersonById(coreClient, recordId);
    if (asPerson?.email) {
      const replySubject =
        (await findReplySubjectByEmail(coreClient, asPerson.email)) ?? null;
      context = {
        person: asPerson,
        replySubject,
        replyMessage: null,
        contextKind: 'person',
      };
    } else {
      const asOpportunity = await findPersonFromOpportunity(coreClient, recordId);
      if (asOpportunity?.email) {
        const replySubject =
          (await findReplySubjectByEmail(coreClient, asOpportunity.email)) ??
          null;
        context = {
          person: asOpportunity,
          replySubject,
          replyMessage: null,
          contextKind: 'opportunity',
        };
      } else {
        const asMessage = await findPersonFromMessage(coreClient, recordId);
        if (
          asMessage.person?.email ||
          asMessage.replySubject ||
          asMessage.replyMessage
        ) {
          context = {
            person: asMessage.person,
            replySubject: asMessage.replySubject,
            replyMessage: asMessage.replyMessage,
            contextKind: 'message',
          };
        } else {
          const asThread = await findPersonFromMessageThread(coreClient, recordId);
          if (
            asThread.person?.email ||
            asThread.replySubject ||
            asThread.replyMessage
          ) {
            context = {
              person: asThread.person,
              replySubject: asThread.replySubject,
              replyMessage: asThread.replyMessage,
              contextKind: 'messageThread',
            };
          } else if (asPerson) {
            context = {
              person: asPerson,
              replySubject: null,
              replyMessage: null,
              contextKind: 'person',
            };
          } else if (asOpportunity) {
            context = {
              person: asOpportunity,
              replySubject: null,
              replyMessage: null,
              contextKind: 'opportunity',
            };
          }
        }
      }
    }
  }

  if (!context.person && email) {
    const replySubject = await findReplySubjectByEmail(coreClient, email);
    context = {
      person: emailOnlyContext(email, recordId),
      replySubject,
      replyMessage: null,
      contextKind: 'email',
    };
  }

  return enrichReplyMessage(coreClient, context);
}

async function findReplyMessageByEmail(
  coreClient: CoreApiClient,
  email: string,
): Promise<ReplyMessagePreview | null> {
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
            message: MESSAGE_PREVIEW_FIELDS,
          },
        },
      },
    });

    const messages =
      (
        result.messageParticipants as {
          edges?: Array<{ node?: { message?: MessagePreviewNode | null } }>;
        } | null
      )?.edges
        ?.map((edge) => edge.node?.message)
        .filter((message): message is MessagePreviewNode => Boolean(message?.id)) ??
      [];

    for (const message of messages) {
      const preview = previewFromMessage(message);
      if (preview?.text) {
        return preview;
      }
    }

    return messages[0] ? previewFromMessage(messages[0]) : null;
  } catch {
    return null;
  }
}

async function queryThreadParticipantMessages(
  coreClient: CoreApiClient,
  email: string,
  limit: number,
  includeDirection: boolean,
) {
  return coreClient.query({
    messageParticipants: {
      __args: {
        filter: { handle: { eq: email } },
        first: limit,
        orderBy: [{ createdAt: 'DescNullsLast' }],
      },
      edges: {
        node: {
          role: true,
          handle: true,
          workspaceMemberId: true,
          message: includeDirection
            ? MESSAGE_THREAD_FIELDS
            : MESSAGE_PREVIEW_FIELDS,
        },
      },
    },
  } as never);
}

export async function listThreadMessagesByEmail(
  coreClient: CoreApiClient,
  email: string,
  limit = 40,
): Promise<ThreadMessage[]> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  let result: { messageParticipants?: unknown };
  try {
    result = await queryThreadParticipantMessages(
      coreClient,
      normalized,
      limit,
      true,
    );
  } catch {
    try {
      result = await queryThreadParticipantMessages(
        coreClient,
        normalized,
        limit,
        false,
      );
    } catch {
      return [];
    }
  }

  const seen = new Set<string>();
  const messages: ThreadMessage[] = [];

  const participantEdges =
    (
      result.messageParticipants as {
        edges?: Array<{
          node?: {
            role?: string | null;
            handle?: string | null;
            workspaceMemberId?: string | null;
            message?: MessagePreviewNode | null;
          };
        }>;
      } | null
    )?.edges ?? [];

  for (const edge of participantEdges) {
    const parent = edge.node;
    const message = parent?.message;
    if (!message?.id || seen.has(message.id)) {
      continue;
    }

    const threadMessage = threadMessageFromNode(message, parent);
    if (!threadMessage?.messageId) {
      continue;
    }

    seen.add(message.id);
    messages.push(threadMessage);
  }

  messages.sort((left, right) => {
    const leftAt = left.receivedAt ? Date.parse(left.receivedAt) : 0;
    const rightAt = right.receivedAt ? Date.parse(right.receivedAt) : 0;
    return rightAt - leftAt;
  });

  return messages;
}

async function enrichReplyMessage(
  coreClient: CoreApiClient,
  context: MailResolveContext,
): Promise<MailResolveContext> {
  if (context.replyMessage?.text) {
    return context;
  }

  const email = context.person?.email?.trim().toLowerCase();
  if (!email) {
    return context;
  }

  const preview = await findReplyMessageByEmail(coreClient, email);
  if (!preview) {
    return context;
  }

  return {
    ...context,
    replyMessage: preview,
    replySubject: context.replySubject ?? preview.subject,
  };
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

/**
 * Greeting token for mail templates. BB {{client_name}} = imię only
 * ("Dzień dobry, Grzegorz"), never first+last and never an email.
 */
export function greetingFirstName(
  firstName: string | null | undefined,
): string {
  const raw = String(firstName ?? '').trim();
  if (!raw || raw.includes('@')) {
    return '';
  }

  return raw.split(/\s+/)[0] ?? '';
}

export function personVars(person: PersonContext | null): Record<string, string> {
  const first = greetingFirstName(person?.firstName);

  return {
    firstName: first,
    lastName: person?.lastName ?? '',
    client_name: first,
    clientName: first,
    companyName: person?.companyName ?? '',
    email: person?.email ?? '',
  };
}
