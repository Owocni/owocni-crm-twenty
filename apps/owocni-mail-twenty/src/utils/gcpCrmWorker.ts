const WORKER_URL = (
  process.env.GCP_CRM_WORKER_URL ||
  'https://twenty-crm-worker-sandbox-hsxlhvflrq-lm.a.run.app'
).replace(/\/$/, '');

const ENRICH_TOKEN_PLACEHOLDER = '__ENRICH_COMPANY_PL_TOKEN__';
const INVOICE_TOKEN_PLACEHOLDER = '__X_INVOICE_TOKEN__';

function readSecret(envKey: string, placeholder: string): string {
  const fromEnv = String(process.env[envKey] || '').trim();
  if (fromEnv && !fromEnv.startsWith('__')) {
    return fromEnv;
  }
  if (placeholder.startsWith('__')) {
    return '';
  }
  return placeholder;
}

function enrichToken(): string {
  return readSecret('ENRICH_COMPANY_PL_TOKEN', ENRICH_TOKEN_PLACEHOLDER);
}

function invoiceToken(): string {
  return readSecret('X_INVOICE_TOKEN', INVOICE_TOKEN_PLACEHOLDER);
}

type WorkerResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  missing?: string[];
  number?: string;
  url?: string;
  viewUrl?: string;
  fakturaId?: string;
  fakturowniaId?: string | number;
  kind?: string;
  results?: Array<{
    ok?: boolean;
    error?: string;
    fields?: string[];
    notes?: string[];
    companyId?: string;
  }>;
};

async function postWorker(
  body: Record<string, unknown>,
  headers: Record<string, string>,
): Promise<{ status: number; data: WorkerResponse }> {
  const response = await fetch(`${WORKER_URL}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data: WorkerResponse = {};
  try {
    data = text ? (JSON.parse(text) as WorkerResponse) : {};
  } catch {
    data = { ok: false, error: text.slice(0, 400) || `HTTP ${response.status}` };
  }
  return { status: response.status, data };
}

export async function callEnrichCompany(params: {
  opportunityId: string;
  companyId?: string | null;
  nip?: string | null;
}): Promise<{ ok: boolean; error?: string; fields?: string[]; companyId?: string }> {
  const token = enrichToken();
  if (!token) {
    return { ok: false, error: 'Brak tokenu enrichmentu — zgłoś Dawidowi' };
  }

  const { status, data } = await postWorker(
    {
      action: 'enrich_company_pl',
      mode: 'single',
      records: [
        {
          opportunityId: params.opportunityId,
          ...(params.companyId ? { companyId: params.companyId } : {}),
          ...(params.nip ? { nip: params.nip } : {}),
        },
      ],
    },
    { 'X-Enrich-Token': token },
  );

  const first = data.results?.[0];
  if (status >= 400 || data.ok === false || first?.ok === false) {
    const skipped = (first as { skipped?: string } | undefined)?.skipped;
    const skippedMessage =
      skipped === 'no_identifier'
        ? 'uzupełnij NIP'
        : skipped === 'bad_nip'
          ? 'NIP nie przechodzi sumy kontrolnej'
          : skipped === 'nip_unique_conflict'
            ? 'Ten NIP jest już na innej firmie — sprawdź notatkę na karcie'
            : null;
    return {
      ok: false,
      error:
        skippedMessage ||
        first?.error ||
        data.error ||
        data.message ||
        `HTTP ${status}`,
    };
  }

  return { ok: true, fields: first?.fields, companyId: first?.companyId };
}

export async function callIssueInvoice(params: {
  opportunityId: string;
  companyId: string;
  kind: 'proforma' | 'vat';
  issuedBy?: string | null;
}): Promise<{
  ok: boolean;
  error?: string;
  number?: string;
  url?: string;
  fakturaId?: string;
}> {
  const token = invoiceToken();
  if (!token) {
    return { ok: false, error: 'Brak tokenu faktur — zgłoś Dawidowi' };
  }

  const { status, data } = await postWorker(
    {
      action: 'issue_invoice',
      opportunityId: params.opportunityId,
      companyId: params.companyId,
      kind: params.kind,
      issuedBy: params.issuedBy || undefined,
    },
    { 'X-Invoice-Token': token },
  );

  if ((status >= 400 && status !== 207) || data.ok === false) {
    const missing = Array.isArray(data.missing) ? data.missing.join(', ') : '';
    return {
      ok: false,
      error:
        data.message ||
        data.error ||
        (missing ? `Brakuje pól: ${missing}` : `HTTP ${status}`),
    };
  }

  return {
    ok: true,
    number: data.number,
    url: data.url || data.viewUrl,
    fakturaId: data.fakturaId,
  };
}
