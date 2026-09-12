import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';

import type { MailBodyEditorHandle } from 'src/front-components/mail-body-editor';
import {
  EDITOR_DRAFT_PATH,
  resolveEditorDraftUrl,
  resolveRestApiUrl,
} from 'src/utils/editorDraftApi';
import { resolveAccessToken } from 'src/utils/resolveAccessToken';
import { SEND_TEMPLATE_PATH } from 'src/utils/armedSend';
import { ATTACHMENT_UPLOAD_PATH } from 'src/utils/emailAttachmentShared';
import {
  createComposerSessionTicket,
  REFRESH_COMPOSER_SESSION_PATH,
} from 'src/utils/composerSessionTicket';
import {
  composerV2EnvelopeKey,
  MAIL_V2_ENVELOPE,
  MAIL_V2_SENT,
  MAIL_V2_STATUS,
  type ComposerV2Envelope,
} from 'src/utils/composerV2Iframe';
import {
  buildVisualEditorSrcDoc,
  EMPTY_EDITOR_BODY,
  MAIL_HTML_CHANGED,
  MAIL_SET_AUTH,
  MAIL_SET_HTML,
} from 'src/utils/visualEditorRuntime';

type ComposerV2HostProps = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  sessionId: string;
  durableSessionId?: string;
  envelope: ComposerV2Envelope;
  onSent: (result: Record<string, unknown>) => void;
  onSendError: (message: string) => void;
};

function scheduleDelayPromise(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function resolveTokenReady(): Promise<string> {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    try {
      const token = await resolveAccessToken();
      if (token.trim()) {
        return token.trim();
      }
    } catch {
      // retry
    }
    await scheduleDelayPromise(250);
  }

  return '';
}

async function fetchV2Status(sessionId: string): Promise<string | null> {
  try {
    const client = new RestApiClient();
    const result = await client.post<{
      html?: string;
      found?: boolean;
    }>(EDITOR_DRAFT_PATH, {
      sessionId: `v2status:${sessionId}`,
      action: 'read',
    });

    if (result.found === true && typeof result.html === 'string') {
      return result.html;
    }
  } catch {
    // ignore
  }

  return null;
}

async function pushComposerSessionToken(args: {
  ticket: string;
  accessToken: string;
  sessionId: string;
}): Promise<void> {
  const client = new RestApiClient();
  await client.post(REFRESH_COMPOSER_SESSION_PATH, {
    action: 'push',
    ticket: args.ticket,
    accessToken: args.accessToken,
    sessionId: args.sessionId,
  });
}

