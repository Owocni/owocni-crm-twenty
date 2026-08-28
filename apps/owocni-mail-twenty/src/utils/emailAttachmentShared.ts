export type EmailAttachmentRef = {
  id: string;
  name: string;
};

export type EmailAttachmentWithSize = EmailAttachmentRef & {
  size?: number;
};

/** Align with Twenty native composer (~10 MB per file). */
export const MAX_EMAIL_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_EMAIL_ATTACHMENTS = 5;

export const ATTACHMENT_UPLOAD_PATH = '/s/mail/upload-attachment';

export function readAttachmentRefs(
  payload: Record<string, unknown>,
): EmailAttachmentRef[] {
  const raw = payload.files ?? payload.attachments;

  if (!Array.isArray(raw)) {
    return [];
  }

  const out: EmailAttachmentRef[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const id = String((entry as { id?: unknown }).id ?? '').trim();
    const name = String((entry as { name?: unknown }).name ?? '').trim();

    if (id && name) {
      out.push({ id, name });
    }
  }

  return out.slice(0, MAX_EMAIL_ATTACHMENTS);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
