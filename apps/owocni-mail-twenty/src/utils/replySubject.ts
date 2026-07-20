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
