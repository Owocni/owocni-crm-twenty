import { describe, expect, it, vi } from 'vitest';

import { sendSmsViaSmsapi, unwrapDuplicatedSmsapiToken } from './smsapiSend';

describe('sendSmsViaSmsapi', () => {
  it('posts Bearer + form fields and reads the first id', async () => {
    const fetchImpl = vi.fn();
    fetchImpl.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        count: 1,
        list: [{ id: 'abc123', points: '0.16' }],
      }),
    });

    const result = await sendSmsViaSmsapi({
      token: 'secret-token-secret-token',
      apiTo: '48790359039',
      message: 'Test Twenty Dawid',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: true, id: 'abc123', points: '0.16' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer secret-token-secret-token',
    });
    expect(String(init.body)).toContain('from=Owocni.pl');
    expect(String(init.body)).toContain('to=48790359039');
    expect(String(init.body)).toContain('format=json');
    expect(String(init.body)).toContain('access_token=secret-token-secret-token');
  });

  it('surfaces SMSAPI error payload', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ error: 11, message: 'Invalid phone number' }),
    })) as unknown as typeof fetch;

    await expect(
      sendSmsViaSmsapi({
        token: 'secret-token-secret-token',
        apiTo: '12',
        message: 'x',
        fetchImpl,
      }),
    ).resolves.toEqual({
      ok: false,
      error: 'SMSAPI: Invalid phone number (token: 25 znaków)',
    });
  });

  it('refuses an empty token without calling the network', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(
      sendSmsViaSmsapi({
        token: '  ',
        apiTo: '48790359039',
        message: 'x',
        fetchImpl,
      }),
    ).resolves.toEqual({
      ok: false,
      error: 'Brak tokenu SMSAPI w aplikacji Twenty.',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses a Twenty-masked secret without calling SMSAPI', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(
      sendSmsViaSmsapi({
        token: 'abcde********',
        apiTo: '48790359039',
        message: 'x',
        fetchImpl,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('zamaskowany'),
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('unwrapDuplicatedSmsapiToken', () => {
  it('collapses an accidental double paste', () => {
    expect(unwrapDuplicatedSmsapiToken('abcdefghijabcdefghijabcdefghijabcdefghij')).toBe(
      'abcdefghijabcdefghij',
    );
  });

  it('leaves a normal token alone', () => {
    expect(unwrapDuplicatedSmsapiToken('abcdefghijabcdefghijabcdefghijabcdef')).toBe(
      'abcdefghijabcdefghijabcdefghijabcdef',
    );
  });
});
