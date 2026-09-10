import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import {
  resolveContinuationHandles,
  resolveSendReadiness,
} from 'src/utils/findSendableEmailAccount';

const handler = async (event: RoutePayload) => {
  try {
    const recordId =
      typeof event.queryStringParameters?.recordId === 'string'
        ? event.queryStringParameters.recordId
        : null;
    const recipientEmail =
      typeof event.queryStringParameters?.email === 'string'
        ? event.queryStringParameters.email
        : null;

    const metadataClient = new MetadataApiClient();
    const coreClient = new CoreApiClient();

    let continuationHandles: string[] = [];

    try {
      continuationHandles = await resolveContinuationHandles(coreClient, {
        recordId,
        recipientEmail,
      });
    } catch {
      continuationHandles = [];
    }

    const readiness = await resolveSendReadiness(metadataClient, {
      continuationHandles,
      recordId,
      recipientEmail,
    });

    if (readiness.accounts.length === 0) {
      const email = readiness.currentUserEmail;
      const maciejHint =
        email === 'maciej@owocni.pl'
          ? ' Dla Macieja From = maciejwysocki@owocni.pl (nie copywriting@ i nie maciej@) — skrzynka musi być podpięta pod jego konto z sync + SMTP.'
          : '';

      return {
        canSend: false,
        reason: email
          ? `Brak dozwolonej skrzynki dla ${email}.${maciejHint} Handlowiec: własna skrzynka w Settings → Accounts. Konto wspólne (owocni@…): studio@ / leads@.`.trim()
          : 'Brak dozwolonej skrzynki (własna albo studio@ / leads@). Sprawdź Settings → Accounts.',
        accountHandle: null,
        connectedAccountId: null,
        allowedAccounts: [],
        currentUserEmail: readiness.currentUserEmail,
        continuationHandles,
      };
    }

    if (!readiness.selected) {
      return {
        canSend: false,
        reason:
          'Nie udało się wybrać skrzynki From. Wybierz studio@ albo leads@ ręcznie, jeśli pojawią się na liście.',
        accountHandle: null,
        connectedAccountId: null,
        allowedAccounts: readiness.accounts,
        currentUserEmail: readiness.currentUserEmail,
        continuationHandles,
      };
    }

    return {
      canSend: true,
      reason: null,
      accountHandle: readiness.selected.handle,
      connectedAccountId: readiness.selected.id,
      allowedAccounts: readiness.accounts,
      currentUserEmail: readiness.currentUserEmail,
      continuationHandles,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? 'unknown');

    return {
      canSend: false,
      reason: `Błąd sprawdzania skrzynki: ${message}`,
      accountHandle: null,
      connectedAccountId: null,
      allowedAccounts: [],
      currentUserEmail: null,
      continuationHandles: [],
    };
  }
};

export default defineLogicFunction({
  universalIdentifier: '0e826613-3028-4686-b2b5-c098b4a24c3a',
  name: 'mail-send-readiness',
  description:
    'Checks which From mailboxes the current user may use (own + studio/leads) and picks continuation/own default',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/send-readiness',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
