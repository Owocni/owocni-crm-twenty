import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';

import {
  EDITOR_DRAFT_PATH,
  resolveAppOrigin,
  resolveEditorDraftUrl,
} from 'src/utils/editorDraftApi';
import { resolveAccessToken } from 'src/utils/resolveAccessToken';
import {
  buildVisualEditorSrcDoc,
  EMPTY_EDITOR_BODY,
  MAIL_FLUSH,
  MAIL_SET_AUTH,
  MAIL_SET_HTML,
} from 'src/utils/visualEditorRuntime';

/**
 * Diagnostics proved:
 * - FC origin is "null" → blob:null iframes are BLOCKED by the browser
 * - editor-frame stayed empty because durable draft read failed (draftMISS)
 * - React already has the HTML (valueLen ~22k)
 *
 * Display = srcDoc with HTML embedded (works under origin null; same as preview).
 * Sync = iframe scripts POST to absolute /s/mail/editor-draft (+ parent flush).
 * Never use blob: URLs in this host.
 */

const EMPTY_BODY = EMPTY_EDITOR_BODY;

type EditorMode = 'visual' | 'html';

type MailBodyEditorProps = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  sessionId: string;
  durableSessionId?: string;
};

export type MailBodyEditorHandle = {
  flushHtml: () => string;
  flushHtmlAsync: () => Promise<string>;
  setHtml: (html: string) => void;
};

function scheduleDelayPromise(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

async function resolveTokenFast(): Promise<string> {
  try {
    return await Promise.race([
      resolveAccessToken().catch(() => ''),
      scheduleDelayPromise(2000).then(() => ''),
    ]);
  } catch {
    return '';
  }
}

function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function isEffectivelyEmpty(html: string): boolean {
  const stripped = html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();

  return stripped.length === 0;
}

function logEditorDiag(
  step: string,
  detail: Record<string, unknown> = {},
): void {
  try {
    // eslint-disable-next-line no-console
    console.log(`[OwocniMailEditor] ${step}`, detail);
  } catch {
    // ignore
  }
}

function pickEdited(
  initial: string,
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const candidate of candidates) {
    if (candidate && candidate.trim() && candidate !== initial) {
      return candidate;
    }
  }

  for (const candidate of candidates) {
    if (candidate && candidate.trim()) {
      return candidate;
    }
  }

  return null;
}

