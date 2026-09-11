import { isEmptyComposeHtml } from 'src/utils/mailSignature';

export const COMPOSE_DRAFT_PREFIX = 'compose:';
export const COMPOSE_DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type ComposeDraftMode = 'reply' | 'internal' | 'forward';

export type ComposeDraftEnvelope = {
  v: 1;
  html: string;
  subject: string;
  to?: string;
  cc?: string;
  bcc?: string;
  selectedId?: string;
  mode?: ComposeDraftMode;
  handoffTo?: string;
  replyMessageId?: string;
};

export function isComposeDraftKey(sessionId: string): boolean {
  return sessionId.startsWith(COMPOSE_DRAFT_PREFIX);
}

export function composeDraftKey(
  recordId: string | null | undefined,
  userEmail: string | null | undefined,
): string | null {
  const record = recordId?.trim() ?? '';
  const email = userEmail?.trim().toLowerCase() ?? '';

  if (!record || !email) {
    return null;
  }

  return `${COMPOSE_DRAFT_PREFIX}${encodeURIComponent(email)}:${record}`;
}

export function serializeComposeDraft(draft: ComposeDraftEnvelope): string {
  return JSON.stringify({
    v: 1,
    html: draft.html,
    subject: draft.subject,
    ...(draft.to ? { to: draft.to } : {}),
    ...(draft.cc ? { cc: draft.cc } : {}),
    ...(draft.bcc ? { bcc: draft.bcc } : {}),
    ...(draft.selectedId ? { selectedId: draft.selectedId } : {}),
    ...(draft.mode && draft.mode !== 'reply' ? { mode: draft.mode } : {}),
    ...(draft.handoffTo ? { handoffTo: draft.handoffTo } : {}),
    ...(draft.replyMessageId ? { replyMessageId: draft.replyMessageId } : {}),
  } satisfies ComposeDraftEnvelope);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function parseComposeDraft(
  raw: string | null | undefined,
): ComposeDraftEnvelope | null {
  const text = raw?.trim() ?? '';

  if (!text) {
    return null;
  }

  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as Partial<ComposeDraftEnvelope> & {
        html?: unknown;
        subject?: unknown;
        v?: unknown;
      };

      if (parsed && typeof parsed === 'object' && 'html' in parsed) {
        const mode = parsed.mode;

        return {
          v: 1,
          html: asString(parsed.html),
          subject: asString(parsed.subject),
          to: asString(parsed.to) || undefined,
          cc: asString(parsed.cc) || undefined,
          bcc: asString(parsed.bcc) || undefined,
          selectedId: asString(parsed.selectedId) || undefined,
          mode:
            mode === 'internal' || mode === 'forward' || mode === 'reply'
              ? mode
              : undefined,
          handoffTo: asString(parsed.handoffTo) || undefined,
          replyMessageId: asString(parsed.replyMessageId) || undefined,
        };
      }
    } catch {
      // fall through — treat as raw HTML
    }
  }

  if (text === 'cancelled' || text === 'sent' || text === 'attached') {
    return null;
  }

  return {
    v: 1,
    html: text,
    subject: '',
  };
}

export function mergeComposeDraft(
  existing: ComposeDraftEnvelope | null,
  patch: Partial<ComposeDraftEnvelope>,
): ComposeDraftEnvelope {
  const html =
    patch.html !== undefined ? patch.html : existing?.html ?? '';
  const subject =
    patch.subject !== undefined ? patch.subject : existing?.subject ?? '';

  return {
    v: 1,
    html,
    subject,
    to: patch.to !== undefined ? patch.to || undefined : existing?.to,
    cc: patch.cc !== undefined ? patch.cc || undefined : existing?.cc,
    bcc: patch.bcc !== undefined ? patch.bcc || undefined : existing?.bcc,
    selectedId:
      patch.selectedId !== undefined
        ? patch.selectedId || undefined
        : existing?.selectedId,
    mode: patch.mode !== undefined ? patch.mode : existing?.mode,
    handoffTo:
      patch.handoffTo !== undefined
        ? patch.handoffTo || undefined
        : existing?.handoffTo,
    replyMessageId:
      patch.replyMessageId !== undefined
        ? patch.replyMessageId || undefined
        : existing?.replyMessageId,
  };
}

export function isMeaningfulComposeDraft(
  draft: ComposeDraftEnvelope | null | undefined,
): boolean {
  if (!draft) {
    return false;
  }

  if (!isEmptyComposeHtml(draft.html)) {
    return true;
  }

  if (draft.cc?.trim() || draft.bcc?.trim() || draft.handoffTo?.trim()) {
    return true;
  }

  if (draft.mode === 'internal' || draft.mode === 'forward') {
    return true;
  }

  return Boolean(
    draft.selectedId &&
      draft.selectedId !== '__owocni_free_compose__',
  );
}
