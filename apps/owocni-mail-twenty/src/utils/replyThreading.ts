/** Decide whether a Twenty message may be used as In-Reply-To. */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function participantHandlesMatchRecipient(
  handles: Array<string | null | undefined>,
  recipientEmail: string,
): boolean {
  const want = normalizeEmail(recipientEmail);

  if (!want || !want.includes('@')) {
    return false;
  }

  return handles.some(
    (handle) => Boolean(handle) && normalizeEmail(handle as string) === want,
  );
}

export type ThreadingDecision =
  | { ok: true; headerMessageId: string }
  | { ok: false; reason: string };

/**
 * Thread only when the RFC header exists AND the outbound recipient
 * is a participant of that message. Otherwise send as a new message.
 */
export function decideInReplyTo(input: {
  recipientEmail: string;
  headerMessageId?: string | null;
  participantHandles: Array<string | null | undefined>;
}): ThreadingDecision {
  const header = input.headerMessageId?.trim();

  if (!header) {
    return { ok: false, reason: 'no-header-id' };
  }

  if (
    !participantHandlesMatchRecipient(
      input.participantHandles,
      input.recipientEmail,
    )
  ) {
    return { ok: false, reason: 'recipient-not-on-message' };
  }

  return { ok: true, headerMessageId: header };
}
