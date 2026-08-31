/** Build a reply-style subject; leave existing Re:/Odp: prefixes alone. */
export function toReplySubject(subject: string | null | undefined): string {
  const trimmed = (subject ?? '').trim();

  if (!trimmed) {
    return '';
  }

  if (/^(re|odp|aw|sv|antw)\s*:/i.test(trimmed)) {
    return trimmed;
  }

  return `Re: ${trimmed}`;
}

/**
 * Subject that actually goes out on send.
 * Whatever is in the Temat field always wins; thread subject is only a fallback.
 */
export function resolveSendSubject(
  editedSubject: string | null | undefined,
  threadSubject: string | null | undefined,
): string {
  const edited = (editedSubject ?? '').trim();

  if (edited) {
    return edited;
  }

  return toReplySubject(threadSubject);
}
