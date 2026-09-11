/** Chrome keepalive fetch quota is 64 KiB; stay under it when the page may unload. */
export const KEEPALIVE_BODY_LIMIT = 60_000;

export const SEND_TEMPLATE_PATH = '/s/mail/send-template';

export type ArmedSendPayload = {
  recordId?: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  htmlBodyBase64: string;
  templateId?: string;
  connectedAccountId?: string;
  inReplyToMessageId?: string;
  mode?: 'internal' | 'forward';
  opportunityId?: string;
  files: Array<{ id: string; name: string }>;
  accessToken: string;
  draftSessionId?: string;
  composeDraftKey?: string;
};

export function armedSendFields(payload: ArmedSendPayload) {
  return {
    recordId: payload.recordId,
    to: payload.to,
    ...(payload.cc ? { cc: payload.cc } : {}),
    ...(payload.bcc ? { bcc: payload.bcc } : {}),
    subject: payload.subject,
    templateId: payload.templateId,
    connectedAccountId: payload.connectedAccountId,
    inReplyToMessageId: payload.inReplyToMessageId,
    ...(payload.mode ? { mode: payload.mode } : {}),
    ...(payload.opportunityId ? { opportunityId: payload.opportunityId } : {}),
    files: payload.files,
    ...(payload.composeDraftKey
      ? { composeDraftKey: payload.composeDraftKey }
      : {}),
  };
}

/**
 * Full JSON for RestApiClient (page still alive).
 * Unmount keepalive uses {@link buildUnmountSendBody} so Chrome does not drop it.
 */
export function armedSendJson(payload: ArmedSendPayload): string {
  return JSON.stringify({
    ...armedSendFields(payload),
    htmlBodyBase64: payload.htmlBodyBase64,
    draftSessionId: payload.draftSessionId,
  });
}

/**
 * Keepalive body: full payload when small; otherwise metadata + draftSessionId
 * (HTML already saved to /mail/editor-draft while the panel was open).
 */
export function buildUnmountSendBody(payload: ArmedSendPayload): string {
  const full = armedSendJson(payload);

  if (full.length <= KEEPALIVE_BODY_LIMIT) {
    return full;
  }

  return JSON.stringify({
    ...armedSendFields(payload),
    draftSessionId: payload.draftSessionId,
  });
}

/**
 * Start the send while the record page is still open (CORS preflight can finish).
 * Keepalive then lets the delayed server send survive navigation to the lead list.
 * HTML is omitted when it would exceed the keepalive quota — draftSessionId holds it.
 */
export function buildDelayedSendBody(
  payload: ArmedSendPayload,
  delayMs: number,
): string {
  const base = {
    ...armedSendFields(payload),
    draftSessionId: payload.draftSessionId,
    jobId: payload.draftSessionId,
    delayMs,
  };
  const withHtml = JSON.stringify({
    ...base,
    htmlBodyBase64: payload.htmlBodyBase64,
  });

  if (withHtml.length <= KEEPALIVE_BODY_LIMIT) {
    return withHtml;
  }

  return JSON.stringify(base);
}
