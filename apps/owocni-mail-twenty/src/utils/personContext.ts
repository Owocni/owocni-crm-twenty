import type { CoreApiClient } from 'twenty-client-sdk/core';

import { emailBodyToDisplayText } from 'src/utils/emailBodyText';
import {
  classifyBounceReason,
  isBounceMessage,
} from 'src/utils/mailBounce';

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

export type MailThreadChannel = 'client' | 'internal' | 'bounce';

export type ThreadMessage = ReplyMessagePreview & {
  direction: 'in' | 'out';
  channel: MailThreadChannel;
  bounceReason?: 'invalid' | 'undelivered';
};

/** Reading pane: a DSN is the thing to look at, even if our outbound is 1s newer. */
export function preferredThreadMessage(
  messages: ThreadMessage[],
): ThreadMessage | null {
  if (!messages.length) {
    return null;
  }
  return (
    messages.find((message) => message.channel === 'bounce') ?? messages[0]
  );
}

export function mergeThreadMessages(
  primary: ThreadMessage[],
  extra: ThreadMessage[],
): ThreadMessage[] {
  const seen = new Set(
    primary.map((message) => message.messageId).filter(Boolean),
  );
  const merged = [
    ...primary,
    ...extra.filter(
      (message) => message.messageId && !seen.has(message.messageId),
    ),
  ];
  merged.sort((left, right) => {
    const leftAt = left.receivedAt ? Date.parse(left.receivedAt) : 0;
    const rightAt = right.receivedAt ? Date.parse(right.receivedAt) : 0;
    return rightAt - leftAt;
  });
  return merged;
}

