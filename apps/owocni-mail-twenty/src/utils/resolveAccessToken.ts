export async function resolveAccessToken(): Promise<string> {
  const refresh = globalThis.frontComponentHostCommunicationApi?.requestAccessTokenRefresh;

  if (typeof refresh === 'function') {
    const token = await refresh();

    if (typeof token === 'string' && token.length > 0) {
      return token;
    }
  }

  throw new Error('Brak tokenu aplikacji do synchronizacji edytora.');
}
