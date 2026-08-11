import type { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';

export type SendableEmailAccount = {
  id: string;
  handle: string;
};

/** Shared team inboxes everyone may send from (when connected). */
export const GENERAL_MAILBOX_HANDLES = [
  'studio@owocni.pl',
  'leads@owocni.pl',
] as const;

/** Logins that are team/admin seats (no personal @owocni.pl mailbox). */
const SHARED_OPERATOR_EMAILS = ['owocni@gmail.com'] as const;

const OUR_MAILBOX_VALUE_TO_HANDLE: Record<string, string> = {
  MARTA: 'marta@owocni.pl',
  GOSIA: 'gosia@owocni.pl',
  MARIUSZ: 'mariusz@owocni.pl',
  STUDIO: 'studio@owocni.pl',
  LEADS: 'leads@owocni.pl',
  COPYWRITING: 'copywriting@owocni.pl',
  POMOC: 'pomoc@owocni.pl',
  OBSLUGA: 'obsluga@owocni.pl',
  ROBERT: 'robertmank@owocni.pl',
  EWA: 'ewamalanowska@owocni.pl',
};

export type ResolveSendableAccountOptions = {
  /** Explicit account id from the From picker (must still be allowed). */
  preferredAccountId?: string | null;
  /** Handles involved in the thread / latest mail (continuation). */
  continuationHandles?: string[] | null;
  /** When set, resolve continuation handles from this CRM record. */
  recordId?: string | null;
  /** Client email — used to find latest thread mailboxes when record is Person/Opp. */
  recipientEmail?: string | null;
};

type AccountRow = {
  id?: string;
  handle?: string | null;
  /** Twenty may return a JSON string or an already-parsed string[]. */
  handleAliases?: string | string[] | null;
  authFailedAt?: string | null;
  provider?: string | null;
  userWorkspaceId?: string | null;
};

type ChannelRow = {
  id?: string;
  handle?: string | null;
};

function normalizeHandle(handle: string | null | undefined): string {
  return String(handle || '')
    .trim()
    .toLowerCase();
}

function parseAliases(raw: unknown): string[] {
  if (raw == null || raw === '') {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.map((value) => normalizeHandle(String(value))).filter(Boolean);
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        return parsed
          .map((value) => normalizeHandle(String(value)))
          .filter(Boolean);
      }
    } catch {
      // fall through — comma-separated
    }

    return raw
      .split(/[,;\s]+/)
      .map((value) => normalizeHandle(value))
      .filter(Boolean);
  }

  return [];
}

function accountHandles(account: AccountRow): string[] {
  const primary = normalizeHandle(account.handle);
  const aliases = parseAliases(account.handleAliases);
  return primary ? [primary, ...aliases.filter((a) => a !== primary)] : aliases;
}

function isGeneralHandle(handle: string): boolean {
  return (GENERAL_MAILBOX_HANDLES as readonly string[]).includes(handle);
}

function isSharedOperatorEmail(email: string | null): boolean {
  if (!email) {
    return false;
  }

  return (SHARED_OPERATOR_EMAILS as readonly string[]).includes(email);
}

function isOwnedByCurrentUser(
  account: AccountRow,
  currentUserEmail: string | null,
): boolean {
  if (!currentUserEmail || isSharedOperatorEmail(currentUserEmail)) {
    return false;
  }

  // Shared Settings → Accounts lists everyone's mailboxes for the whole team.
  // Ownership is only "this handle is my login email", never userWorkspaceId alone.
  return accountHandles(account).includes(currentUserEmail);
}

function isAllowedForUser(
  account: AccountRow,
  currentUserEmail: string | null,
): boolean {
  if (isOwnedByCurrentUser(account, currentUserEmail)) {
    return true;
  }

  // Shared team inboxes (studio@ / leads@) — for everyone, including owocni@gmail.com.
  return accountHandles(account).some(isGeneralHandle);
}

