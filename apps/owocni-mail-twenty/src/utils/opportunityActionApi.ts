import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';

import { isTruthyFlag } from 'src/utils/opportunityActions';

export type OpportunityActionRecord = {
  id: string;
  name: string | null;
  stage: string;
  createdAt: string;
  updatedAt: string | null;
  qualifiedAt: string | null;
  bizSqlConfirmed: boolean;
  bizSqlConfirmedAt: string | null;
  campaignRejected: boolean;
  rejectionReason: string | null;
  idOid: string | null;
  bizProduct: string | null;
  pointOfContactId: string | null;
  companyId: string | null;
  isFollowUp: boolean;
  snoozeUntil: string | null;
  nip: string | null;
};

export type InvoiceCompanyRecord = {
  id: string;
  name: string | null;
  nip: string | null;
  legalName: string | null;
  registeredAddress: {
    addressStreet1?: string | null;
    addressCity?: string | null;
    addressPostcode?: string | null;
  } | null;
  enrichedAt: string | null;
};

type OpportunityQueryRow = {
  id?: string;
  name?: string | null;
  stage?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  qualifiedAt?: string | null;
  bizSqlConfirmed?: boolean | null;
  bizSqlConfirmedAt?: string | null;
  campaignRejected?: boolean | null;
  rejectionReason?: string | null;
  idOid?: string | null;
  bizProduct?: string | null;
  pointOfContactId?: string | null;
  companyId?: string | null;
  isFollowUp?: boolean | null;
  snoozeUntil?: string | null;
  nip?: string | null;
};

type CompanyQueryRow = {
  id?: string;
  name?: string | null;
  nip?: string | null;
  legalName?: string | null;
  registeredAddress?: InvoiceCompanyRecord['registeredAddress'];
  enrichedAt?: string | null;
};

const OPPORTUNITY_ACTION_FIELDS = {
  id: true,
  name: true,
  stage: true,
  createdAt: true,
  updatedAt: true,
  pointOfContactId: true,
  ...({
    qualifiedAt: true,
    bizSqlConfirmed: true,
    bizSqlConfirmedAt: true,
    campaignRejected: true,
    rejectionReason: true,
    idOid: true,
    bizProduct: true,
    companyId: true,
    isFollowUp: true,
    snoozeUntil: true,
    nip: true,
  } as Record<string, unknown>),
};

const COMPANY_INVOICE_QUERY = `
query CompanyForInvoice($id: UUID!) {
  company(filter: { id: { eq: $id } }) {
    id
    name
    nip
    legalName
    registeredAddress {
      addressStreet1
      addressStreet2
      addressCity
      addressPostcode
      addressCountry
    }
    enrichedAt
  }
}
`;

type CoreGraphqlClient = {
  executeGraphqlRequestWithOptionalRefresh: (args: {
    operation: { query: string; variables?: Record<string, unknown> };
  }) => Promise<{
    data?: Record<string, unknown>;
    errors?: Array<{ message?: string }>;
  }>;
};

async function coreGraphql<T>(
  coreClient: CoreApiClient,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T | null> {
  const client = coreClient as unknown as CoreGraphqlClient;
  if (typeof client.executeGraphqlRequestWithOptionalRefresh === 'function') {
    const payload = await client.executeGraphqlRequestWithOptionalRefresh({
      operation: { query, variables },
    });
    if (payload?.errors?.length) {
      throw new Error(
        payload.errors.map((error) => error.message).filter(Boolean).join('; '),
      );
    }
    return (payload?.data as T) ?? null;
  }

  const url = `${String(process.env.TWENTY_API_URL || '').replace(/\/$/, '')}/graphql`;
  const token =
    process.env.TWENTY_APP_ACCESS_TOKEN || process.env.TWENTY_API_KEY || '';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };
  if (payload?.errors?.length) {
    throw new Error(
      payload.errors.map((error) => error.message).filter(Boolean).join('; '),
    );
  }
  return payload?.data ?? null;
}

export async function findCompanyForInvoice(
  coreClient: CoreApiClient,
  companyId: string,
): Promise<InvoiceCompanyRecord | null> {
  try {
    const data = await coreGraphql<{ company?: CompanyQueryRow | null }>(
      coreClient,
      COMPANY_INVOICE_QUERY,
      { id: companyId },
    );
    return toCompany(data?.company);
  } catch {
    return null;
  }
}

function toRecord(row: OpportunityQueryRow | null | undefined): OpportunityActionRecord | null {
  if (!row?.id || !row.createdAt) {
    return null;
  }

  return {
    id: row.id,
    name: row.name ?? null,
    stage: String(row.stage ?? ''),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
    qualifiedAt: row.qualifiedAt ?? null,
    bizSqlConfirmed: isTruthyFlag(row.bizSqlConfirmed),
    bizSqlConfirmedAt: row.bizSqlConfirmedAt ?? null,
    campaignRejected: isTruthyFlag(row.campaignRejected),
    rejectionReason: row.rejectionReason ?? null,
    idOid: row.idOid ?? null,
    bizProduct: row.bizProduct ?? null,
    pointOfContactId: row.pointOfContactId ?? null,
    companyId: row.companyId ?? null,
    isFollowUp: isTruthyFlag(row.isFollowUp),
    snoozeUntil: row.snoozeUntil ?? null,
    nip: row.nip ?? null,
  };
}

function toCompany(
  row: CompanyQueryRow | null | undefined,
): InvoiceCompanyRecord | null {
  if (!row?.id) {
    return null;
  }

  return {
    id: row.id,
    name: row.name ?? null,
    nip: row.nip ?? null,
    legalName: row.legalName ?? null,
    registeredAddress: row.registeredAddress ?? null,
    enrichedAt: row.enrichedAt ?? null,
  };
}

export async function findOpportunityForActions(
  coreClient: CoreApiClient,
  recordId: string,
): Promise<OpportunityActionRecord | null> {
  const result = await coreClient.query({
    opportunity: {
      __args: {
        filter: { id: { eq: recordId } },
      },
      ...OPPORTUNITY_ACTION_FIELDS,
    },
  } as never);

  return toRecord(
    (result as { opportunity?: OpportunityQueryRow | null }).opportunity,
  );
}

export async function updateOpportunityForActions(
  coreClient: CoreApiClient,
  recordId: string,
  data: Record<string, unknown>,
): Promise<OpportunityActionRecord | null> {
  const result = await coreClient.mutation({
    updateOpportunity: {
      __args: {
        id: recordId,
        data,
      },
      ...OPPORTUNITY_ACTION_FIELDS,
    },
  } as never);

  return toRecord(
    (result as { updateOpportunity?: OpportunityQueryRow | null })
      .updateOpportunity,
  );
}

export async function getCurrentWorkspaceMemberId(): Promise<string | null> {
  try {
    const result = await new MetadataApiClient().query({
      currentUser: {
        workspaceMember: {
          id: true,
        },
      },
    });
    const id = (
      result.currentUser as { workspaceMember?: { id?: string | null } | null }
    )?.workspaceMember?.id;
    return id || null;
  } catch {
    return null;
  }
}
