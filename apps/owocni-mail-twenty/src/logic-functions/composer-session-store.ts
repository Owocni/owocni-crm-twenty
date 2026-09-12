import { isComposerSessionTicket } from 'src/utils/composerSessionTicket';

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

type ComposerSession = {
  accessToken: string;
  sessionId: string;
  updatedAt: number;
};

type SessionGlobal = typeof globalThis & {
  __owocniComposerSessions?: Map<string, ComposerSession>;
};

function getMap(): Map<string, ComposerSession> {
  const g = globalThis as SessionGlobal;

  if (!g.__owocniComposerSessions) {
    g.__owocniComposerSessions = new Map<string, ComposerSession>();
  }

  return g.__owocniComposerSessions;
}

function prune(map: Map<string, ComposerSession>, now: number): void {
  for (const [ticket, session] of map) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      map.delete(ticket);
    }
  }
}

export function pushComposerSession(args: {
  ticket: string;
  accessToken: string;
  sessionId?: string;
}): { ok: true } | { ok: false; error: string } {
  const ticket = args.ticket.trim();
  const accessToken = args.accessToken.trim();

  if (!isComposerSessionTicket(ticket)) {
    return { ok: false, error: 'invalid ticket' };
  }

  if (!accessToken) {
    return { ok: false, error: 'accessToken is required' };
  }

  const map = getMap();
  const now = Date.now();
  prune(map, now);
  const previous = map.get(ticket);

  map.set(ticket, {
    accessToken,
    sessionId: args.sessionId?.trim() || previous?.sessionId || '',
    updatedAt: now,
  });

  return { ok: true };
}

export function pullComposerSession(
  ticket: string,
): { accessToken: string; sessionId: string } | null {
  const key = ticket.trim();
  if (!isComposerSessionTicket(key)) {
    return null;
  }

  const map = getMap();
  const now = Date.now();
  prune(map, now);
  const session = map.get(key);

  if (!session) {
    return null;
  }

  return {
    accessToken: session.accessToken,
    sessionId: session.sessionId,
  };
}

export function dropComposerSession(ticket: string): void {
  const key = ticket.trim();
  if (!isComposerSessionTicket(key)) {
    return;
  }

  getMap().delete(key);
}