async function loadCurrentUserIdentity(metadataClient: MetadataApiClient): Promise<{
  email: string | null;
  userWorkspaceId: string | null;
}> {
  try {
    const result = await metadataClient.query({
      currentUser: {
        email: true,
        workspaceMember: {
          userEmail: true,
        },
        currentUserWorkspace: {
          id: true,
        },
      },
    });

    const user = result.currentUser as
      | {
          email?: string | null;
          workspaceMember?: { userEmail?: string | null } | null;
          currentUserWorkspace?: { id?: string | null } | null;
        }
      | null
      | undefined;

    const email =
      normalizeHandle(user?.workspaceMember?.userEmail) ||
      normalizeHandle(user?.email) ||
      null;

    return {
      email,
      userWorkspaceId: user?.currentUserWorkspace?.id
        ? String(user.currentUserWorkspace.id)
        : null,
    };
  } catch {
    return { email: null, userWorkspaceId: null };
  }
}

async function accountIsSendable(
  metadataClient: MetadataApiClient,
  account: AccountRow,
): Promise<boolean> {
  if (!account.id || account.authFailedAt) {
    return false;
  }

  try {
    const channelsResult = await metadataClient.query({
      myMessageChannels: {
        __args: { connectedAccountId: account.id },
        id: true,
        handle: true,
      },
    });

    const channels = (channelsResult.myMessageChannels ?? []) as ChannelRow[];

    if (channels.length === 0) {
      return false;
    }

    if (account.provider === 'EMAIL_GROUP') {
      return true;
    }

    const primary = normalizeHandle(account.handle);

    return (
      channels.some((channel) => normalizeHandle(channel.handle) === primary) ||
      channels.length > 0
    );
  } catch {
    return false;
  }
}

function findAccountByHandle(
  accounts: AccountRow[],
  handle: string,
): AccountRow | undefined {
  const target = normalizeHandle(handle);

  return accounts.find((account) => accountHandles(account).includes(target));
}

function toSendable(account: AccountRow): SendableEmailAccount {
  return {
    id: String(account.id),
    handle: normalizeHandle(account.handle) || String(account.id),
  };
}

/**
 * Collect @owocni.pl handles that belong to the conversation we are replying to.
 */
