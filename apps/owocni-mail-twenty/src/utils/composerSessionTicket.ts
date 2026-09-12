export const REFRESH_COMPOSER_SESSION_PATH = '/s/mail/refresh-composer-session';

const TICKET_HEX_LENGTH = 64;

export function isComposerSessionTicket(ticket: string): boolean {
  return new RegExp(`^[a-f0-9]{${TICKET_HEX_LENGTH}}$`, 'i').test(ticket.trim());
}

export function createComposerSessionTicket(): string {
  const bytes = new Uint8Array(TICKET_HEX_LENGTH / 2);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}
