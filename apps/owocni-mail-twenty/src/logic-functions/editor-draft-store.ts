type DraftEntry = {
  html: string;
  updatedAt: number;
};

const DRAFT_TTL_MS = 30 * 60 * 1000;
const drafts = new Map<string, DraftEntry>();

function pruneExpiredDrafts(): void {
  const now = Date.now();

  for (const [sessionId, entry] of drafts.entries()) {
    if (now - entry.updatedAt > DRAFT_TTL_MS) {
      drafts.delete(sessionId);
    }
  }
}

export function saveEditorDraft(sessionId: string, html: string): void {
  drafts.set(sessionId, { html, updatedAt: Date.now() });
  pruneExpiredDrafts();
}

export function getEditorDraft(sessionId: string): string | null {
  const entry = drafts.get(sessionId);

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.updatedAt > DRAFT_TTL_MS) {
    drafts.delete(sessionId);
    return null;
  }

  return entry.html;
}

export function clearEditorDraft(sessionId: string): void {
  drafts.delete(sessionId);
}
