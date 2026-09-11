import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import {
  findCompanyForInvoice,
  findOpportunityForActions,
  getCurrentWorkspaceMemberId,
  updateOpportunityForActions,
  type OpportunityActionRecord,
} from 'src/utils/opportunityActionApi';
import { callEnrichCompany, callIssueInvoice } from 'src/utils/gcpCrmWorker';
import {
  computeSqlFields,
  invoiceActionHints,
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

async function invoiceFields(opportunity: OpportunityActionRecord) {
  const company = opportunity.companyId
    ? await findCompanyForInvoice(new CoreApiClient(), opportunity.companyId)
    : null;
  return invoiceActionHints({
    companyId: opportunity.companyId,
    companyName: company?.name ?? null,
    company,
    opportunityNip: opportunity.nip,
  });
}

function sqlRejectFields(opportunity: OpportunityActionRecord) {
  return {
    bizSqlConfirmed: opportunity.bizSqlConfirmed,
    bizSqlConfirmedAt: opportunity.bizSqlConfirmedAt,
    campaignRejected: opportunity.campaignRejected,
    rejectionReason: opportunity.rejectionReason,
    isFollowUp: opportunity.isFollowUp,
    snoozeUntil: opportunity.snoozeUntil,
  };
}

const handler = async (event: RoutePayload) => {
  const body = parseRouteBody(event);
  const recordId = readStringField(body, 'recordId');
  const action = readStringField(body, 'action');

  if (!recordId) {
    return { ok: false, error: 'recordId required' };
  }

  if (
    action !== 'sql' &&
    action !== 'reject' &&
    action !== 'snooze' &&
    action !== 'enrich' &&
    action !== 'issue'
  ) {
    return { ok: false, error: 'action must be sql, reject, snooze, enrich or issue' };
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
      ...sqlRejectFields(record),
      bizSqlConfirmed: true,
      bizSqlConfirmedAt: sql.bizSqlConfirmedAt,
      ...(await invoiceFields(record)),
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
      ...sqlRejectFields(record),
      isFollowUp: false,
      snoozeUntil: record.snoozeUntil,
      ...(await invoiceFields(record)),
    };
  }

  if (action === 'enrich') {
    const hints = await invoiceFields(current);
    if (!hints.hasNip) {
      return {
        ok: false,
        error: 'uzupełnij NIP',
        ...sqlRejectFields(current),
        ...hints,
      };
    }

    const enrich = await callEnrichCompany({
      opportunityId: current.id,
      companyId: hints.companyId,
      nip: hints.nip,
    });
    if (!enrich.ok) {
      return {
        ok: false,
        error: enrich.error || 'Enrich nieudany',
        ...sqlRejectFields(current),
        ...hints,
      };
    }

    const refreshed =
      (await findOpportunityForActions(coreClient, recordId)) ?? current;
    const next = await invoiceFields(refreshed);
    return {
      ok: true,
      alreadyDone: false,
      ...sqlRejectFields(refreshed),
      ...next,
      enrichFields: enrich.fields,
    };
  }

  if (action === 'issue') {
    const kindRaw = readStringField(body, 'kind').toLowerCase();
    const kind = kindRaw === 'vat' ? 'vat' : kindRaw === 'proforma' ? 'proforma' : '';
    if (!kind) {
      return { ok: false, error: 'Wybierz Proforma albo Faktura VAT' };
    }

    const hints = await invoiceFields(current);
    if (!hints.invoiceReady || !hints.companyId) {
      return {
        ok: false,
        error: hints.issueHint || 'Najpierw uzupełnij dane',
        ...sqlRejectFields(current),
        ...hints,
      };
    }

    const issuedBy = await getCurrentWorkspaceMemberId();
    const issued = await callIssueInvoice({
      opportunityId: current.id,
      companyId: hints.companyId,
      kind,
      issuedBy,
    });
    if (!issued.ok) {
      return {
        ok: false,
        error: issued.error || 'Nie udało się wystawić dokumentu',
        ...sqlRejectFields(current),
        ...hints,
      };
    }

    return {
      ok: true,
      alreadyDone: false,
      ...sqlRejectFields(current),
      ...hints,
      invoiceNumber: issued.number,
      invoiceUrl: issued.url,
      fakturaId: issued.fakturaId,
      kind,
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
    ...sqlRejectFields(record),
    campaignRejected: true,
    rejectionReason,
    ...(await invoiceFields(record)),
  };
};

export default defineLogicFunction({
  universalIdentifier: 'e20e7380-21d5-44f7-92b0-73b3e481a0d6',
  name: 'run-opportunity-action',
  description: 'SQL / odrzut / GUS / wystaw dokument — worker GCP na enrich i FV',
  timeoutSeconds: 90,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/opportunity-actions',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