export const ComposerV2Host = forwardRef<MailBodyEditorHandle, ComposerV2HostProps>(
  function ComposerV2Host(
    {
      value,
      onChange,
      disabled = false,
      sessionId,
      durableSessionId,
      envelope,
      onSent,
      onSendError,
    },
    ref,
  ) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const onChangeRef = useRef(onChange);
    const onSentRef = useRef(onSent);
    const onSendErrorRef = useRef(onSendError);
    const envelopeRef = useRef(envelope);
    const latestHtmlRef = useRef(value);
    const handledStatusRef = useRef('');
    const finishedRef = useRef(false);
    const ticketRef = useRef('');
    const [srcDoc, setSrcDoc] = useState('');

    onChangeRef.current = onChange;
    onSentRef.current = onSent;
    onSendErrorRef.current = onSendError;
    envelopeRef.current = envelope;

    const postToIframe = useCallback((payload: Record<string, unknown>) => {
      try {
        iframeRef.current?.contentWindow?.postMessage(payload, '*');
      } catch {
        // ignore
      }
    }, []);

    const mountOnce = useCallback(
      (html: string, token: string, ticket: string) => {
        const doc = buildVisualEditorSrcDoc({
          bodyHtml: html,
          sessionId,
          durableSessionId,
          draftSaveUrl: resolveEditorDraftUrl(),
          accessToken: token,
          composerV2: {
            sendUrl: resolveRestApiUrl(SEND_TEMPLATE_PATH),
            sessionRefreshUrl: resolveRestApiUrl(REFRESH_COMPOSER_SESSION_PATH),
            sessionTicket: ticket,
            uploadUrl: resolveRestApiUrl(ATTACHMENT_UPLOAD_PATH),
            envelope: envelopeRef.current,
          },
        });
        setSrcDoc(doc);
      },
      [sessionId, durableSessionId],
    );

    const setHtml = useCallback(
      (html: string) => {
        latestHtmlRef.current = html;
        onChangeRef.current(html);
        postToIframe({ type: MAIL_SET_HTML, html: html.trim() || EMPTY_EDITOR_BODY });
      },
      [postToIframe],
    );

    const flushHtml = useCallback((): string => latestHtmlRef.current, []);
    const flushHtmlAsync = useCallback(async (): Promise<string> => {
      return latestHtmlRef.current;
    }, []);

    useImperativeHandle(
      ref,
      () => ({ flushHtml, flushHtmlAsync, setHtml }),
      [flushHtml, flushHtmlAsync, setHtml],
    );

    useLayoutEffect(() => {
      let cancelled = false;
      latestHtmlRef.current = value;
      handledStatusRef.current = '';
      finishedRef.current = false;
      const ticket = createComposerSessionTicket();
      ticketRef.current = ticket;
      // Paint the editor immediately. Token is pushed in the background —
      // remounting here is what made Friday's iframe eat typed text.
      mountOnce(latestHtmlRef.current || value, '', ticket);

      const boot = async () => {
        const token = await resolveTokenReady();
        if (cancelled || !token) {
          return;
        }
        try {
          await pushComposerSessionToken({
            ticket,
            accessToken: token,
            sessionId,
          });
        } catch {
          // iframe pull retries until the next interval
        }
        if (cancelled) {
          return;
        }
        postToIframe({ type: MAIL_SET_AUTH, token });
      };

      void boot();
      return () => {
        cancelled = true;
        const stale = ticket;
        void (async () => {
          try {
            const client = new RestApiClient();
            await client.post(REFRESH_COMPOSER_SESSION_PATH, {
              action: 'drop',
              ticket: stale,
            });
          } catch {
            // ignore
          }
        })();
      };
      // New compose session only — token refresh must not remount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, durableSessionId]);

    useEffect(() => {
      postToIframe({ type: MAIL_V2_ENVELOPE, envelope });
    }, [envelope, postToIframe, srcDoc]);

    useEffect(() => {
      if (!sessionId) {
        return undefined;
      }

      const json = JSON.stringify(envelope);
      void (async () => {
        try {
          const client = new RestApiClient();
          await client.post(EDITOR_DRAFT_PATH, {
            sessionId: composerV2EnvelopeKey(sessionId),
            htmlBase64: encodeBase64Utf8(json),
            html: json.slice(0, 50_000),
          });
        } catch {
          // iframe send still has the baked envelope; server may miss late files
        }
      })();

      return undefined;
    }, [envelope, sessionId]);

    useEffect(() => {
      if (!srcDoc) {
        return undefined;
      }

      const refreshAuth = async () => {
        try {
          const token = await resolveAccessToken();
          const trimmed = token.trim();
          if (!trimmed || !ticketRef.current) {
            return;
          }
          await pushComposerSessionToken({
            ticket: ticketRef.current,
            accessToken: trimmed,
            sessionId,
          });
          postToIframe({ type: MAIL_SET_AUTH, token: trimmed });
        } catch {
          // iframe pull + 401 retry still cover expiry
        }
      };

      void refreshAuth();
      const timer = globalThis.setInterval(() => {
        void refreshAuth();
      }, 30_000);

      const onVisible = () => {
        if (globalThis.document?.visibilityState === 'visible') {
          void refreshAuth();
        }
      };
      globalThis.document?.addEventListener('visibilitychange', onVisible);

      return () => {
        globalThis.clearInterval(timer);
        globalThis.document?.removeEventListener('visibilitychange', onVisible);
      };
    }, [postToIframe, srcDoc, sessionId]);

    useEffect(() => {
      const onMessage = (event: MessageEvent) => {
        const data = event.data;
        if (!data || typeof data !== 'object') {
          return;
        }
        if (data.type === MAIL_HTML_CHANGED && typeof data.html === 'string') {
          latestHtmlRef.current = data.html;
          onChangeRef.current(data.html);
          return;
        }
        if (data.type === MAIL_V2_SENT && data.result) {
          if (finishedRef.current) {
            return;
          }
          finishedRef.current = true;
          onSentRef.current(data.result as Record<string, unknown>);
          return;
        }
        if (data.type === MAIL_V2_STATUS && data.error) {
          onSendErrorRef.current(String(data.error));
        }
      };

      globalThis.addEventListener('message', onMessage);
      return () => {
        globalThis.removeEventListener('message', onMessage);
      };
    }, []);

    useEffect(() => {
      if (!srcDoc) {
        return undefined;
      }

      const timer = globalThis.setInterval(() => {
        void (async () => {
          const raw = await fetchV2Status(sessionId);
          if (!raw || raw === handledStatusRef.current) {
            return;
          }
          handledStatusRef.current = raw;
          if (raw.startsWith('sent:')) {
            if (finishedRef.current) {
              return;
            }
            finishedRef.current = true;
            try {
              const result = JSON.parse(raw.slice(5)) as Record<string, unknown>;
              onSentRef.current(result);
            } catch {
              onSentRef.current({ ok: true });
            }
            return;
          }
          if (raw.startsWith('error:')) {
            onSendErrorRef.current(raw.slice(6));
          }
        })();
      }, 800);

      return () => {
        globalThis.clearInterval(timer);
      };
    }, [sessionId, srcDoc]);

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          height: '100%',
          gap: 6,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            border: '1px solid #ddd',
            borderRadius: 6,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          {srcDoc ? (
            <iframe
              ref={iframeRef}
              title="Edytor treści maila (composer v2)"
              srcDoc={srcDoc}
              tabIndex={0}
              style={{
                width: '100%',
                height: '100%',
                flex: 1,
                minHeight: 0,
                border: 'none',
                background: '#fff',
                opacity: disabled ? 0.65 : 1,
                pointerEvents: disabled ? 'none' : 'auto',
              }}
            />
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#888',
                fontSize: 12,
                padding: 16,
                textAlign: 'center',
              }}
            >
              Przygotowywanie edytora…
            </div>
          )}
        </div>
      </div>
    );
  },
);
