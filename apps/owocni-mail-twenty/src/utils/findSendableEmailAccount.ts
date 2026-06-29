import { MetadataApiClient } from 'twenty-client-sdk/metadata';

export type SendableEmailAccount = {
  id: string;
  handle: string;
};

export async function findSendableEmailAccount(
  metadataClient: MetadataApiClient,
  preferredAccountId?: string | null,
): Promise<SendableEmailAccount | null> {
  const accountsResult = await metadataClient.query({
    myConnectedAccounts: {
      id: true,
      handle: true,
      authFailedAt: true,
      provider: true,
    },
  });

  const activeAccounts = (accountsResult.myConnectedAccounts ?? []).filter(
    (account) => !account.authFailedAt,
  );

  const ordered = preferredAccountId
    ? [
        ...activeAccounts.filter((account) => account.id === preferredAccountId),
        ...activeAccounts.filter((account) => account.id !== preferredAccountId),
      ]
    : activeAccounts;

  for (const account of ordered) {
    const channelsResult = await metadataClient.query({
      myMessageChannels: {
        __args: { connectedAccountId: account.id },
        id: true,
        handle: true,
      },
    });

    const channels = channelsResult.myMessageChannels ?? [];

    if (account.provider === 'EMAIL_GROUP') {
      if (channels.length > 0) {
        return { id: account.id, handle: account.handle };
      }

      continue;
    }

    const hasMatchingChannel = channels.some(
      (channel) => channel.handle === account.handle,
    );

    if (hasMatchingChannel || channels.length > 0) {
      return { id: account.id, handle: account.handle };
    }
  }

  return null;
}

export function mapSendEmailError(error: string): string {
  if (error.includes('No message channel found')) {
    return 'Skrzynka email nie jest zsynchronizowana w Twenty. Wejdź w Settings → Accounts, poczekaj na zakończenie synchronizacji albo odłącz i podłącz konto ponownie.';
  }

  if (error.includes('SMTP is not configured')) {
    return 'Konto email nie ma skonfigurowanego SMTP. Uzupełnij ustawienia w Settings → Accounts.';
  }

  if (error.includes('user context') || error.includes('API keys are not supported')) {
    return 'Wysyłka wymaga aktywnej sesji użytkownika — odśwież stronę i spróbuj ponownie.';
  }

  return error;
}
