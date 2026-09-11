import { RestApiClient, RestApiClientError } from 'twenty-client-sdk/rest';
import { useEffect, useState, type CSSProperties } from 'react';
import {
  CommandModal,
  enqueueSnackbar,
  openCommandConfirmationModal,
  unmountFrontComponent,
  useColorScheme,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';

import {
  REJECTION_REASONS,
  mergeOpportunityActionStatus,
  rejectedChipLabel,
  sqlConfirmedChipLabel,
  type OpportunityActionStatus,
  type RejectionReason,
} from 'src/utils/opportunityActions';

export const OPPORTUNITY_ACTIONS_PATH = '/s/mail/opportunity-actions';

type InvoiceKind = 'proforma' | 'vat';

type ActionResponse = OpportunityActionStatus & {
  ok?: boolean;
  error?: string;
  alreadyDone?: boolean;
  invoiceNumber?: string;
  invoiceUrl?: string;
};

function readError(error: unknown): string {
  if (error instanceof RestApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Nie udało się zapisać';
}

async function loadStatus(recordId: string): Promise<OpportunityActionStatus> {
  const client = new RestApiClient();
  const data = await client.get<ActionResponse>(OPPORTUNITY_ACTIONS_PATH, {
    query: { recordId },
  });

  if (!data?.ok) {
    throw new Error(data?.error || 'Nie udało się wczytać statusu');
  }

  return mergeOpportunityActionStatus(recordId, data);
}

async function runAction(
  recordId: string,
  action: 'sql' | 'reject' | 'enrich' | 'issue',
  extra?: { rejectionReason?: RejectionReason; kind?: InvoiceKind },
): Promise<ActionResponse> {
  const client = new RestApiClient();
  const data = await client.post<ActionResponse>(OPPORTUNITY_ACTIONS_PATH, {
    recordId,
    action,
    ...(extra?.rejectionReason ? { rejectionReason: extra.rejectionReason } : {}),
    ...(extra?.kind ? { kind: extra.kind } : {}),
  });

  if (!data?.ok) {
    throw new Error(data?.error || 'Nie udało się zapisać');
  }

  return { ...mergeOpportunityActionStatus(recordId, data), ...data };
}

const chipStyle = (dark: boolean, disabled: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 32,
  padding: '0 12px',
  borderRadius: 8,
  border: disabled
    ? `1px solid ${dark ? '#3f3f46' : '#e4e4e7'}`
    : '1px solid transparent',
  background: disabled ? (dark ? '#27272a' : '#f4f4f5') : '#4f46e5',
  color: disabled ? (dark ? '#a1a1aa' : '#52525b') : '#fff',
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.2,
  cursor: disabled ? 'default' : 'pointer',
  fontFamily: 'Inter, system-ui, sans-serif',
});

const dangerStyle = (dark: boolean, disabled: boolean): CSSProperties => ({
  ...chipStyle(dark, disabled),
  background: disabled ? (dark ? '#27272a' : '#f4f4f5') : '#b91c1c',
});

export const AcceptSqlCommand = () => {
  const recordId = useSelectedRecordIds()[0] ?? null;

  return (
    <CommandModal
      title="Przyjmij jako SQL"
      subtitle="Lead zostanie oznaczony jako SQL (reklamy + statystyki). Na WON/LOST etap kanbanu się nie zmieni."
      confirmButtonText="Przyjmij SQL"
      execute={async () => {
        if (!recordId) {
          await enqueueSnackbar({
            message: 'Brak leada na karcie',
            variant: 'error',
          });
          return;
        }

        try {
          const result = await runAction(recordId, 'sql');
          await enqueueSnackbar({
            message: sqlConfirmedChipLabel(result.bizSqlConfirmedAt),
            variant: 'success',
          });
        } catch (error) {
          await enqueueSnackbar({
            message: readError(error),
            variant: 'error',
          });
        } finally {
          await unmountFrontComponent();
        }
      }}
    />
  );
};

export const RejectLeadForm = () => {
  const dark = useColorScheme() === 'dark';
  const recordId = useSelectedRecordIds()[0] ?? null;
  const [reason, setReason] = useState<RejectionReason>('BUDGET');
  const [busy, setBusy] = useState(false);

  const onReject = async () => {
    if (!recordId || busy) {
      return;
    }

    const confirmed = await openCommandConfirmationModal({
      title: 'Odrzuć leada',
      subtitle:
        'Etap kanbanu się nie zmieni. Wyślemy rejected_lead do reklam (takich leadów nie szukamy).',
      confirmButtonText: 'Odrzuć',
      confirmButtonAccent: 'danger',
    });
    if (confirmed !== 'confirm') {
      return;
    }

    setBusy(true);
    try {
      const result = await runAction(recordId, 'reject', {
        rejectionReason: reason,
      });
      await enqueueSnackbar({
        message: rejectedChipLabel(result.rejectionReason),
        variant: 'success',
      });
      await unmountFrontComponent();
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
        padding: 16,
        fontFamily: 'Inter, system-ui, sans-serif',
        color: dark ? '#fafafa' : '#18181b',
      }}
    >
      <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>
        Odrzuć leada
      </h2>
      <p
        style={{
          margin: '0 0 14px',
          fontSize: 13,
          lineHeight: 1.5,
          color: dark ? '#a1a1aa' : '#52525b',
        }}
      >
        To nie jest przegrana (LOST). Oznaczamy leada, żeby reklamy takich
        więcej nie szukały. Etap karty zostaje.
      </p>
      <label
        style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}
      >
        Powód
      </label>
      <select
        value={reason}
        onChange={(event) => setReason(event.target.value as RejectionReason)}
        style={{
          width: '100%',
          marginBottom: 14,
          height: 36,
          borderRadius: 8,
          border: `1px solid ${dark ? '#3f3f46' : '#d4d4d8'}`,
          background: dark ? '#18181b' : '#fff',
          color: 'inherit',
          padding: '0 10px',
        }}
      >
        {REJECTION_REASONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!recordId || busy}
        onClick={() => void onReject()}
        style={dangerStyle(dark, !recordId || busy)}
      >
        {busy ? 'Zapis…' : 'Odrzuć leada'}
      </button>
    </div>
  );
};