async function writeServerDraft(
  sessionId: string,
  html: string,
  durableSessionId?: string,
): Promise<{ ok: boolean; db?: boolean; error?: string }> {
  if (!html.trim()) {
    return { ok: false, error: 'empty' };
  }

  try {
    const client = new RestApiClient();
    const result = await client.post<{
      ok?: boolean;
      db?: boolean;
      dbError?: string;
      error?: string;
    }>(EDITOR_DRAFT_PATH, {
      sessionId,
      ...(durableSessionId ? { durableSessionId } : {}),
      htmlBase64: encodeBase64Utf8(html),
      html: html.slice(0, 50_000),
    });

    if (result.ok === false) {
      return { ok: false, error: result.error ?? 'save rejected' };
    }

    return { ok: true, db: result.db, error: result.dbError };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchDraftFromServer(sessionId: string): Promise<string | null> {
  try {
    const client = new RestApiClient();
    const result = await client.post<{
      html?: string;
      found?: boolean;
      error?: string;
    }>(EDITOR_DRAFT_PATH, { sessionId, action: 'read' });

    if (result.found === true && typeof result.html === 'string') {
      return isEffectivelyEmpty(result.html) ? '' : result.html;
    }
  } catch {
    // ignore
  }

  return null;
}

export const MailBodyEditor = forwardRef<MailBodyEditorHandle, MailBodyEditorProps>(
  function MailBodyEditor(
    { value, onChange, disabled = false, sessionId, durableSessionId },
    ref,
  ) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const onChangeRef = useRef(onChange);
    const initialValueRef = useRef(value);
    const latestHtmlRef = useRef(value);
    const [mode, setMode] = useState<EditorMode>('visual');
    const [htmlMirror, setHtmlMirror] = useState(value);
    const [switching, setSwitching] = useState(false);
    const [srcDoc, setSrcDoc] = useState('');

    onChangeRef.current = onChange;

    const applyHtml = useCallback((html: string) => {
      const normalized = isEffectivelyEmpty(html) ? '' : html;

      if (!normalized && latestHtmlRef.current) {
        return latestHtmlRef.current;
      }

      latestHtmlRef.current = normalized;
      setHtmlMirror(normalized);
      onChangeRef.current(normalized);
      return normalized;
    }, []);

    const requestIframeFlush = useCallback(() => {
      try {
        iframeRef.current?.contentWindow?.postMessage({ type: MAIL_FLUSH }, '*');
      } catch {
        // ignore
      }
    }, []);

    const flushHtmlAsync = useCallback(async (): Promise<string> => {
      requestIframeFlush();

      const initial = initialValueRef.current;
      const known = latestHtmlRef.current;

      for (let attempt = 0; attempt < 8; attempt += 1) {
        await scheduleDelayPromise(attempt === 0 ? 120 : 150);

        const remote = await fetchDraftFromServer(sessionId);
        const best = pickEdited(initial, remote);

        if (best && best.trim() && best !== initial) {
          applyHtml(best);
          logEditorDiag('flush:got-edit', { length: best.length, attempt });
          return latestHtmlRef.current;
        }
      }

      const remote = await fetchDraftFromServer(sessionId);
      const best = pickEdited(initial, remote, known);

      if (best && best.trim()) {
        if (!(isEffectivelyEmpty(best) && known)) {
          applyHtml(best);
        }
      }

      logEditorDiag('flush:done', {
        remoteFound: remote !== null,
        remoteLen: remote?.length ?? 0,
        resultLen: latestHtmlRef.current.length,
      });

      return latestHtmlRef.current;
    }, [applyHtml, requestIframeFlush, sessionId]);

    const flushHtml = useCallback((): string => {
      void flushHtmlAsync();
      return latestHtmlRef.current;
    }, [flushHtmlAsync]);

    const mountSrcDoc = useCallback(
      (html: string, token: string) => {
        const draftUrl = resolveEditorDraftUrl();
        const doc = buildVisualEditorSrcDoc({
          bodyHtml: html,
          sessionId,
          durableSessionId,
          draftSaveUrl: draftUrl,
          accessToken: token,
        });
        setSrcDoc(doc);
        logEditorDiag('srcDoc:mounted', {
          htmlLen: html.length,
          docLen: doc.length,
          draftUrl,
          tokenLen: token.length,
          appOrigin: resolveAppOrigin(),
        });
      },
      [sessionId, durableSessionId],
    );

    const setHtml = useCallback(
      (html: string) => {
        const normalized = applyHtml(html);
        void writeServerDraft(
          sessionId,
          normalized || EMPTY_BODY,
          durableSessionId,
        );
        try {
          iframeRef.current?.contentWindow?.postMessage(
            { type: MAIL_SET_HTML, html: normalized || EMPTY_BODY },
            '*',
          );
        } catch {
          // ignore
        }
        void resolveTokenFast().then((token) => {
          mountSrcDoc(normalized || EMPTY_BODY, token);
        });
      },
      [applyHtml, mountSrcDoc, sessionId, durableSessionId],
    );

    useImperativeHandle(
      ref,
      () => ({ flushHtml, flushHtmlAsync, setHtml }),
      [flushHtml, flushHtmlAsync, setHtml],
    );

    useEffect(() => {
      let cancelled = false;

      initialValueRef.current = value;
      latestHtmlRef.current = value;
      setHtmlMirror(value);
      setMode('visual');

      const appOrigin = resolveAppOrigin();
      logEditorDiag('mount:start', {
        sessionId,
        valueLen: value.length,
        valuePreview: value.slice(0, 80),
        fcOrigin: globalThis.location?.origin ?? '(none)',
        appOrigin,
        envApi: globalThis.process?.env?.TWENTY_API_URL?.slice(0, 60) ?? '(none)',
      });

      // Mount srcDoc immediately with content — display does not wait on draft/token.
      mountSrcDoc(value, '');

      const boot = async () => {
        const seed = await writeServerDraft(
          sessionId,
          value,
          durableSessionId,
        );
        if (cancelled) {
          return;
        }

        logEditorDiag('mount:seed', seed);

        const token = await resolveTokenFast();
        if (cancelled) {
          return;
        }

        // Remount once with token so autosave works (before user edits ideally).
        mountSrcDoc(latestHtmlRef.current || value, token);
        try {
          iframeRef.current?.contentWindow?.postMessage(
            { type: MAIL_SET_AUTH, token },
            '*',
          );
        } catch {
          // ignore
        }
        requestIframeFlush();
      };

      void boot();

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, durableSessionId, value.length > 0 ? 'has-content' : 'empty']);

    const switchMode = async (next: EditorMode) => {
      if (next === mode || switching) {
        return;
      }

      if (next === 'html') {
        setSwitching(true);
        try {
          const html = await flushHtmlAsync();
          setHtmlMirror(html.trim() ? html : latestHtmlRef.current);
          setMode('html');
        } finally {
          setSwitching(false);
        }
        return;
      }

      setHtml(htmlMirror);
      setMode('visual');
    };

    const modeToggleStyle = (active: boolean) => ({
      padding: '4px 10px',
      border: '1px solid #ddd',
      borderRadius: 4,
      background: active ? '#eef2ff' : '#fff',
      color: active ? '#3730a3' : '#555',
      fontWeight: active ? 600 : 400,
      fontSize: 12,
      cursor: disabled || switching ? 'not-allowed' : 'pointer',
    });

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
            gap: 6,
            alignItems: 'center',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            disabled={disabled || switching}
            onClick={() => void switchMode('visual')}
            style={modeToggleStyle(mode === 'visual')}
          >
            Edytor wizualny
          </button>
          <button
            type="button"
            disabled={disabled || switching}
            onClick={() => void switchMode('html')}
            style={modeToggleStyle(mode === 'html')}
          >
            {switching ? 'Synchronizacja…' : 'Kod HTML'}
          </button>
        </div>

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
            <div
              style={{
                display: mode === 'visual' ? 'flex' : 'none',
                flex: 1,
                minHeight: 0,
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <iframe
                ref={iframeRef}
                title="Edytor treści maila"
                srcDoc={srcDoc}
                tabIndex={0}
                onLoad={() => {
                  logEditorDiag('iframe:load');
                  requestIframeFlush();
                }}
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
            </div>
          ) : (
            <div
              style={{
                display: mode === 'visual' ? 'flex' : 'none',
                flex: 1,
                minHeight: 0,
                alignItems: 'center',
                justifyContent: 'center',
                color: '#888',
                fontSize: 12,
              }}
            >
              Przygotowywanie…
            </div>
          )}

          {mode === 'html' ? (
            <textarea
              value={htmlMirror}
              disabled={disabled}
              onChange={(event) => {
                applyHtml(event.target.value);
                void writeServerDraft(
                  sessionId,
                  event.target.value,
                  durableSessionId,
                );
              }}
              spellCheck={false}
              aria-label="Kod HTML maila"
              style={{
                flex: 1,
                minHeight: 0,
                width: '100%',
                boxSizing: 'border-box',
                padding: 12,
                border: 'none',
                outline: 'none',
                resize: 'none',
                overflowY: 'auto',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 12,
                lineHeight: 1.45,
                color: '#222',
                background: disabled ? '#f5f5f5' : '#fff',
              }}
            />
          ) : null}
        </div>
      </div>
    );
  },
);
