import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import {
  ackAttachmentUploads,
  listAttachmentUploads,
  markAttachmentUploadFinished,
  markAttachmentUploadStarted,
  pushAttachmentUpload,
} from 'src/logic-functions/attachment-upload-store';
import { parseRouteBody, readStringField } from 'src/utils/parseRouteBody';
import {
  MAX_EMAIL_ATTACHMENT_BYTES,
  MAX_EMAIL_ATTACHMENTS,
} from 'src/utils/emailAttachmentShared';
import { uploadEmailAttachmentBytes } from 'src/utils/uploadEmailAttachment';

function readStringArray(payload: Record<string, unknown>, key: string): string[] {
  const raw = payload[key];

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);
}

const handler = async (event: RoutePayload) => {
  const payload = parseRouteBody(event);
  const sessionId = readStringField(payload, 'sessionId');
  const action = readStringField(payload, 'action') || 'upload';

  if (!sessionId) {
    return { ok: false, error: 'sessionId is required' };
  }

  if (action === 'list') {
    const listed = listAttachmentUploads(sessionId);
    return { ok: true, ...listed };
  }

  if (action === 'ack') {
    ackAttachmentUploads(sessionId, readStringArray(payload, 'ids'));
    return { ok: true, ...listAttachmentUploads(sessionId) };
  }

  if (action !== 'upload') {
    return { ok: false, error: `Unknown action: ${action}` };
  }

  const filename = readStringField(payload, 'filename', 'name');
  const contentType = readStringField(payload, 'contentType', 'type');
  const contentBase64 = readStringField(
    payload,
    'contentBase64',
    'fileBase64',
    'dataBase64',
  );

  if (!filename || !contentBase64) {
    return { ok: false, error: 'filename and contentBase64 are required' };
  }

  const listedBefore = listAttachmentUploads(sessionId);

  if (listedBefore.files.length >= MAX_EMAIL_ATTACHMENTS) {
    return {
      ok: false,
      error: `Maks. ${MAX_EMAIL_ATTACHMENTS} załączników.`,
    };
  }

  let bytes: Buffer;

  try {
    bytes = Buffer.from(contentBase64, 'base64');
  } catch {
    return { ok: false, error: 'Niepoprawne contentBase64.' };
  }

  if (bytes.byteLength <= 0) {
    return { ok: false, error: `Plik „${filename}” jest pusty.` };
  }

  if (bytes.byteLength > MAX_EMAIL_ATTACHMENT_BYTES) {
    return {
      ok: false,
      error: `Plik „${filename}” jest za duży (max ${Math.round(MAX_EMAIL_ATTACHMENT_BYTES / (1024 * 1024))} MB).`,
    };
  }

  markAttachmentUploadStarted(sessionId);

  try {
    const uploaded = await uploadEmailAttachmentBytes({
      filename,
      body: bytes,
      contentType: contentType || undefined,
    });

    const withSize = { ...uploaded, size: bytes.byteLength };
    pushAttachmentUpload(sessionId, withSize);

    return {
      ok: true,
      file: withSize,
      ...listAttachmentUploads(sessionId),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      ...listAttachmentUploads(sessionId),
    };
  } finally {
    markAttachmentUploadFinished(sessionId);
  }
};

export default defineLogicFunction({
  universalIdentifier: 'f8a2c4e6-1b3d-4f5a-9c7e-8d0a1b2c3d4e',
  name: 'upload-email-attachment',
  description:
    'Uploads an email attachment from base64 (iframe bridge) into EmailAttachment storage',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/upload-attachment',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
