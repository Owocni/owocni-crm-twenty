export const STAPE_INBOUND_URL =
  'https://uinpcbwf.eug.stape.io/inbound/twenty_webhook';

export const REJECTION_REASONS = [
  { value: 'BUDGET', label: 'Budget' },
  { value: 'NOT_TARGET', label: 'Not target' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'DUPLICATE', label: 'Duplicate' },
  { value: 'OTHER', label: 'Other' },
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number]['value'];

const TERMINAL_STAGES = new Set(['WON', 'LOST']);

export function isTerminalOpportunityStage(stage: string | null | undefined): boolean {
  return TERMINAL_STAGES.has(String(stage || '').toUpperCase());
}

export type OpportunityActionStatus = {
  recordId: string;
  bizSqlConfirmed: boolean;
  bizSqlConfirmedAt: string | null;
  campaignRejected: boolean;
  rejectionReason: string | null;
  isFollowUp: boolean;
  snoozeUntil: string | null;
};

export type ReplyQueueKind = 'needs_reply' | 'snoozed' | 'waiting';

export type ReplyQueueStatus = {
  kind: ReplyQueueKind;
  label: string;
  tone: 'red' | 'blue';
  untilLabel: string | null;
};

export function toDatetimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function defaultSnoozeLocalValue(now = new Date()): string {
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return toDatetimeLocalValue(next);
}

export function datetimeLocalToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

export function isFutureSnooze(iso: string, now = new Date()): boolean {
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) && parsed > now.getTime();
}

export function replyQueueStatus(params: {
  isFollowUp: boolean;
  snoozeUntil: string | null;
  now?: Date;
}): ReplyQueueStatus {
  const now = params.now ?? new Date();
  const snoozeMs = params.snoozeUntil ? Date.parse(params.snoozeUntil) : NaN;
  const snoozeActive =
    Number.isFinite(snoozeMs) && snoozeMs > now.getTime() && !params.isFollowUp;

  if (params.isFollowUp || (Number.isFinite(snoozeMs) && snoozeMs <= now.getTime())) {
    return {
      kind: 'needs_reply',
      label: 'Do odpisania',
      tone: 'red',
      untilLabel: null,
    };
  }

  if (snoozeActive && params.snoozeUntil) {
    return {
      kind: 'snoozed',
      label: 'Odroczone',
      tone: 'blue',
      untilLabel: formatPolishDateTime(params.snoozeUntil),
    };
  }

  return {
    kind: 'waiting',
    label: 'Czekamy na odpowiedź',
    tone: 'blue',
    untilLabel: null,
  };
}

export type SqlComputeInput = {
  createdAt: string;
  qualifiedAt?: string | null;
  currentStage: string;
  now?: Date;
};

export function isTruthyFlag(value: unknown): boolean {
  return value === true;
}

export function isRejectionReason(value: string): value is RejectionReason {
  return REJECTION_REASONS.some((option) => option.value === value);
}

export function rejectionReasonLabel(value: string | null | undefined): string {
  if (!value) {
    return 'odrzucony';
  }

  return (
    REJECTION_REASONS.find((option) => option.value === value)?.label ?? value
  );
}

export function formatPolishDateTime(iso: string | null | undefined): string | null {
  if (!iso) {
    return null;
  }

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString('pl-PL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function sqlConfirmedChipLabel(iso: string | null | undefined): string {
  const formatted = formatPolishDateTime(iso);
  return formatted ? `SQL przyjęty · ${formatted}` : 'SQL przyjęty';
}

export function rejectedChipLabel(reason: string | null | undefined): string {
  return `Odrzucony · ${rejectionReasonLabel(reason)}`;
}

/** Same metrics as workflow „Przyjmij jako SQL” v5. */
export function computeSqlFields(params: SqlComputeInput) {
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();
  const created = new Date(params.createdAt);
  const hours =
    Math.round(((now.getTime() - created.getTime()) / 3_600_000) * 100) / 100;
  const keepStage = TERMINAL_STAGES.has(params.currentStage);
  const qualifiedAt = params.qualifiedAt || nowIso;
  const hoursToQualified = params.qualifiedAt
    ? Math.round(
        ((new Date(qualifiedAt).getTime() - created.getTime()) / 3_600_000) *
          100,
      ) / 100
    : hours;

  return {
    stage: keepStage ? params.currentStage : 'QUALIFIED',
    qualifiedAt,
    hoursToQualified,
    bizSqlConfirmedAt: nowIso,
    bizSqlConfirmed: true,
  };
}