export async function resolveContinuationHandles(
  coreClient: CoreApiClient,
  options: { recordId?: string | null; recipientEmail?: string | null },
): Promise<string[]> {
  const handles = new Set<string>();

  const addOurMailboxes = (values: unknown) => {
    if (!Array.isArray(values)) {
      return;
    }

    for (const value of values) {
      const mapped = OUR_MAILBOX_VALUE_TO_HANDLE[String(value).toUpperCase()];

      if (mapped) {
        handles.add(mapped);
      }
    }
  };

  const addOwocniParticipantHandles = (
    nodes: Array<{ handle?: string | null }>,
  ) => {
    for (const node of nodes) {
      const handle = normalizeHandle(node.handle);

      if (handle.endsWith('@owocni.pl')) {
        handles.add(handle);
      }
    }
  };

  const inspectMessageIds = async (messageIds: string[]) => {
    for (const messageId of messageIds.slice(0, 5)) {
      try {
        const result = await coreClient.query({
          message: {
            __args: { filter: { id: { eq: messageId } } },
            ourMailboxes: true,
            messageParticipants: {
              edges: {
                node: {
                  handle: true,
                },
              },
            },
          },
        } as never);

        const message = (
          result as {
            message?: {
              ourMailboxes?: unknown;
              messageParticipants?: {
                edges?: Array<{ node: { handle?: string | null } }>;
              };
            } | null;
          }
        ).message;

        if (!message) {
          continue;
        }

        addOurMailboxes(message.ourMailboxes);
        addOwocniParticipantHandles(
          message.messageParticipants?.edges?.map((edge) => edge.node) ?? [],
        );
      } catch {
        // ignore per-message failures
      }
    }
  };

  const recordId = options.recordId?.trim() || null;
  const recipientEmail = normalizeHandle(options.recipientEmail) || null;

  try {
    if (recordId) {
      try {
        const result = await coreClient.query({
          message: {
            __args: { filter: { id: { eq: recordId } } },
            id: true,
            ourMailboxes: true,
            messageParticipants: {
              edges: { node: { handle: true } },
            },
          },
        } as never);

        const message = (
          result as {
            message?: {
              id?: string;
              ourMailboxes?: unknown;
              messageParticipants?: {
                edges?: Array<{ node: { handle?: string | null } }>;
              };
            } | null;
          }
        ).message;

        if (message?.id) {
          addOurMailboxes(message.ourMailboxes);
          addOwocniParticipantHandles(
            message.messageParticipants?.edges?.map((edge) => edge.node) ?? [],
          );
        }
      } catch {
        // not a message
      }

      if (handles.size === 0) {
        try {
          const messagesResult = await coreClient.query({
            messages: {
              __args: {
                filter: { messageThreadId: { eq: recordId } },
                first: 3,
                orderBy: [{ receivedAt: 'DescNullsLast' }],
              },
              edges: {
                node: {
                  id: true,
                  ourMailboxes: true,
                  messageParticipants: {
                    edges: { node: { handle: true } },
                  },
                },
              },
            },
          } as never);

          const nodes =
            (
              messagesResult as {
                messages?: {
                  edges?: Array<{
                    node: {
                      id?: string;
                      ourMailboxes?: unknown;
                      messageParticipants?: {
                        edges?: Array<{ node: { handle?: string | null } }>;
                      };
                    };
                  }>;
                };
              }
            ).messages?.edges?.map((edge) => edge.node) ?? [];

          for (const node of nodes) {
            addOurMailboxes(node.ourMailboxes);
            addOwocniParticipantHandles(
              node.messageParticipants?.edges?.map((edge) => edge.node) ?? [],
            );
          }
        } catch {
          // not a thread
        }
      }
    }

    if (handles.size === 0 && recipientEmail) {
      try {
        const result = await coreClient.query({
          messageParticipants: {
            __args: {
              filter: { handle: { eq: recipientEmail } },
              first: 3,
              orderBy: [{ createdAt: 'DescNullsLast' }],
            },
            edges: {
              node: {
                messageId: true,
              },
            },
          },
        });

        const messageIds =
          (
            result.messageParticipants as {
              edges?: Array<{ node: { messageId?: string | null } }>;
            } | null
          )?.edges
            ?.map((edge) => edge.node.messageId)
            .filter((id): id is string => Boolean(id)) ?? [];

        await inspectMessageIds(messageIds);
      } catch {
        // ignore
      }
    }
  } catch {
    // empty set
  }

  return [...handles];
}

async function loadCandidateAccounts(
  metadataClient: MetadataApiClient,
): Promise<{
  allowedAccounts: AccountRow[];
  currentUserEmail: string | null;
}> {
  const identity = await loadCurrentUserIdentity(metadataClient);
  const accountsResult = await metadataClient.query({
    myConnectedAccounts: {
      id: true,
      handle: true,
      handleAliases: true,
      authFailedAt: true,
      provider: true,
    },
  });

  const activeAccounts = (
    (accountsResult.myConnectedAccounts ?? []) as AccountRow[]
  ).filter((account) => !account.authFailedAt && account.id);

  // Cheap filter first — never probe channels for other people's personal inboxes.
  const candidates = activeAccounts.filter((account) =>
    isAllowedForUser(account, identity.email),
  );

  const allowedAccounts: AccountRow[] = [];

  for (const account of candidates) {
    if (await accountIsSendable(metadataClient, account)) {
      allowedAccounts.push(account);
    }
  }

  allowedAccounts.sort((a, b) => {
    const score = (account: AccountRow) => {
      const handle = normalizeHandle(account.handle);

      if (identity.email && handle === identity.email) {
        return 0;
      }

      if (isGeneralHandle(handle)) {
        return handle === 'studio@owocni.pl' ? 1 : 2;
      }

      return 3;
    };

    const diff = score(a) - score(b);

    return diff !== 0
      ? diff
      : normalizeHandle(a.handle).localeCompare(normalizeHandle(b.handle));
  });

  return { allowedAccounts, currentUserEmail: identity.email };
}

