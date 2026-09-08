import { afterEach, describe, expect, it } from 'vitest';

import {
  armedSendJson,
  buildDelayedSendBody,
  buildUnmountSendBody,
  KEEPALIVE_BODY_LIMIT,
  type ArmedSendPayload,
} from './armedSend';
import { clampDelayMs, waitUnlessCancelled } from './delayedSend';
import { resolveRestApiUrl } from './editorDraftApi';
import { resolveSendHtmlBody } from './resolveSendHtmlBody';

function sampleArmed(
  overrides: Partial<ArmedSendPayload> = {},
): ArmedSendPayload {
  return {
    to: 'test234@fastman.eu',
    subject: 'Re: bez tematu',
    htmlBodyBase64: btoa('<p>ok</p>'),
    files: [],
    accessToken: 'tok',
    draftSessionId: 'send:abc',
    ...overrides,
  };
}

describe('resolveRestApiUrl', () => {
  const previous = process.env.TWENTY_API_URL;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.TWENTY_API_URL;
    } else {
      process.env.TWENTY_API_URL = previous;
    }
  });

  it('prefers TWENTY_API_URL over the CRM page origin', () => {
    process.env.TWENTY_API_URL = 'https://api.twenty.com';

    expect(resolveRestApiUrl('/s/mail/send-template')).toBe(
      'https://api.twenty.com/s/mail/send-template',
    );
  });
});

describe('buildUnmountSendBody', () => {
  it('keeps htmlBodyBase64 when the payload fits keepalive', () => {
    const body = JSON.parse(buildUnmountSendBody(sampleArmed())) as {
      htmlBodyBase64?: string;
      draftSessionId?: string;
    };

    expect(body.htmlBodyBase64).toBe(btoa('<p>ok</p>'));
    expect(body.draftSessionId).toBe('send:abc');
  });

  it('drops htmlBodyBase64 when over the keepalive quota', () => {
    const huge = sampleArmed({
      htmlBodyBase64: 'A'.repeat(KEEPALIVE_BODY_LIMIT),
    });

    expect(armedSendJson(huge).length).toBeGreaterThan(KEEPALIVE_BODY_LIMIT);

    const body = JSON.parse(buildUnmountSendBody(huge)) as {
      htmlBodyBase64?: string;
      draftSessionId?: string;
      to?: string;
    };

    expect(body.htmlBodyBase64).toBeUndefined();
    expect(body.draftSessionId).toBe('send:abc');
    expect(body.to).toBe('test234@fastman.eu');
    expect(buildUnmountSendBody(huge).length).toBeLessThan(KEEPALIVE_BODY_LIMIT);
  });
});

describe('buildDelayedSendBody', () => {
  it('does not put jobId on the immediate send payload', () => {
    const immediate = JSON.parse(armedSendJson(sampleArmed())) as {
      jobId?: string;
      draftSessionId?: string;
    };

    expect(immediate.jobId).toBeUndefined();
    expect(immediate.draftSessionId).toBe('send:abc');
  });

  it('includes cc and bcc on delayed send when set', () => {
    const body = JSON.parse(
      buildDelayedSendBody(
        sampleArmed({
          cc: 'wspolnik@firma.pl, gosia@owocni.pl',
          bcc: 'mariusz@owocni.pl',
        }),
        15000,
      ),
    ) as {
      to?: string;
      cc?: string;
      bcc?: string;
    };

    expect(body.to).toBe('test234@fastman.eu');
    expect(body.cc).toBe('wspolnik@firma.pl, gosia@owocni.pl');
    expect(body.bcc).toBe('mariusz@owocni.pl');
  });

  it('includes internal handoff mode and opportunityId', () => {
    const body = JSON.parse(
      armedSendJson(
        sampleArmed({
          mode: 'internal',
          opportunityId: 'opp-1',
          to: 'damian@owocni.pl',
        }),
      ),
    ) as {
      mode?: string;
      opportunityId?: string;
      to?: string;
    };

    expect(body.mode).toBe('internal');
    expect(body.opportunityId).toBe('opp-1');
    expect(body.to).toBe('damian@owocni.pl');
  });

  it('includes forward mode without threading', () => {
    const body = JSON.parse(
      armedSendJson(
        sampleArmed({
          mode: 'forward',
          to: 'ktos@firma.pl',
          subject: 'Fwd: Wycena',
        }),
      ),
    ) as {
      mode?: string;
      inReplyToMessageId?: string;
      to?: string;
    };

    expect(body.mode).toBe('forward');
    expect(body.inReplyToMessageId).toBeUndefined();
    expect(body.to).toBe('ktos@firma.pl');
  });

  it('includes delayMs and jobId', () => {
    const body = JSON.parse(buildDelayedSendBody(sampleArmed(), 15000)) as {
      delayMs?: number;
      jobId?: string;
      htmlBodyBase64?: string;
    };

    expect(body.delayMs).toBe(15000);
    expect(body.jobId).toBe('send:abc');
    expect(body.htmlBodyBase64).toBe(btoa('<p>ok</p>'));
  });

  it('omits html when the keepalive quota would be exceeded', () => {
    const huge = sampleArmed({
      htmlBodyBase64: 'A'.repeat(KEEPALIVE_BODY_LIMIT),
    });
    const body = JSON.parse(buildDelayedSendBody(huge, 15000)) as {
      htmlBodyBase64?: string;
      draftSessionId?: string;
      delayMs?: number;
    };

    expect(body.htmlBodyBase64).toBeUndefined();
    expect(body.draftSessionId).toBe('send:abc');
    expect(body.delayMs).toBe(15000);
    expect(buildDelayedSendBody(huge, 15000).length).toBeLessThan(
      KEEPALIVE_BODY_LIMIT,
    );
  });
});

describe('clampDelayMs', () => {
  it('caps the delay at 20s', () => {
    expect(clampDelayMs(15000)).toBe(15000);
    expect(clampDelayMs(60_000)).toBe(20_000);
    expect(clampDelayMs(-1)).toBe(0);
  });
});

describe('waitUnlessCancelled', () => {
  it('returns cancelled when the flag flips during the wait', async () => {
    let cancelled = false;
    let now = 0;

    const result = waitUnlessCancelled({
      delayMs: 1000,
      now: () => now,
      sleep: async () => {
        cancelled = true;
        now = 1000;
      },
      isCancelled: async () => cancelled,
    });

    await expect(result).resolves.toBe('cancelled');
  });
});

describe('resolveSendHtmlBody', () => {
  it('uses htmlBodyBase64 first', async () => {
    const html = Buffer.from('<p>z edytora</p>', 'utf8').toString('base64');
    const result = await resolveSendHtmlBody({ htmlBodyBase64: html });

    expect(result).toEqual({ html: '<p>z edytora</p>', clientSent: true });
  });

  it('loads the editor draft when keepalive omitted the body', async () => {
    const result = await resolveSendHtmlBody(
      { draftSessionId: 'send:abc', to: 'test234@fastman.eu' },
      async (id) => (id === 'send:abc' ? '<p>ze szkicu</p>' : null),
    );

    expect(result).toEqual({ html: '<p>ze szkicu</p>', clientSent: true });
  });
});
