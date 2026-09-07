import { CoreApiClient } from 'twenty-client-sdk/core';

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
  isFollowUp: boolean;
  snoozeUntil: string | null;
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
  isFollowUp?: boolean | null;
  snoozeUntil?: string | null;
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
    isFollowUp: true,
    snoozeUntil: true,
  } as Record<string, unknown>),
};

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
    isFollowUp: isTruthyFlag(row.isFollowUp),
    snoozeUntil: row.snoozeUntil ?? null,
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