export type MailResolveContext = {
  person: PersonContext | null;
  /** Original thread/message subject when opened from email Reply context. */
  replySubject: string | null;
  /** Plaintext body of the message being replied to (when available). */
  replyMessage: ReplyMessagePreview | null;
  /** Twenty MessageThread id when opened from Poczta / a message. */
  threadId: string | null;
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

const MESSAGE_PARTICIPANT_EDGES = {
  edges: {
    node: PARTICIPANT_FIELDS,
  },
} as const;

const MESSAGE_LIST_FIELDS = {
  id: true,
  subject: true,
  receivedAt: true,
  messageThreadId: true,
  messageParticipants: MESSAGE_PARTICIPANT_EDGES,
} as const;

const MESSAGE_PREVIEW_FIELDS = {
  ...MESSAGE_LIST_FIELDS,
  text: true,
} as const;

/** Same preview plus CRM-only Message.direction (ADR #19). */
const MESSAGE_THREAD_FIELDS = {
  ...MESSAGE_PREVIEW_FIELDS,
  direction: true,
};

const MESSAGE_LIST_WITH_DIRECTION_FIELDS = {
  ...MESSAGE_LIST_FIELDS,
  direction: true,
} as const;

export type ThreadMessageListOptions = {
  includeText?: boolean;
};

function messageQueryFields(options?: ThreadMessageListOptions) {
  const includeText = options?.includeText !== false;
  return includeText ? MESSAGE_THREAD_FIELDS : MESSAGE_LIST_WITH_DIRECTION_FIELDS;
}

type MessagePreviewNode = {
  id?: string;
  subject?: string | null;
  text?: string | null;
  receivedAt?: string | null;
  direction?: unknown;
  messageThreadId?: string | null;
  messageParticipants?: {
    edges?: Array<{ node: ParticipantNode }>;
  };
};

function emptyResolve(): MailResolveContext {
  return {
    person: null,
    replySubject: null,
    replyMessage: null,
    threadId: null,
    contextKind: null,
  };
}

function personDisplayName(
  person: PersonRow | null | undefined,
): string {
  const firstName = person?.name?.firstName ?? '';
  const lastName = person?.name?.lastName ?? '';
  return [firstName, lastName].filter(Boolean).join(' ').trim();
}

/**
 * FROM line in history: the mailbox that actually sent.
 * Shared inboxes (studio@) are often linked to a Person (Marta) in CRM —
 * never substitute that name for an internal address.
 */
export function mailboxFromDisplay(input: {
  handle?: string | null;
  person?: PersonRow | null;
}): { fromEmail: string | null; fromLabel: string | null } {
  const fromEmail = extractEmailFromHandle(input.handle) || null;
  if (!fromEmail) {
    const name = personDisplayName(input.person);
    return { fromEmail: name || null, fromLabel: name || null };
  }

  if (isInternalMailbox(fromEmail)) {
    return { fromEmail, fromLabel: fromEmail };
  }

  const name = personDisplayName(input.person);
  return {
    fromEmail,
    fromLabel: name || fromEmail,
  };
}

function previewFromMessage(
  message: MessagePreviewNode | null | undefined,
): ReplyMessagePreview | null {
  if (!message?.id) {
    return null;
  }

  const text = emailBodyToDisplayText(message.text);
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
  const fromInternal = nodes.find(
    (node) =>
      participantRole(node.role) === 'FROM' &&
      typeof node.handle === 'string' &&
      extractEmailFromHandle(node.handle).includes('@'),
  );
  const from = fromExternal ?? anyExternal ?? fromInternal;
  const { fromEmail, fromLabel } = mailboxFromDisplay(from ?? {});

  return {
    messageId: message.id,
    fromEmail,
    fromLabel,
    subject,
    receivedAt: message.receivedAt ?? null,
    text,
  };
}

function bounceFromPreview(preview: ReplyMessagePreview): boolean {
  return isBounceMessage({
    subject: preview.subject,
    text: preview.text,
    fromHandle: preview.fromEmail,
    fromDisplayName: preview.fromLabel,
  });
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
  const hasParticipants = nodes.some(
    (node) => typeof node.handle === 'string' && node.handle.includes('@'),
  );
  const internal =
    hasParticipants &&
    nodes.every(
      (node) => !node.handle || participantIsInternal(node),
    );

  if (bounceFromPreview(preview)) {
    const bounceReason = classifyBounceReason(preview.text);
    return {
      ...preview,
      channel: 'bounce',
      bounceReason,
      direction: 'in',
    };
  }

  return {
    ...preview,
    channel: internal ? 'internal' : 'client',
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

export function isInternalMailbox(handle: string): boolean {
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

function participantIsInternal(node: ParticipantNode): boolean {
  if (node.workspaceMemberId) {
    return true;
  }
  if (node.handle && isInternalMailbox(node.handle)) {
    return true;
  }
  const personEmail = node.person?.emails?.primaryEmail;
  return Boolean(personEmail && isInternalMailbox(personEmail));
}

export function personFromParticipants(
  nodes: ParticipantNode[],
  recordId?: string | null,
): PersonContext | null {
  const fromExternalPerson = nodes.find(
    (node) =>
      participantRole(node.role) === 'FROM' &&
      node.person &&
      !participantIsInternal(node),
  );
  const anyExternalPerson = nodes.find(
    (node) => node.person && !participantIsInternal(node),
  );
  const withPerson = fromExternalPerson ?? anyExternalPerson;
  if (withPerson?.person) {
    const person = toPersonContext(withPerson.person);
    if (person?.email && !isInternalMailbox(person.email)) {
      return person;
    }
  }

  const fromExternal = nodes.find(
    (node) =>
      participantRole(node.role) === 'FROM' &&
      typeof node.handle === 'string' &&
      extractEmailFromHandle(node.handle).includes('@') &&
      !participantIsInternal(node),
  );

  const anyExternal = nodes.find(
    (node) =>
      typeof node.handle === 'string' &&
      node.handle.includes('@') &&
      !participantIsInternal(node),
  );

  const handle =
    (typeof fromExternal?.handle === 'string' && fromExternal.handle) ||
    (typeof anyExternal?.handle === 'string' && anyExternal.handle) ||
    null;

  if (handle) {
    return emailOnlyContext(extractEmailFromHandle(handle), recordId);
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
  threadId: string | null;
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
      return {
        person: null,
        replySubject: null,
        replyMessage: null,
        threadId: null,
      };
    }

    const replyMessage = previewFromMessage(message);
    const threadId = message.messageThreadId?.trim() || null;
    const nodes =
      message.messageParticipants?.edges?.map((edge) => edge.node) ?? [];
    const person = personFromParticipants(nodes, messageId);

    if (person?.email && !person.firstName && !person.lastName) {
      const byEmail = await findPersonByEmail(coreClient, person.email);
      return {
        person: byEmail ?? person,
        replySubject: message.subject?.trim() || null,
        replyMessage,
        threadId,
      };
    }

    return {
      person,
      replySubject: message.subject?.trim() || null,
      replyMessage,
      threadId,
    };
  } catch {
    return {
      person: null,
      replySubject: null,
      replyMessage: null,
      threadId: null,
    };
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
  threadId: string | null;
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
      return {
        person: null,
        replySubject: null,
        replyMessage: null,
        threadId: null,
      };
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
            threadId: thread.id,
          };
        }

        return {
          person,
          replySubject: replySubject || message.subject?.trim() || null,
          replyMessage,
          threadId: thread.id,
        };
      }
    }

    return { person: null, replySubject, replyMessage, threadId: thread.id };
  } catch {
    return {
      person: null,
      replySubject: null,
      replyMessage: null,
      threadId: null,
    };
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
        threadId: null,
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
        threadId: null,
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
          threadId: null,
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
            threadId: asMessage.threadId,
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
              threadId: asThread.threadId ?? recordId,
              contextKind: 'messageThread',
            };
          } else if (asPerson) {
            context = {
              person: asPerson,
              replySubject: null,
              replyMessage: null,
              threadId: null,
              contextKind: 'person',
            };
          } else if (asOpportunity) {
            context = {
              person: asOpportunity,
              replySubject: null,
              replyMessage: null,
              threadId: null,
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
      threadId: null,
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
  options: { includeDirection: boolean; includeText: boolean },
) {
  const messageFields = options.includeDirection
    ? messageQueryFields({ includeText: options.includeText })
    : options.includeText
      ? MESSAGE_PREVIEW_FIELDS
      : MESSAGE_LIST_FIELDS;

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
          message: messageFields,
        },
      },
    },
  } as never);
}

