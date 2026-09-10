export type BounceReason = 'invalid' | 'undelivered';

const BOUNCE_SUBJECT_RE =
  /undelivered mail|mail delivery failed|delivery status notification|returned mail|undeliverable|failure notice|niedostarcz|nie dostarczono|mail delivery subsystem|delivery failure/i;

const DSN_BODY_RE =
  /mail delivery software|this is the mail system at|could not be delivered|address\(es\) failed|recipient address rejected|user unknown|unknown user|mailbox unavailable|final-recipient:|diagnostic-code:|retry timeout exceeded|550\s*5\.1\.1|550\s*5\.1\.0|status:\s*5\.\d\.\d|host .+ said:\s*5/i;

function normalizeHandle(handle: string | null | undefined): string {
  return String(handle || '')
    .trim()
    .toLowerCase()
    .replace(/^<|>$/g, '');
}

export function isBounceSender(
  handle?: string | null,
  displayName?: string | null,
): boolean {
  const h = normalizeHandle(handle);
  const d = String(displayName || '').toLowerCase();
  if (h.includes('mailer-daemon')) return true;
  if (d.includes('mail delivery')) return true;
  if (h.startsWith('postmaster@')) {
    return !d || d.includes('postmaster') || d.includes('mail delivery');
  }
  return false;
}

export function isBounceMessage(input: {
  subject?: string | null;
  text?: string | null;
  fromHandle?: string | null;
  fromDisplayName?: string | null;
}): boolean {
  const sender = isBounceSender(input.fromHandle, input.fromDisplayName);
  const subject = BOUNCE_SUBJECT_RE.test(String(input.subject || ''));
  const body = DSN_BODY_RE.test(String(input.text || ''));
  if (sender && (subject || body)) return true;
  if (subject && body) return true;
  return false;
}

export function classifyBounceReason(
  text?: string | null,
): BounceReason {
  const raw = String(text || '');
  if (
    /over quota|mailbox full|insufficient storage|quota exceeded|5\.2\.2|retry timeout exceeded/i.test(
      raw,
    )
  ) {
    return 'undelivered';
  }
  if (
    /user unknown|unknown user|mailbox unavailable|recipient address rejected|invalid recipient|does not exist|nie istnieje|no such user|user not found|unrouteable|unroutable|no route to host|host not found|domain not found|status:\s*5\.1\.[01]|550\s*5\.1\.[01]/i.test(
      raw,
    )
  ) {
    return 'invalid';
  }
  return 'undelivered';
}

export function bounceChannelLabel(reason?: BounceReason | null): string {
  return reason === 'invalid'
    ? 'Zwrotka · niepoprawny adres'
    : 'Zwrotka · nie dostarczono';
}
