import type { CoreApiClient } from 'twenty-client-sdk/core';

import { normalizeSmsPhone } from 'src/utils/smsPhone';
import { readSmsapiToken, sendSmsViaSmsapi } from 'src/utils/smsapiSend';
import { writeSmsTraceNote } from 'src/utils/smsTraceNote';

export type ComposerSmsRequest = {
  enabled: boolean;
  phone: string;
  message: string;
  opportunityId?: string;
  personId?: string;
};

export type ComposerSmsOutcome = {
  attempted: boolean;
  ok: boolean;
  error?: string;
  phone?: string;
  smsId?: string;
  noteId?: string | null;
};

export async function sendComposerSms(input: {
  coreClient: CoreApiClient;
  request: ComposerSmsRequest;
}): Promise<ComposerSmsOutcome> {
  if (!input.request.enabled) {
    return { attempted: false, ok: true };
  }

  const message = input.request.message.trim();
  const phone = normalizeSmsPhone(input.request.phone);

  if (!message) {
    const error = 'Pusta treść SMS.';
    const noteId = await writeSmsTraceNote(input.coreClient, {
      phone: input.request.phone.trim() || '(brak)',
      message: '',
      status: 'błąd',
      detail: error,
      opportunityId: input.request.opportunityId,
      personId: input.request.personId,
    });
    return { attempted: true, ok: false, error, noteId };
  }

  if (!phone.ok) {
    const noteId = await writeSmsTraceNote(input.coreClient, {
      phone: input.request.phone.trim() || '(brak)',
      message,
      status: 'błąd',
      detail: phone.error,
      opportunityId: input.request.opportunityId,
      personId: input.request.personId,
    });
    return { attempted: true, ok: false, error: phone.error, noteId };
  }

  const sent = await sendSmsViaSmsapi({
    token: readSmsapiToken(),
    apiTo: phone.apiTo,
    message,
  });

  const noteId = await writeSmsTraceNote(input.coreClient, {
    phone: phone.e164,
    message,
    status: sent.ok ? 'wysłany' : 'błąd',
    detail: sent.ok ? 'Przyjęty przez SMSAPI.' : sent.error,
    opportunityId: input.request.opportunityId,
    personId: input.request.personId,
    smsId: sent.ok ? sent.id : undefined,
  });

  if (!sent.ok) {
    return {
      attempted: true,
      ok: false,
      error: sent.error,
      phone: phone.e164,
      noteId,
    };
  }

  return {
    attempted: true,
    ok: true,
    phone: phone.e164,
    smsId: sent.id,
    noteId,
  };
}
