import { invalidEmailsInList, parseEmailList } from 'src/utils/parseEmailList';
import { bounceChannelLabel } from 'src/utils/mailBounce';
import type { MailThreadChannel } from 'src/utils/personContext';

export const INTERNAL_HANDOFF_SUBJECT_PREFIX = '[Wewnętrzne]';
export const INTERNAL_HANDOFF_TO_PLACEHOLDER = 'email@adres.pl';
export const HANDOFF_MARKER_PREFIX = 'owocni-handoff:';

export function handoffPendingDraftKey(opportunityId: string): string {
  return `handoff-pending:${opportunityId.trim()}`;
}

export function handoffMarker(opportunityId: string): string {
  return `${HANDOFF_MARKER_PREFIX}${opportunityId.trim()}`;
}

export function injectHandoffMarker(
  html: string,
  opportunityId: string,
): string {
  const marker = handoffMarker(opportunityId);
  if (!opportunityId.trim() || html.includes(marker)) {
    return html;
  }
  return `${html}<p style="margin:12px 0 0;font-size:10px;color:#94a3b8">${marker}</p>`;
}

export function textHasHandoffMarker(
  text: string | null | undefined,
  opportunityId: string,
): boolean {
  const marker = handoffMarker(opportunityId);
  return Boolean(text && marker && text.includes(marker));
}

export type InternalHandoffCheck = {
  ok: true;
  to: string;
} | {
  ok: false;
  error: string;
};

export function toInternalHandoffSubject(
  subject: string | null | undefined,
): string {
  const trimmed = (subject ?? '').trim();
  if (!trimmed) {
    return `${INTERNAL_HANDOFF_SUBJECT_PREFIX} wątek leada`;
  }
  if (trimmed.toLowerCase().startsWith(INTERNAL_HANDOFF_SUBJECT_PREFIX.toLowerCase())) {
    return trimmed;
  }
  return `${INTERNAL_HANDOFF_SUBJECT_PREFIX} ${trimmed}`;
}

export function assertInternalHandoffRecipients(input: {
  to: string;
  cc?: string;
  bcc?: string;
  clientEmail?: string | null;
}): InternalHandoffCheck {
  const to = parseEmailList(input.to);
  if (to.length !== 1 || invalidEmailsInList(input.to).length > 0) {
    return {
      ok: false,
      error: 'Podaj dokładnie jeden adres email.',
    };
  }

  const client = input.clientEmail?.trim().toLowerCase() ?? '';
  const copies = [...parseEmailList(input.cc), ...parseEmailList(input.bcc)];
  const all = [...to, ...copies];

  if (client && all.includes(client)) {
    return {
      ok: false,
      error: 'Klient nie może być w To/DW/UDW — ten mail jest tylko wewnętrzny.',
    };
  }

  return { ok: true, to: to[0] };
}

export function threadChannelLabel(
  channel: MailThreadChannel | undefined,
  direction: 'in' | 'out',
  bounceReason?: 'invalid' | 'undelivered' | null,
): string {
  if (channel === 'bounce') {
    return bounceChannelLabel(bounceReason);
  }
  if (channel === 'internal') {
    return direction === 'out'
      ? 'Wewnętrzny · od nas'
      : 'Wewnętrzny · do nas';
  }
  return direction === 'out' ? 'Od nas' : 'Do nas';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function quoteClientMessageHtml(input: {
  fromLabel?: string | null;
  fromEmail?: string | null;
  subject?: string | null;
  text?: string | null;
}): string {
  const who = (input.fromLabel || input.fromEmail || 'Klient').trim();
  const subject = (input.subject ?? '').trim();
  const text = (input.text ?? '').trim() || '(brak treści)';
  const heading = subject ? `${escapeHtml(who)} · ${escapeHtml(subject)}` : escapeHtml(who);
  const body = escapeHtml(text).replaceAll('\n', '<br>');

  return (
    `<p>Przekazuję wiadomość klienta — <strong>klient tego maila nie dostaje</strong>.</p>` +
    `<blockquote style="border-left:3px solid #cbd5e1;padding-left:12px;color:#334155">` +
    `<p><strong>${heading}</strong></p><p>${body}</p></blockquote><p><br></p>`
  );
}
