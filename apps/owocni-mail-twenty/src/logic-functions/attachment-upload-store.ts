import type { EmailAttachmentWithSize } from 'src/utils/emailAttachmentShared';

const ENTRY_TTL_MS = 30 * 60 * 1000;

type SessionBucket = {
  files: EmailAttachmentWithSize[];
  uploading: number;
  updatedAt: number;
};

type StoreGlobal = typeof globalThis & {
  __owocniMailAttachmentUploads?: Map<string, SessionBucket>;
};

function getMap(): Map<string, SessionBucket> {
  const g = globalThis as StoreGlobal;

  if (!g.__owocniMailAttachmentUploads) {
    g.__owocniMailAttachmentUploads = new Map<string, SessionBucket>();
  }

  return g.__owocniMailAttachmentUploads;
}

function getBucket(sessionId: string): SessionBucket {
  const map = getMap();
  const existing = map.get(sessionId);

  if (existing && Date.now() - existing.updatedAt <= ENTRY_TTL_MS) {
    return existing;
  }

  const fresh: SessionBucket = {
    files: [],
    uploading: 0,
    updatedAt: Date.now(),
  };
  map.set(sessionId, fresh);
  return fresh;
}

export function markAttachmentUploadStarted(sessionId: string): void {
  const bucket = getBucket(sessionId);
  bucket.uploading += 1;
  bucket.updatedAt = Date.now();
}

export function markAttachmentUploadFinished(sessionId: string): void {
  const bucket = getBucket(sessionId);
  bucket.uploading = Math.max(0, bucket.uploading - 1);
  bucket.updatedAt = Date.now();
}

export function pushAttachmentUpload(
  sessionId: string,
  file: EmailAttachmentWithSize,
): void {
  const bucket = getBucket(sessionId);

  if (!bucket.files.some((entry) => entry.id === file.id)) {
    bucket.files.push(file);
  }

  bucket.updatedAt = Date.now();
}

export function listAttachmentUploads(sessionId: string): {
  files: EmailAttachmentWithSize[];
  uploading: number;
} {
  const bucket = getBucket(sessionId);

  return {
    files: [...bucket.files],
    uploading: bucket.uploading,
  };
}

export function ackAttachmentUploads(
  sessionId: string,
  ids: string[],
): void {
  const bucket = getBucket(sessionId);
  const idSet = new Set(ids.filter(Boolean));

  if (idSet.size === 0) {
    return;
  }

  bucket.files = bucket.files.filter((file) => !idSet.has(file.id));
  bucket.updatedAt = Date.now();
}
