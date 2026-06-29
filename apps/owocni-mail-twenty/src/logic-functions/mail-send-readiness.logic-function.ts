import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import { findSendableEmailAccount } from 'src/utils/findSendableEmailAccount';

const handler = async (_event: RoutePayload) => {
  const metadataClient = new MetadataApiClient();

  const accountsResult = await metadataClient.query({
    myConnectedAccounts: {
      id: true,
      handle: true,
      authFailedAt: true,
    },
  });

  const activeAccounts = (accountsResult.myConnectedAccounts ?? []).filter(
    (account) => !account.authFailedAt,
  );

  if (activeAccounts.length === 0) {
    return {
      canSend: false,
      reason:
        'Brak podłączonego konta email. Dodaj konto w Settings → Accounts.',
      accountHandle: null,
      connectedAccountId: null,
    };
  }

  const sendableAccount = await findSendableEmailAccount(metadataClient);

  if (!sendableAccount) {
    return {
      canSend: false,
      reason:
        'Konto email jest podłączone, ale skrzynka nie zsynchronizowała się (brak message channel). Settings → Accounts → poczekaj na sync lub podłącz ponownie.',
      accountHandle: activeAccounts[0]?.handle ?? null,
      connectedAccountId: null,
    };
  }

  return {
    canSend: true,
    reason: null,
    accountHandle: sendableAccount.handle,
    connectedAccountId: sendableAccount.id,
  };
};

export default defineLogicFunction({
  universalIdentifier: '0e826613-3028-4686-b2b5-c098b4a24c3a',
  name: 'mail-send-readiness',
  description: 'Checks whether the current user can send email from the mail app',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/send-readiness',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
