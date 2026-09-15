import type { CoreApiClient } from 'twenty-client-sdk/core';

import { SMS_SENDER } from 'src/utils/smsTemplates';

export type SmsTraceInput = {
  phone: string;
  message: string;
  status: 'wysłany' | 'błąd';
  detail: string;
  opportunityId?: string;
  personId?: string;
  smsId?: string;
};

function traceTitle(input: SmsTraceInput): string {
  return `SMS · ${input.status} · ${input.phone}`;
}

function traceBody(input: SmsTraceInput): string {
  const lines = [
    `Status: ${input.status}`,
    `Numer: ${input.phone}`,
    `Nadawca: ${SMS_SENDER}`,
    input.smsId ? `SMSAPI id: ${input.smsId}` : '',
    input.detail ? `Szczegóły: ${input.detail}` : '',
    '',
    input.message,
  ];
  return lines.filter((line, index) => line !== '' || index === 5).join('\n');
}

async function createNoteWithBody(
  coreClient: CoreApiClient,
  title: string,
  body: string,
): Promise<string | null> {
  try {
    const created = await coreClient.mutation({
      createNote: {
        __args: {
          data: {
            title,
            bodyV2: { markdown: body },
          },
        },
        id: true,
      },
    } as never);
    const id = (created as { createNote?: { id?: string } }).createNote?.id;
    if (id) {
      return id;
    }
  } catch {
    // bodyV2 shape varies across Twenty versions — title-only still leaves a trace.
  }

  try {
    const created = await coreClient.mutation({
      createNote: {
        __args: {
          data: { title: `${title}\n${body}`.slice(0, 1500) },
        },
        id: true,
      },
    });
    return created.createNote?.id ?? null;
  } catch {
    return null;
  }
}

async function attachNote(
  coreClient: CoreApiClient,
  noteId: string,
  input: SmsTraceInput,
): Promise<void> {
  const targets: Array<Record<string, string>> = [];
  if (input.opportunityId) {
    targets.push({ targetOpportunityId: input.opportunityId });
  }
  if (input.personId) {
    targets.push({ targetPersonId: input.personId });
  }

  for (const target of targets) {
    try {
      await coreClient.mutation({
        createNoteTarget: {
          __args: {
            data: {
              noteId,
              ...target,
            },
          },
          id: true,
        },
      } as never);
    } catch {
      // Note still exists even if the link fails.
    }
  }
}

export async function writeSmsTraceNote(
  coreClient: CoreApiClient,
  input: SmsTraceInput,
): Promise<string | null> {
  const noteId = await createNoteWithBody(
    coreClient,
    traceTitle(input),
    traceBody(input),
  );
  if (!noteId) {
    return null;
  }

  await attachNote(coreClient, noteId, input);
  return noteId;
}
