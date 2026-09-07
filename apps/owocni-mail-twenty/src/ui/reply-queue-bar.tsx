import { RestApiClient, RestApiClientError } from 'twenty-client-sdk/rest';
import { useEffect, useState } from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import {
  datetimeLocalToIso,
  defaultSnoozeLocalValue,
  isFutureSnooze,
  replyQueueStatus,
  toDatetimeLocalValue,
  type OpportunityActionStatus,
} from 'src/utils/opportunityActions';
import { OPPORTUNITY_ACTIONS_PATH } from 'src/ui/opportunity-actions';

type ActionResponse = OpportunityActionStatus & {
  ok?: boolean;
  error?: string;
};

type ReplyQueueBarProps = {
  recordId: string | null;
};

function readError(error: unknown): string {
  if (error instanceof RestApiClientError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Nie udało się zapisać odroczenia';
}

async function loadQueue(recordId: string): Promise<OpportunityActionStatus> {
  const client = new RestApiClient();
  const data = await client.get<ActionResponse>(OPPORTUNITY_ACTIONS_PATH, {
    query: { recordId },
  });
  if (!data?.ok) {
    throw new Error(data?.error || 'Nie udało się wczytać kolejki');
  }
  return {
    recordId,
    bizSqlConfirmed: Boolean(data.bizSqlConfirmed),
    bizSqlConfirmedAt: data.bizSqlConfirmedAt ?? null,
    campaignRejected: Boolean(data.campaignRejected),
    rejectionReason: data.rejectionReason ?? null,
    isFollowUp: Boolean(data.isFollowUp),
    snoozeUntil: data.snoozeUntil ?? null,
  };
}

async function saveSnooze(
  recordId: string,
  snoozeUntil: string,
): Promise<OpportunityActionStatus> {
  const client = new RestApiClient();
  const data = await client.post<ActionResponse>(OPPORTUNITY_ACTIONS_PATH, {
    recordId,
    action: 'snooze',
    snoozeUntil,
  });
  if (!data?.ok) {
    throw new Error(data?.error || 'Nie udało się odroczyć');
  }
  return {
    recordId,
    bizSqlConfirmed: Boolean(data.bizSqlConfirmed),
    bizSqlConfirmedAt: data.bizSqlConfirmedAt ?? null,
    campaignRejected: Boolean(data.campaignRejected),
    rejectionReason: data.rejectionReason ?? null,
    isFollowUp: Boolean(data.isFollowUp),
    snoozeUntil: data.snoozeUntil ?? snoozeUntil,
  };
}

export const ReplyQueueBar = ({ recordId }: ReplyQueueBarProps) => {
  const [status, setStatus] = useState<OpportunityActionStatus | null>(null);
  const [untilLocal, setUntilLocal] = useState(defaultSnoozeLocalValue);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!recordId) {
      setStatus(null);
      return;
    }

    let cancelled = false;
    void loadQueue(recordId)
      .then((next) => {
        if (cancelled) {
          return;
        }
        setStatus(next);
        if (next.snoozeUntil && isFutureSnooze(next.snoozeUntil)) {
          setUntilLocal(toDatetimeLocalValue(new Date(next.snoozeUntil)));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [recordId]);

  if (!recordId) {
    return null;
  }

  const queue = replyQueueStatus({
    isFollowUp: status?.isFollowUp ?? false,
    snoozeUntil: status?.snoozeUntil ?? null,
  });
  const chipBackground = queue.tone === 'red' ? '#fee2e2' : '#dbeafe';
  const chipColor = queue.tone === 'red' ? '#991b1b' : '#1e40af';

  const onSnooze = async () => {
    const iso = datetimeLocalToIso(untilLocal);
    if (!iso || !isFutureSnooze(iso)) {
      await enqueueSnackbar({
        message: 'Wybierz datę i godzinę w przyszłości',
        variant: 'warning',
      });
      return;
    }

    setBusy(true);
    try {
      const next = await saveSnooze(recordId, iso);
      setStatus(next);
      await enqueueSnackbar({
        message: `Odroczone do ${replyQueueStatus({
          isFollowUp: next.isFollowUp,
          snoozeUntil: next.snoozeUntil,
        }).untilLabel ?? untilLocal.replace('T', ' ')}`,
        variant: 'success',
      });
    } catch (error) {
      await enqueueSnackbar({
        message: readError(error),
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: '1px solid #eee',
        background: '#fafafa',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          padding: '4px 10px',
          borderRadius: 999,
          background: chipBackground,
          color: chipColor,
        }}
      >
        {queue.label}
        {queue.untilLabel ? ` · do ${queue.untilLabel}` : ''}
      </span>
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: '#444',
        }}
      >
        Odroczenie do
        <input
          type="datetime-local"
          value={untilLocal}
          onChange={(event) => setUntilLocal(event.target.value)}
          disabled={busy}
          style={{
            fontSize: 12,
            padding: '4px 8px',
            border: '1px solid #ddd',
            borderRadius: 6,
          }}
        />
      </label>
      <button
        type="button"
        onClick={() => {
          void onSnooze();
        }}
        disabled={busy}
        style={{
          fontSize: 12,
          padding: '5px 12px',
          border: '1px solid #93c5fd',
          borderRadius: 6,
          background: '#eff6ff',
          color: '#1e40af',
          fontWeight: 600,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? 'Zapis…' : 'Odroczenie'}
      </button>
    </div>
  );
};
