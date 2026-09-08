const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/** Split comma / semicolon / whitespace lists used in DW and UDW fields. */
export function parseEmailList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }

  const unique: string[] = [];

  for (const part of raw.split(/[,;]+/)) {
    const email = part.trim().toLowerCase();
    if (!email || unique.includes(email)) {
      continue;
    }
    unique.push(email);
  }

  return unique;
}

export function formatEmailList(emails: string[]): string {
  return emails.join(', ');
}

export function invalidEmailsInList(raw: string | null | undefined): string[] {
  return parseEmailList(raw).filter((email) => !EMAIL_RE.test(email));
}

export function emailsExcluding(
  emails: string[],
  skip: string | null | undefined,
): string[] {
  const blocked = skip?.trim().toLowerCase();
  if (!blocked) {
    return emails;
  }
  return emails.filter((email) => email !== blocked);
}

export function formatSendReceipt(
  to: string,
  cc?: string,
  bcc?: string,
): string {
  let message = `Wysłano do ${to}`;
  if (cc?.trim()) {
    message += ` · DW ${cc.trim()}`;
  }
  if (bcc?.trim()) {
    message += ' · UDW';
  }
  return `${message}.`;
}
