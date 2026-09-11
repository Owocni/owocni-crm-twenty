import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import {
  findCompanyForInvoice,
  findOpportunityForActions,
} from 'src/utils/opportunityActionApi';
import { invoiceActionHints } from 'src/utils/opportunityActions';

const handler = async (event: RoutePayload) => {
  const recordId =
    typeof event.queryStringParameters?.recordId === 'string'
      ? event.queryStringParameters.recordId.trim()
      : '';

  if (!recordId) {
    return { ok: false, error: 'recordId required' };
  }

  const opportunity = await findOpportunityForActions(
    new CoreApiClient(),
    recordId,
  );

  if (!opportunity) {
    return { ok: false, error: 'opportunity not found' };
  }

  const company = opportunity.companyId
    ? await findCompanyForInvoice(new CoreApiClient(), opportunity.companyId)
    : null;
  return {
    ok: true,
    recordId: opportunity.id,
    bizSqlConfirmed: opportunity.bizSqlConfirmed,
    bizSqlConfirmedAt: opportunity.bizSqlConfirmedAt,
    campaignRejected: opportunity.campaignRejected,
    rejectionReason: opportunity.rejectionReason,
    isFollowUp: opportunity.isFollowUp,
    snoozeUntil: opportunity.snoozeUntil,
    ...invoiceActionHints({
      companyId: opportunity.companyId,
      companyName: company?.name ?? null,
      company,
      opportunityNip: opportunity.nip,
    }),
  };
};

export default defineLogicFunction({
  universalIdentifier: 'd19d627f-10c4-43e6-81af-62a2d3709fc5',
  name: 'get-opportunity-actions',
  description: 'SQL / reject / GUS / faktura status for the Opportunity strip',
  timeoutSeconds: 20,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/opportunity-actions',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
