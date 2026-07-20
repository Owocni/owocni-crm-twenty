/**
 * Per-user "active mail context" — pinned when viewing a lead/thread,
 * restored when Szablony opens after native Reply cleared Twenty hooks.
 */

const TTL_MS = 2 * 60 * 60 * 1000;

export type ActiveMailContext = {
  recordId: string;
  email?: string;
  replySubject?: string;
  objectNameSingular?: string;
  pinnedAt: number;
};

type ActiveGlobal = typeof globalThis & {
  __owocniMailActiveContext?: Map<string, ActiveMailContext>;
};

function getMap(): Map<string, ActiveMailContext> {
  const g = globalThis as ActiveGlobal;
  if (!g.__owocniMailActiveContext) {
    g.__owocniMailActiveContext = new Map();
  }
  return g.__owocniMailActiveContext;
}

export function pinActiveMailContext(
  userId: string,
  context: Omit<ActiveMailContext, 'pinnedAt'>,
): ActiveMailContext {
  const entry: ActiveMailContext = {
    ...context,
    pinnedAt: Date.now(),
  };
  getMap().set(userId, entry);
  return entry;
}

export function readActiveMailContext(
  userId: string,
): ActiveMailContext | null {
  const entry = getMap().get(userId);
  if (!entry) {
    return null;
  }
  if (Date.now() - entry.pinnedAt > TTL_MS) {
    getMap().delete(userId);
    return null;
  }
  return entry;
}