export async function listThreadMessagesByEmail(
  coreClient: CoreApiClient,
  email: string,
  limit = 40,
  options?: ThreadMessageListOptions,
): Promise<ThreadMessage[]> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const includeText = options?.includeText !== false;

  let result: { messageParticipants?: unknown };
  try {
    result = await queryThreadParticipantMessages(
      coreClient,
      normalized,
      limit,
      { includeDirection: true, includeText },
    );
  } catch {
    try {
      result = await queryThreadParticipantMessages(
        coreClient,
        normalized,
        limit,
        { includeDirection: false, includeText },
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

export async function listThreadMessagesByThreadId(
  coreClient: CoreApiClient,
  threadId: string,
  limit = 40,
  options?: ThreadMessageListOptions,
): Promise<ThreadMessage[]> {
  const id = threadId.trim();
  if (!id) {
    return [];
  }

  try {
    const messagesResult = await coreClient.query({
      messages: {
        __args: {
          filter: { messageThreadId: { eq: id } },
          first: limit,
          orderBy: [{ receivedAt: 'DescNullsLast' }],
        },
        edges: {
          node: messageQueryFields(options),
        },
      },
    });

    const messages: ThreadMessage[] = [];
    const seen = new Set<string>();
    const nodes =
      (
        messagesResult.messages as {
          edges?: Array<{ node: MessagePreviewNode }>;
        } | null
      )?.edges?.map((edge) => edge.node) ?? [];

    for (const message of nodes) {
      if (!message?.id || seen.has(message.id)) {
        continue;
      }
      const threadMessage = threadMessageFromNode(message);
      if (!threadMessage?.messageId) {
        continue;
      }
      seen.add(message.id);
      messages.push(threadMessage);
    }

    return messages;
  } catch {
    return [];
  }
}

export async function listInternalThreadMessagesForOpportunity(
  coreClient: CoreApiClient,
  opportunityId: string,
  limit = 20,
  options?: ThreadMessageListOptions,
): Promise<ThreadMessage[]> {
  const id = opportunityId.trim();
  if (!id) {
    return [];
  }

  try {
    const targetsResult = await coreClient.query({
      messageThreadTargets: {
        __args: {
          filter: { targetOpportunityId: { eq: id } },
          first: limit,
        },
        edges: {
          node: {
            messageThreadId: true,
          },
        },
      },
    } as never);

    const threadIds = [
      ...new Set(
        (
          (
            targetsResult as {
              messageThreadTargets?: {
                edges?: Array<{
                  node?: { messageThreadId?: string | null };
                }>;
              };
            }
          ).messageThreadTargets?.edges ?? []
        )
          .map((edge) => edge.node?.messageThreadId?.trim())
          .filter((threadId): threadId is string => Boolean(threadId)),
      ),
    ];

    const perThread = await Promise.all(
      threadIds.map((threadId) =>
        listThreadMessagesByThreadId(coreClient, threadId, 40, options),
      ),
    );

    const messages: ThreadMessage[] = [];
    const seen = new Set<string>();
    for (const threadMessages of perThread) {
      for (const message of threadMessages) {
        if (!message.messageId || seen.has(message.messageId)) {
          continue;
        }
        seen.add(message.messageId);
        messages.push({
          ...message,
          channel: message.channel === 'bounce' ? 'bounce' : 'internal',
        });
      }
    }

    messages.sort((left, right) => {
      const leftAt = left.receivedAt ? Date.parse(left.receivedAt) : 0;
      const rightAt = right.receivedAt ? Date.parse(right.receivedAt) : 0;
      return rightAt - leftAt;
    });
    return messages;
  } catch {
    return [];
  }
}

export type MailThreadListResult = {
  person: PersonContext | null;
  replySubject: string | null;
  replyMessage: ReplyMessagePreview | null;
  threadMessages: ThreadMessage[];
  contextKind: MailResolveContext['contextKind'];
  contextRecordId: string | null;
};

/**
 * First-paint path: Opportunity (or thread) list without message bodies.
 * Skips identity waterfall, templates, signatures, and handoff attach.
 */
export async function listMailThreadList(
  coreClient: CoreApiClient,
  options: { recordId?: string | null; email?: string | null },
): Promise<MailThreadListResult> {
  const recordId = options.recordId?.trim() || null;
  const email = options.email?.trim().toLowerCase() || null;
  const listOptions: ThreadMessageListOptions = { includeText: false };

  const empty: MailThreadListResult = {
    person: null,
    replySubject: null,
    replyMessage: null,
    threadMessages: [],
    contextKind: null,
    contextRecordId: recordId,
  };

  if (recordId) {
    const person = await findPersonFromOpportunity(coreClient, recordId);
    const threadEmail = person?.email?.trim().toLowerCase() || email;
    const [byEmail, internal] = await Promise.all([
      threadEmail && !isInternalMailbox(threadEmail)
        ? listThreadMessagesByEmail(coreClient, threadEmail, 40, listOptions)
        : Promise.resolve([]),
      listInternalThreadMessagesForOpportunity(
        coreClient,
        recordId,
        20,
        listOptions,
      ),
    ]);

    let threadMessages = mergeThreadMessages(byEmail, internal);

    if (threadMessages.length === 0 && !person) {
      threadMessages = await listThreadMessagesByThreadId(
        coreClient,
        recordId,
        40,
        listOptions,
      );
      if (threadMessages.length > 0) {
        const featured = preferredThreadMessage(threadMessages);
        return {
          person,
          replySubject: featured?.subject ?? null,
          replyMessage: featured,
          threadMessages,
          contextKind: 'messageThread',
          contextRecordId: recordId,
        };
      }
    }

    if (person || threadMessages.length > 0) {
      const featured = preferredThreadMessage(threadMessages);
      return {
        person,
        replySubject: featured?.subject ?? null,
        replyMessage: featured,
        threadMessages,
        contextKind: 'opportunity',
        contextRecordId: recordId,
      };
    }
  }

  if (email && !isInternalMailbox(email)) {
    const threadMessages = await listThreadMessagesByEmail(
      coreClient,
      email,
      40,
      listOptions,
    );
    const featured = preferredThreadMessage(threadMessages);
    return {
      person: null,
      replySubject: featured?.subject ?? null,
      replyMessage: featured,
      threadMessages,
      contextKind: 'email',
      contextRecordId: recordId,
    };
  }

  return empty;
}

async function enrichReplyMessage(
  coreClient: CoreApiClient,
  context: MailResolveContext,
): Promise<MailResolveContext> {
  if (context.replyMessage?.text) {
    return context;
  }

  if (context.contextKind === 'message' || context.contextKind === 'messageThread') {
    return context;
  }

  const email = context.person?.email?.trim().toLowerCase();
  if (!email || isInternalMailbox(email)) {
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
