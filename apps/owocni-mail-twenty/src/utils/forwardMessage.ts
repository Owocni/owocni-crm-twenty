export const FORWARD_TO_PLACEHOLDER = 'email@adres.pl';

/** Build a forward-style subject; leave existing Fwd:/Fw:/Prz: prefixes alone. */
export function toForwardSubject(subject: string | null | undefined): string {
  const trimmed = (subject ?? '').trim();
  if (!trimmed) {
    return 'Fwd:';
  }

  if (/^(fwd|fw|prz)\s*:/i.test(trimmed)) {
    return trimmed;
  }

  return `Fwd: ${trimmed}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatForwardDate(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }

  try {
    return new Intl.DateTimeFormat('pl-PL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Standard forwarded-message quote (recipient does receive this mail). */
export function quoteForwardedMessageHtml(input: {
  fromLabel?: string | null;
  fromEmail?: string | null;
  subject?: string | null;
  receivedAt?: string | null;
  text?: string | null;
}): string {
  const who = (input.fromEmail || input.fromLabel || '').trim();
  const subject = (input.subject ?? '').trim();
  const when = formatForwardDate(input.receivedAt);
  const text = (input.text ?? '').trim() || '(brak treści)';
  const meta = [
    who ? `Od: ${escapeHtml(who)}` : '',
    when ? `Data: ${escapeHtml(when)}` : '',
    subject ? `Temat: ${escapeHtml(subject)}` : '',
  ]
    .filter(Boolean)
    .join('<br>');
  const body = escapeHtml(text).replaceAll('\n', '<br>');

  return (
    `<p><br></p>` +
    `<p>---------- Przekazana wiadomość ----------</p>` +
    (meta ? `<p>${meta}</p>` : '') +
    `<blockquote style="border-left:3px solid #cbd5e1;padding-left:12px;color:#334155">` +
    `<p>${body}</p></blockquote><p><br></p>`
  );
}