function pickDefaultAccount(
  allowedAccounts: AccountRow[],
  currentUserEmail: string | null,
  options: ResolveSendableAccountOptions,
): AccountRow | null {
  if (allowedAccounts.length === 0) {
    return null;
  }

  if (options.preferredAccountId) {
    const preferred = allowedAccounts.find(
      (account) => account.id === options.preferredAccountId,
    );

    if (preferred) {
      return preferred;
    }
  }

  const continuation = (options.continuationHandles ?? [])
    .map(normalizeHandle)
    .filter(Boolean);

  for (const handle of continuation) {
    const mayContinue =
      isGeneralHandle(handle) ||
      (Boolean(currentUserEmail) &&
        !isSharedOperatorEmail(currentUserEmail) &&
        handle === currentUserEmail);

    if (!mayContinue) {
      continue;
    }

    const match = findAccountByHandle(allowedAccounts, handle);

    if (match) {
      return match;
    }
  }

  if (currentUserEmail && !isSharedOperatorEmail(currentUserEmail)) {
    const own = findAccountByHandle(allowedAccounts, currentUserEmail);

    if (own) {
      return own;
    }
  }

  // Shared operator / fallback: studio then leads (already sorted).
  for (const handle of GENERAL_MAILBOX_HANDLES) {
    const match = findAccountByHandle(allowedAccounts, handle);

    if (match) {
      return match;
    }
  }

  return allowedAccounts[0] ?? null;
}

export async function listAllowedSendableAccounts(
  metadataClient: MetadataApiClient,
): Promise<{
  accounts: SendableEmailAccount[];
  currentUserEmail: string | null;
}> {
  const { allowedAccounts, currentUserEmail } =
    await loadCandidateAccounts(metadataClient);

  return {
    accounts: allowedAccounts.map(toSendable),
    currentUserEmail,
  };
}

export async function findSendableEmailAccount(
  metadataClient: MetadataApiClient,
  options: ResolveSendableAccountOptions | string | null = null,
): Promise<SendableEmailAccount | null> {
  const opts: ResolveSendableAccountOptions =
    typeof options === 'string' || options === null || options === undefined
      ? { preferredAccountId: options }
      : options;

  const { allowedAccounts, currentUserEmail } =
    await loadCandidateAccounts(metadataClient);

  const picked = pickDefaultAccount(allowedAccounts, currentUserEmail, opts);

  return picked ? toSendable(picked) : null;
}

/**
 * One metadata pass for readiness UI + default From.
 */
export async function resolveSendReadiness(
  metadataClient: MetadataApiClient,
  options: ResolveSendableAccountOptions = {},
): Promise<{
  accounts: SendableEmailAccount[];
  currentUserEmail: string | null;
  selected: SendableEmailAccount | null;
}> {
  const { allowedAccounts, currentUserEmail } =
    await loadCandidateAccounts(metadataClient);
  const accounts = allowedAccounts.map(toSendable);
  const picked = pickDefaultAccount(allowedAccounts, currentUserEmail, options);

  return {
    accounts,
    currentUserEmail,
    selected: picked ? toSendable(picked) : null,
  };
}

export function mapSendEmailError(error: string): string {
  if (error.includes('No message channel found')) {
    return 'Skrzynka email nie jest zsynchronizowana w Twenty. Wejdź w Settings → Accounts, poczekaj na zakończenie synchronizacji albo odłącz i podłącz konto ponownie.';
  }

  if (error.includes('SMTP is not configured')) {
    return 'Konto email nie ma skonfigurowanego SMTP. Uzupełnij ustawienia w Settings → Accounts.';
  }

  if (error.includes('user context') || error.includes('API keys are not supported')) {
    return 'Wysyłka wymaga aktywnej sesji użytkownika — odśwież stronę i spróbuj ponownie.';
  }

  if (
    error.toLowerCase().includes('does not have permission') ||
    error.toLowerCase().includes('permission')
  ) {
    return 'Brak uprawnień do wysyłki (Twenty SEND_EMAIL). Sprawdź: (1) rola „Owocni Mail default function role” ma włączone Tools / canAccessAllTools, (2) studio@ / leads@ są podłączone na koncie, z którego jesteś zalogowany (nie tylko widoczne w wspólnej liście), (3) nie wybierasz cudzej osobistej skrzynki.';
  }

  return error;
}
