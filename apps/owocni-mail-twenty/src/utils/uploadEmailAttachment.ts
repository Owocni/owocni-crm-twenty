import { MetadataApiClient } from 'twenty-client-sdk/metadata';

import {
  MAX_EMAIL_ATTACHMENT_BYTES,
  type EmailAttachmentRef,
} from 'src/utils/emailAttachmentShared';

export type {
  EmailAttachmentRef,
  EmailAttachmentWithSize,
} from 'src/utils/emailAttachmentShared';
export {
  ATTACHMENT_UPLOAD_PATH,
  MAX_EMAIL_ATTACHMENT_BYTES,
  MAX_EMAIL_ATTACHMENTS,
  formatFileSize,
  readAttachmentRefs,
} from 'src/utils/emailAttachmentShared';

/**
 * Direct-to-storage upload (`createFileUpload` → PUT → `completeFileUpload`).
 * Call from a logic function with real bytes — FC sandboxes only get metadata.
 */
export async function uploadEmailAttachmentBytes(options: {
  filename: string;
  body: Buffer | Uint8Array;
  contentType?: string;
}): Promise<EmailAttachmentRef> {
  const filename = options.filename?.trim();

  if (!filename) {
    throw new Error('Brak pliku.');
  }

  const body = Buffer.isBuffer(options.body)
    ? options.body
    : Buffer.from(options.body);

  if (body.byteLength <= 0) {
    throw new Error(`Plik „${filename}” jest pusty.`);
  }

  if (body.byteLength > MAX_EMAIL_ATTACHMENT_BYTES) {
    const mb = Math.round(MAX_EMAIL_ATTACHMENT_BYTES / (1024 * 1024));
    throw new Error(`Plik „${filename}” jest za duży (max ${mb} MB).`);
  }

  const metadataClient = new MetadataApiClient();

  const createResult = await metadataClient.mutation({
    createFileUpload: {
      __args: {
        filename,
        size: body.byteLength,
        fileFolder: 'EmailAttachment',
      },
      fileId: true,
      uploadUrl: true,
      contentType: true,
    },
  });

  const target = createResult.createFileUpload;

  if (!target?.fileId || !target.uploadUrl) {
    throw new Error(`Nie udało się przygotować uploadu dla „${filename}”.`);
  }

  const contentType =
    target.contentType ||
    options.contentType ||
    'application/octet-stream';

  const putResponse = await fetch(target.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body,
  });

  if (!putResponse.ok) {
    const detail = await putResponse.text().catch(() => '');
    throw new Error(
      `Upload „${filename}” nie powiódł się (${putResponse.status})${
        detail ? `: ${detail.slice(0, 120)}` : ''
      }.`,
    );
  }

  const completeResult = await metadataClient.mutation({
    completeFileUpload: {
      __args: {
        fileId: target.fileId,
      },
      id: true,
      path: true,
      size: true,
      url: true,
    },
  });

  const completed = completeResult.completeFileUpload;

  if (!completed?.id) {
    throw new Error(`Nie udało się domknąć uploadu „${filename}”.`);
  }

  return {
    id: String(completed.id),
    name: filename,
  };
}
