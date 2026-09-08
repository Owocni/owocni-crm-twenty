export const MAX_SEND_DELAY_MS = 20_000;
export const SEND_JOB_DRAFT_PREFIX = 'job:';

export function sendJobDraftKey(jobId: string): string {
  return `${SEND_JOB_DRAFT_PREFIX}${jobId}`;
}

export function clampDelayMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(Math.floor(value), MAX_SEND_DELAY_MS);
}

export function isSendJobTerminal(status: string | null | undefined): boolean {
  const value = status?.trim();
  return value === 'cancelled' || value === 'sent';
}

export async function waitUnlessCancelled(args: {
  delayMs: number;
  isCancelled: () => Promise<boolean>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<'cancelled' | 'ready'> {
  const now = args.now ?? Date.now;
  const sleep =
    args.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const deadline = now() + args.delayMs;

  while (now() < deadline) {
    if (await args.isCancelled()) {
      return 'cancelled';
    }

    const remaining = deadline - now();
    await sleep(Math.min(250, Math.max(0, remaining)));
  }

  if (await args.isCancelled()) {
    return 'cancelled';
  }

  return 'ready';
}
