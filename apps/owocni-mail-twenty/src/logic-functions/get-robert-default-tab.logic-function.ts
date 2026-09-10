import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import { findOpportunityForActions } from 'src/utils/opportunityActionApi';
import {
  isRobertLogin,
  robertDefaultTabId,
} from 'src/utils/robertDefaultTab';

type CurrentUserRow = {
  email?: string | null;
  workspaceMember?: { userEmail?: string | null } | null;
};

async function loadCurrentUserEmail(
  metadataClient: MetadataApiClient,
): Promise<string | null> {
  try {
    const result = await metadataClient.query({
      currentUser: {
        email: true,
        workspaceMember: {
          userEmail: true,
        },
      },
    });

    const user = result.currentUser as CurrentUserRow | null | undefined;

    return user?.workspaceMember?.userEmail || user?.email || null;
  } catch {
    return null;
  }
}

const handler = async (event: RoutePayload) => {
  const recordId =
    typeof event.queryStringParameters?.recordId === 'string'
      ? event.queryStringParameters.recordId.trim()
      : '';

  if (!recordId) {
    return {
      ok: false,
      apply: false,
      isRobert: false,
      tabId: null,
      error: 'recordId required',
    };
  }

  const email = await loadCurrentUserEmail(new MetadataApiClient());
  const isRobert = isRobertLogin(email);

  if (!isRobert) {
    return { ok: true, apply: false, isRobert: false, tabId: null };
  }

  const opportunity = await findOpportunityForActions(
    new CoreApiClient(),
    recordId,
  );
  const tabId = robertDefaultTabId(opportunity?.stage);

  if (!tabId) {
    return { ok: true, apply: false, isRobert: true, tabId: null };
  }

  return { ok: true, apply: true, isRobert: true, tabId };
};

export default defineLogicFunction({
  universalIdentifier: '7e8ccd3b-0026-4459-b894-4f8bd77dc357',
  name: 'get-robert-default-tab',
  description:
    'Robert-only default Opportunity tab: Home on NEW, Tasks otherwise',
  timeoutSeconds: 20,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/robert-default-tab',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
