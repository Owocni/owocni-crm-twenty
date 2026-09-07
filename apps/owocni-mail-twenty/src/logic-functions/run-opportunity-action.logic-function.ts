import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import {
  findOpportunityForActions,
  updateOpportunityForActions,
  type OpportunityActionRecord,
} from 'src/utils/opportunityActionApi';
import {
  computeSqlFields,
  isFutureSnooze,
  isRejectionReason,
  isTerminalOpportunityStage,
  STAPE_INBOUND_URL,
} from 'src/utils/opportunityActions';
import { parseRouteBody, readStringField } from 'src/utils/parseRouteBody';

async function postStape(payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(STAPE_INBOUND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Workflow HTTP step continues on failure — same here.
  }
}

function stapeRecord(opportunity: OpportunityActionRecord) {
  return {
    id: opportunity.id,
    idOid: opportunity.idOid,
    name: opportunity.name,
    stage: opportunity.stage,
    bizProduct: opportunity.bizProduct,
    pointOfContactId: opportunity.pointOfContactId,
  };
}

const handler = async (event: RoutePayload) => {
  const body = parseRouteBody(event);
  const recordId = readStringField(body, 'recordId');
  const action = readStringField(body, 'action');

  if (!recordId) {
    return { ok: false, error: 'recordId required' };
  }

  if (action !== 'sql' && action !== 'reject' && action !== 'snooze') {
    return { ok: false, error: 'action must be sql, reject or snooze' };
  }

  const coreClient = new CoreApiClient();
  const current = await findOpportunityForActions(coreClient, recordId);
  if (!current) {
    return { ok: false, error: 'opportunity not found' };
  }

  if (action === 'sql') {
    if (current.bizSqlConfirmed) {
      return {
        ok: true,
        alreadyDone: true,
        bizSqlConfirmed: true,
        bizSqlConfirmedAt: current.bizSqlConfirmedAt,
        campaignRejected: current.campaignRejected,
        rejectionReason: current.rejectionReason,
        isFollowUp: current.isFollowUp,
        snoozeUntil: current.snoozeUntil,
      };
    }

    const sql = computeSqlFields({
      createdAt: current.createdAt,
      qualifiedAt: current.qualifiedAt,
      currentStage: current.stage,
    });
    const updated = await updateOpportunityForActions(coreClient, recordId, {
      stage: sql.stage,
      bizSqlConfirmed: true,
      bizSqlConfirmedAt: sql.bizSqlConfirmedAt,
      qualifiedAt: sql.qualifiedAt,
      hoursToQualified: sql.hoursToQualified,
    });
    const record = updated ?? { ...current, ...sql, bizSqlConfirmed: true };

    await postStape({
      event: 'opportunity.updated',
      timestamp: `sql-app-${record.updatedAt ?? sql.bizSqlConfirmedAt}`,
      data: {
        ...stapeRecord(record),
        bizSqlConfirmed: true,
      },
    });

    return {
      ok: true,
      alreadyDone: false,
      bizSqlConfirmed: true,
      bizSqlConfirmedAt: sql.bizSqlConfirmedAt,
      campaignRejected: record.campaignRejected,
      rejectionReason: record.rejectionReason,
      isFollowUp: record.isFollowUp,
      snoozeUntil: record.snoozeUntil,
    };
  }

  if (action === 'snooze') {
    if (isTerminalOpportunityStage(current.stage)) {
      return { ok: false, error: 'closed opportunity cannot be snoozed' };
    }

    const snoozeUntil = readStringField(body, 'snoozeUntil');
    if (!snoozeUntil || !isFutureSnooze(snoozeUntil)) {
      return { ok: false, error: 'snoozeUntil must be a future date and time' };
    }

    const untilIso = new Date(snoozeUntil).toISOString();
    const updated = await updateOpportunityForActions(coreClient, recordId, {
      snoozeUntil: untilIso,
      isFollowUp: false,
    });
    const record = updated ?? {
      ...current,
      snoozeUntil: untilIso,
      isFollowUp: false,
    };

    return {
      ok: true,
      alreadyDone: false,
      bizSqlConfirmed: record.bizSqlConfirmed,
      bizSqlConfirmedAt: record.bizSqlConfirmedAt,
      campaignRejected: record.campaignRejected,
      rejectionReason: record.rejectionReason,
      isFollowUp: false,
      snoozeUntil: record.snoozeUntil,
    };
  }

  if (current.campaignRejected) {
    return {
      ok: true,
      alreadyDone: true,
      bizSqlConfirmed: current.bizSqlConfirmed,
      bizSqlConfirmedAt: current.bizSqlConfirmedAt,
        campaignRejected: true,
        rejectionReason: current.rejectionReason,
        isFollowUp: current.isFollowUp,
        snoozeUntil: current.snoozeUntil,
      };
    }

  const rejectionReason = readStringField(body, 'rejectionReason');
  if (!isRejectionReason(rejectionReason)) {
    return { ok: false, error: 'rejectionReason required' };
  }

  const updated = await updateOpportunityForActions(coreClient, recordId, {
    campaignRejected: true,
    rejectionReason,
  });
  const record = updated ?? {
    ...current,
    campaignRejected: true,
    rejectionReason,
  };

  await postStape({
    event: 'opportunity.updated',
    timestamp: `reject-app-${record.updatedAt ?? new Date().toISOString()}`,
    previousRecord: {
      campaignRejected: false,
      stage: record.stage,
    },
    data: {
      ...stapeRecord(record),
      campaignRejected: true,
      rejectionReason,
    },
  });

  return {
    ok: true,
    alreadyDone: false,
    bizSqlConfirmed: record.bizSqlConfirmed,
    bizSqlConfirmedAt: record.bizSqlConfirmedAt,
    campaignRejected: true,
    rejectionReason,
    isFollowUp: record.isFollowUp,
    snoozeUntil: record.snoozeUntil,
  };
};

export default defineLogicFunction({
  universalIdentifier: 'e20e7380-21d5-44f7-92b0-73b3e481a0d6',
  name: 'run-opportunity-action',
  description: 'Przyjmij SQL / odrzuć leada — te same pola i webhook co workflow',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/opportunity-actions',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
