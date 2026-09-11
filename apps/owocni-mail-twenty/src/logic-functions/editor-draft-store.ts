import { CoreApiClient } from 'twenty-client-sdk/core';

import {
  COMPOSE_DRAFT_TTL_MS,
  isComposeDraftKey,
  mergeComposeDraft,
  parseComposeDraft,
  serializeComposeDraft,
  type ComposeDraftEnvelope,
} from 'src/utils/composeDraft';

/**
 * Draft store: in-memory Map (same worker) + durable mailEditorDraft (DB).
 * Memory is primary for read-after-write within a request/worker;
 * DB is best-effort so other workers can eventually see drafts.
 */

const DRAFT_TTL_MS = 30 * 60 * 1000;
const HANDOFF_PENDING_TTL_MS = 24 * 60 * 60 * 1000;

export function draftTtlMs(sessionId: string): number {
  if (isComposeDraftKey(sessionId)) {
    return COMPOSE_DRAFT_TTL_MS;
  }

  if (sessionId.startsWith('handoff-pending:')) {
    return HANDOFF_PENDING_TTL_MS;
  }

  return DRAFT_TTL_MS;
}

type DraftEntry = {
  html: string;
  updatedAt: number;
};

type DraftGlobal = typeof globalThis & {
  __owocniMailEditorDrafts?: Map<string, DraftEntry>;
};

type DraftNode = {
  id?: string;
  sessionKey?: string | null;
  htmlBody?: string | null;
  updatedAt?: string | null;
};

type DraftClient = {
  query: (request: Record<string, unknown>) => Promise<Record<string, unknown>>;
  mutation: (request: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

function getMemoryMap(): Map<string, DraftEntry> {
  const g = globalThis as DraftGlobal;
  if (!g.__owocniMailEditorDrafts) {
    g.__owocniMailEditorDrafts = new Map<string, DraftEntry>();
  }
  return g.__owocniMailEditorDrafts;
}

function getClient(): DraftClient {
  return new CoreApiClient() as unknown as DraftClient;
}

function edgesOf(
  result: Record<string, unknown>,
  key: string,
): Array<{ node?: DraftNode }> {
  const collection = result[key] as
    | { edges?: Array<{ node?: DraftNode }> }
    | undefined;

  return collection?.edges ?? [];
}

function saveMemory(sessionId: string, html: string): void {
  getMemoryMap().set(sessionId, { html, updatedAt: Date.now() });
}

function getMemory(sessionId: string): string | null {
  const entry = getMemoryMap().get(sessionId);
  if (!entry) {
    return null;
  }
  if (Date.now() - entry.updatedAt > draftTtlMs(sessionId)) {
    getMemoryMap().delete(sessionId);
    return null;
  }
  return entry.html;
}

async function findDraftBySession(
  client: DraftClient,
  sessionId: string,
): Promise<DraftNode | null> {
  const result = await client.query({
    mailEditorDrafts: {
      __args: {
        filter: { sessionKey: { eq: sessionId } },
        first: 1,
      },
      edges: {
        node: {
          id: true,
          sessionKey: true,
          htmlBody: true,
          updatedAt: true,
        },
      },
    },
  });

  return edgesOf(result, 'mailEditorDrafts')[0]?.node ?? null;
}

async function saveToDb(sessionId: string, html: string): Promise<void> {
  const client = getClient();
  const existing = await findDraftBySession(client, sessionId);

  if (existing?.id) {
    await client.mutation({
      updateMailEditorDraft: {
        __args: {
          id: existing.id,
          data: { htmlBody: html },
        },
        id: true,
      },
    });
    return;
  }

  await client.mutation({
    createMailEditorDraft: {
      __args: {
        data: {
          sessionKey: sessionId,
          htmlBody: html,
        },
      },
      id: true,
    },
  });
}

async function getFromDb(sessionId: string): Promise<string | null> {
  const client = getClient();
  const existing = await findDraftBySession(client, sessionId);

  if (!existing) {
    return null;
  }

  if (existing.updatedAt) {
    const updatedMs = Date.parse(existing.updatedAt);
    const ttl = draftTtlMs(sessionId);
    if (!Number.isNaN(updatedMs) && Date.now() - updatedMs > ttl) {
      return null;
    }
  }

  return typeof existing.htmlBody === 'string' ? existing.htmlBody : null;
}

export async function saveEditorDraft(
  sessionId: string,
  html: string,
): Promise<{ memory: true; db: boolean; dbError?: string }> {
  saveMemory(sessionId, html);

  try {
    await saveToDb(sessionId, html);
    return { memory: true, db: true };
  } catch (error) {
    return {
      memory: true,
      db: false,
      dbError: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getEditorDraft(
  sessionId: string,
): Promise<string | null> {
  const fromMemory = getMemory(sessionId);
  if (fromMemory !== null) {
    return fromMemory;
  }

  try {
    return await getFromDb(sessionId);
  } catch {
    return null;
  }
}

/** Always re-read DB so a cancel/delete on another isolate wins over stale memory. */
export async function getEditorDraftFresh(
  sessionId: string,
): Promise<string | null> {
  try {
    const fromDb = await getFromDb(sessionId);
    if (fromDb !== null) {
      saveMemory(sessionId, fromDb);
      return fromDb;
    }
    getMemoryMap().delete(sessionId);
    return null;
  } catch {
    return getMemory(sessionId);
  }
}

export async function upsertComposeDraft(
  sessionId: string,
  patch: Partial<ComposeDraftEnvelope>,
): Promise<{ memory: true; db: boolean; dbError?: string }> {
  const existing = parseComposeDraft(await getEditorDraftFresh(sessionId));
  const next = mergeComposeDraft(existing, patch);
  return saveEditorDraft(sessionId, serializeComposeDraft(next));
}

export async function clearEditorDraft(sessionId: string): Promise<void> {
  getMemoryMap().delete(sessionId);

  try {
    const client = getClient();
    const existing = await findDraftBySession(client, sessionId);
    if (!existing?.id) {
      return;
    }
    await client.mutation({
      deleteMailEditorDraft: {
        __args: { id: existing.id },
        id: true,
      },
    });
  } catch {
    // ignore
  }
}
