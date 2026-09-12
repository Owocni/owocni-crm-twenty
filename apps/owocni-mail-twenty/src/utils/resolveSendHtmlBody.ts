import {
  payloadHasClientBody,
  readClientHtmlBody,
  readStringField,
} from 'src/utils/parseRouteBody';
import { isComposerV2Payload } from 'src/utils/composerV2Flag';

export async function resolveSendHtmlBody(
  payload: Record<string, unknown>,
  loadDraft?: (sessionId: string) => Promise<string | null>,
): Promise<{ html: string; clientSent: boolean }> {
  const customBody = readClientHtmlBody(payload);

  if (customBody) {
    return { html: customBody, clientSent: true };
  }

  if (isComposerV2Payload(payload)) {
    return { html: '', clientSent: payloadHasClientBody(payload) };
  }

  const draftSessionId = readStringField(payload, 'draftSessionId');

  if (draftSessionId && loadDraft) {
    const fromDraft = (await loadDraft(draftSessionId))?.trim() ?? '';

    if (fromDraft) {
      return { html: fromDraft, clientSent: true };
    }
  }

  return { html: '', clientSent: payloadHasClientBody(payload) };
}
