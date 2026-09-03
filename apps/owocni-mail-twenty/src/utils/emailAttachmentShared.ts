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

/** Nested file-picker iframe → parent (srcdoc origin is often `"null"`). */
export const ATTACHMENT_FRAME_MESSAGE_TYPE = 'owocni-mail-attachment';

export type AttachmentFrameMessage = {
  type: typeof ATTACHMENT_FRAME_MESSAGE_TYPE;
  sessionId: string;
  ok?: boolean;
  error?: string;
  file?: EmailAttachmentRef & { size?: number };
  uploading?: boolean;
};

export function parseAttachmentFrameMessage(
  data: unknown,
  sessionId: string,
): AttachmentFrameMessage | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const rec = data as Record<string, unknown>;

  if (rec.type !== ATTACHMENT_FRAME_MESSAGE_TYPE) {
    return null;
  }

  if (String(rec.sessionId ?? '') !== sessionId) {
    return null;
  }

  const fileRaw = rec.file;
  let file: (EmailAttachmentRef & { size?: number }) | undefined;

  if (fileRaw && typeof fileRaw === 'object') {
    const id = String((fileRaw as { id?: unknown }).id ?? '').trim();
    const name = String((fileRaw as { name?: unknown }).name ?? '').trim();
    const sizeRaw = (fileRaw as { size?: unknown }).size;
    const size =
      typeof sizeRaw === 'number' && Number.isFinite(sizeRaw)
        ? sizeRaw
        : undefined;

    if (id && name) {
      file = { id, name, size };
    }
  }

  return {
    type: ATTACHMENT_FRAME_MESSAGE_TYPE,
    sessionId,
    ok: rec.ok === true,
    error: typeof rec.error === 'string' && rec.error.trim() ? rec.error : undefined,
    file,
    uploading: typeof rec.uploading === 'boolean' ? rec.uploading : undefined,
  };
}

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
