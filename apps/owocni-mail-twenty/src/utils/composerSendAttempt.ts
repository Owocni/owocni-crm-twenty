export function composerSendAttemptKey(attemptId: string): string {
  return `v2attempt:${attemptId.trim()}`;
}

/** djb2 — same algorithm in the composer iframe (no WebCrypto). */
export function hashSendBody(html: string): string {
  let hash = 5381;
  const text = String(html || '');

  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) + hash + text.charCodeAt(i);
    hash |= 0;
  }

  return (hash >>> 0).toString(16);
}

export function parseComposerSendAttempt(
  raw: string | null | undefined,
): { status: 'sending' | 'sent'; bodyHash: string } | null {
  const value = raw?.trim() ?? '';
  const match = /^(sending|sent):([a-f0-9]+)$/i.exec(value);

  if (!match) {
    return null;
  }

  return {
    status: match[1].toLowerCase() as 'sending' | 'sent',
    bodyHash: match[2].toLowerCase(),
  };
}

export function serializeComposerSendAttempt(
  status: 'sending' | 'sent',
  bodyHash: string,
): string {
  return `${status}:${bodyHash}`;
}