export const OpportunityActionsStrip = () => {
  const dark = useColorScheme() === 'dark';
  const recordId = useSelectedRecordIds()[0] ?? null;
  const [status, setStatus] = useState<OpportunityActionStatus | null>(null);
  const [busy, setBusy] = useState<'sql' | 'reject' | 'enrich' | 'issue' | null>(
    null,
  );
  const [reason, setReason] = useState<RejectionReason>('BUDGET');
  const [kind, setKind] = useState<InvoiceKind>('proforma');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recordId) {
      setStatus(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const next = await loadStatus(recordId);
        if (!cancelled) {
          setStatus(next);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(readError(caught));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [recordId]);

  const onSql = async () => {
    if (!recordId || busy || status?.bizSqlConfirmed) {
      return;
    }

    const confirmed = await openCommandConfirmationModal({
      title: 'Przyjmij jako SQL',
      subtitle:
        'Lead zostanie oznaczony jako SQL (reklamy + statystyki). Na WON/LOST etap kanbanu się nie zmieni.',
      confirmButtonText: 'Przyjmij SQL',
    });
    if (confirmed !== 'confirm') {
      return;
    }

    setBusy('sql');
    try {
      const next = await runAction(recordId, 'sql');
      setStatus(next);
      await enqueueSnackbar({
        message: sqlConfirmedChipLabel(next.bizSqlConfirmedAt),
        variant: 'success',
      });
    } catch (caught) {
      setError(readError(caught));
    } finally {
      setBusy(null);
    }
  };

  const onReject = async () => {
    if (!recordId || busy || status?.campaignRejected) {
      return;
    }

    const confirmed = await openCommandConfirmationModal({
      title: 'Odrzuć leada',
      subtitle:
        'Etap kanbanu się nie zmieni. Wyślemy rejected_lead do reklam (takich leadów nie szukamy).',
      confirmButtonText: 'Odrzuć',
      confirmButtonAccent: 'danger',
    });
    if (confirmed !== 'confirm') {
      return;
    }

    setBusy('reject');
    try {
      const next = await runAction(recordId, 'reject', {
        rejectionReason: reason,
      });
      setStatus(next);
      await enqueueSnackbar({
        message: rejectedChipLabel(next.rejectionReason),
        variant: 'success',
      });
    } catch (caught) {
      setError(readError(caught));
    } finally {
      setBusy(null);
    }
  };

  const onEnrich = async () => {
    if (!recordId || busy || !status?.hasNip) {
      return;
    }

    setBusy('enrich');
    try {
      const next = await runAction(recordId, 'enrich');
      setStatus(next);
      setError(null);
      await enqueueSnackbar({
        message: next.invoiceReady
          ? 'Dane firmy uzupełnione — można wystawić dokument'
          : 'Dane dociągnięte. Sprawdź NIP / adres na Firmie.',
        variant: 'success',
      });
    } catch (caught) {
      setError(readError(caught));
    } finally {
      setBusy(null);
    }
  };

  const onIssue = async () => {
    if (!recordId || busy || !status?.invoiceReady) {
      return;
    }

    const kindLabel = kind === 'vat' ? 'Fakturę VAT' : 'Proformę';
    const confirmed = await openCommandConfirmationModal({
      title: `Wystaw ${kindLabel.toLowerCase()}`,
      subtitle:
        kind === 'vat'
          ? 'Dokument powstanie w Fakturowni. KSeF DEMO — nie idzie do urzędu. Wysyłka dopiero po zatwierdzeniu w Fakturowni.'
          : 'Proforma w Fakturowni, bez KSeF. Po opłaceniu konwersja do VAT w Fakturowni.',
      confirmButtonText: `Wystaw ${kindLabel.toLowerCase()}`,
    });
    if (confirmed !== 'confirm') {
      return;
    }

    setBusy('issue');
    try {
      const next = await runAction(recordId, 'issue', { kind });
      setStatus(next);
      setError(null);
      const number = next.invoiceNumber || 'dokument';
      await enqueueSnackbar({
        message: next.invoiceUrl
          ? `Wystawiono ${number} — otwórz w Fakturowni z notatki na karcie`
          : `Wystawiono ${number}`,
        variant: 'success',
      });
    } catch (caught) {
      setError(readError(caught));
    } finally {
      setBusy(null);
    }
  };

  if (!recordId) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '4px 0 12px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {status?.bizSqlConfirmed ? (
          <span style={chipStyle(dark, true)} title="SQL jest już przyjęty">
            {sqlConfirmedChipLabel(status.bizSqlConfirmedAt)}
          </span>
        ) : (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void onSql()}
            style={chipStyle(dark, busy !== null)}
          >
            {busy === 'sql' ? 'Zapis…' : 'Przyjmij jako SQL'}
          </button>
        )}

        {status?.campaignRejected ? (
          <span
            style={dangerStyle(dark, true)}
            title="Brak osobnego pola z datą odrzucenia — jest powód"
          >
            {rejectedChipLabel(status.rejectionReason)}
          </span>
        ) : (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select
              value={reason}
              onChange={(event) =>
                setReason(event.target.value as RejectionReason)
              }
              disabled={busy !== null}
              style={{
                height: 32,
                borderRadius: 8,
                border: `1px solid ${dark ? '#3f3f46' : '#d4d4d8'}`,
                background: dark ? '#18181b' : '#fff',
                color: dark ? '#fafafa' : '#18181b',
                padding: '0 8px',
                fontSize: 12,
              }}
            >
              {REJECTION_REASONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void onReject()}
              style={dangerStyle(dark, busy !== null)}
            >
              {busy === 'reject' ? 'Zapis…' : 'Odrzuć leada'}
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          disabled={busy !== null || !status?.hasNip}
          onClick={() => void onEnrich()}
          title={
            status?.enrichHint ||
            (status?.invoiceReady
              ? 'Ponownie dociąga GUS / KRS / MF na Firmę'
              : 'Dociąga GUS / KRS / MF na Firmę')
          }
          style={chipStyle(dark, busy !== null || !status?.hasNip)}
        >
          {busy === 'enrich'
            ? 'Dociągam…'
            : status?.enrichLabel || 'Uzupełnij dane (GUS/KRS)'}
        </button>
        {status?.enrichHint ? (
          <span
            style={{
              fontSize: 12,
              color: dark ? '#a1a1aa' : '#71717a',
            }}
          >
            {status.enrichHint}
          </span>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as InvoiceKind)}
          disabled={busy !== null || !status?.invoiceReady}
          style={{
            height: 32,
            borderRadius: 8,
            border: `1px solid ${dark ? '#3f3f46' : '#d4d4d8'}`,
            background: dark ? '#18181b' : '#fff',
            color: dark ? '#fafafa' : '#18181b',
            padding: '0 8px',
            fontSize: 12,
          }}
        >
          <option value="proforma">Proforma</option>
          <option value="vat">Faktura VAT</option>
        </select>
        <button
          type="button"
          disabled={busy !== null || !status?.invoiceReady}
          onClick={() => void onIssue()}
          title={status?.issueHint || 'Tworzy dokument w Fakturowni'}
          style={chipStyle(dark, busy !== null || !status?.invoiceReady)}
        >
          {busy === 'issue' ? 'Wystawiam…' : 'Wystaw dokument'}
        </button>
        {status?.issueHint ? (
          <span
            style={{
              fontSize: 12,
              color: dark ? '#a1a1aa' : '#71717a',
            }}
          >
            {status.issueHint}
          </span>
        ) : null}
      </div>
      {error ? (
        <div style={{ fontSize: 12, color: '#b91c1c' }}>{error}</div>
      ) : null}
    </div>
  );
};
