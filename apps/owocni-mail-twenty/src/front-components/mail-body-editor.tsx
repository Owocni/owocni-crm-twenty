import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { EDITOR_DRAFT_PATH, resolveEditorDraftUrl } from 'src/utils/editorDraftApi';
import { resolveAccessToken } from 'src/utils/resolveAccessToken';

const EMPTY_BODY = '<p><br></p>';
const MAIL_FLUSH_MESSAGE = 'owocni-mail-flush';

function scheduleDelay(callback: () => void, ms: number): ReturnType<typeof setTimeout> {
  return setTimeout(callback, ms);
}

function scheduleDelayPromise(ms: number): Promise<void> {
  return new Promise((resolve) => {
    scheduleDelay(() => resolve(), ms);
  });
}

type MailBodyEditorProps = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  sessionId: string;
};

export type MailBodyEditorHandle = {
  flushHtml: () => string;
  flushHtmlAsync: () => Promise<string>;
};

type ToolbarButtonProps = {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

const ToolbarButton = ({
  label,
  title,
  onClick,
  disabled,
  bold,
  italic,
  underline,
}: ToolbarButtonProps) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onMouseDown={(event) => {
      event.preventDefault();
    }}
    onClick={onClick}
    style={{
      minWidth: 28,
      height: 28,
      padding: '0 6px',
      border: '1px solid #ddd',
      borderRadius: 4,
      background: disabled ? '#f5f5f5' : '#fff',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: 13,
      fontWeight: bold ? 700 : 400,
      fontStyle: italic ? 'italic' : 'normal',
      textDecoration: underline ? 'underline' : 'none',
      color: '#333',
    }}
  >
    {label}
  </button>
);

function escapeBodyCloseTag(html: string): string {
  return html.replace(/<\/body>/gi, '</bo"+"dy>');
}

function buildEditorDocument(
  bodyHtml: string,
  sessionId: string,
  draftSavePath: string,
  accessToken: string,
): string {
  const content = bodyHtml.trim() || EMPTY_BODY;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <base target="_blank">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      background: #fff;
    }
    body {
      box-sizing: border-box;
      min-height: 100%;
      padding: 12px;
      outline: none;
      font-family: Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      color: #222;
      overflow-y: auto;
    }
    p { margin: 0 0 0.75em; }
    ul, ol { margin: 0 0 0.75em; padding-left: 1.5em; }
  </style>
</head>
<body contenteditable="true">${escapeBodyCloseTag(content)}</body>
<script>
(function () {
  var sessionId = ${JSON.stringify(sessionId)};
  var draftSavePath = ${JSON.stringify(draftSavePath)};
  var accessToken = ${JSON.stringify(accessToken)};
  var flushMessage = ${JSON.stringify(MAIL_FLUSH_MESSAGE)};
  var saveTimer;

  function saveDraftToServer(html) {
    if (!sessionId || !draftSavePath || !accessToken) {
      return;
    }

    fetch(draftSavePath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken
      },
      body: JSON.stringify({ sessionId: sessionId, html: html })
    }).catch(function () {});
  }

  function publishHtml() {
    saveDraftToServer(document.body.innerHTML);
  }

  function schedulePublish() {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }

    saveTimer = setTimeout(function () {
      saveTimer = undefined;
      publishHtml();
    }, 120);
  }

  document.body.addEventListener('input', schedulePublish);
  document.body.addEventListener('keyup', schedulePublish);
  document.body.addEventListener('blur', publishHtml);
  document.body.addEventListener('paste', schedulePublish);

  new MutationObserver(schedulePublish).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
  });

  window.addEventListener('message', function (event) {
    if (event.data && event.data.type === flushMessage) {
      publishHtml();
      return;
    }

    if (event.data && event.data.type === 'owocni-mail-exec') {
      document.execCommand(event.data.command, false, event.data.arg);
      publishHtml();
    }
  });

  publishHtml();
})();
</script>
</html>`;
}

function isEffectivelyEmpty(html: string): boolean {
  const stripped = html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();

  return stripped.length === 0;
}

export const MailBodyEditor = forwardRef<MailBodyEditorHandle, MailBodyEditorProps>(
  function MailBodyEditor({ value, onChange, disabled = false, sessionId }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const objectUrlRef = useRef<string | null>(null);
    const onChangeRef = useRef(onChange);
    const initialValueRef = useRef(value);
    const latestHtmlRef = useRef(value);

    onChangeRef.current = onChange;

    const applyHtml = useCallback((html: string) => {
      const normalized = isEffectivelyEmpty(html) ? '' : html;

      if (!normalized && latestHtmlRef.current) {
        return;
      }

      if (normalized === latestHtmlRef.current) {
        return;
      }

      latestHtmlRef.current = normalized;
      onChangeRef.current(normalized);
    }, []);

    useEffect(() => {
      if (!value.trim()) {
        return;
      }

      initialValueRef.current = value;
      latestHtmlRef.current = value;
    }, [value]);

    const requestIframeFlush = useCallback(() => {
      iframeRef.current?.contentWindow?.postMessage({ type: MAIL_FLUSH_MESSAGE }, '*');
    }, []);

    const fetchDraftFromServer = useCallback(async (): Promise<string | null> => {
      try {
        const client = new RestApiClient();
        const result = await client.post<{ html?: string; found?: boolean }>(
          EDITOR_DRAFT_PATH,
          {
            sessionId,
            action: 'read',
          },
        );

        if (result.found && typeof result.html === 'string') {
          return isEffectivelyEmpty(result.html) ? '' : result.html;
        }
      } catch {
        // ignore
      }

      return null;
    }, [sessionId]);

    const flushHtmlAsync = useCallback(async (): Promise<string> => {
      requestIframeFlush();

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await scheduleDelayPromise(attempt === 0 ? 120 : 180);

        const remote = await fetchDraftFromServer();

        if (remote !== null) {
          applyHtml(remote);
          break;
        }
      }

      return latestHtmlRef.current;
    }, [applyHtml, fetchDraftFromServer, requestIframeFlush]);

    const flushHtml = useCallback((): string => {
      void flushHtmlAsync();
      return latestHtmlRef.current;
    }, [flushHtmlAsync]);

    useImperativeHandle(
      ref,
      () => ({
        flushHtml,
        flushHtmlAsync,
      }),
      [flushHtml, flushHtmlAsync],
    );

    useEffect(() => {
      const iframe = iframeRef.current;

      if (!iframe) {
        return;
      }

      let cancelled = false;
      let handleLoad: (() => void) | null = null;

      const mountEditor = async () => {
        let accessToken = '';

        try {
          accessToken = await resolveAccessToken();
        } catch {
          accessToken = '';
        }

        if (cancelled) {
          return;
        }

        handleLoad = () => {
          const doc = iframe.contentDocument ?? iframe.contentWindow?.document ?? null;

          if (doc?.body) {
            doc.body.contentEditable = disabled ? 'false' : 'true';
          }

          requestIframeFlush();
        };

        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }

        const blob = new Blob(
          [
            buildEditorDocument(
              initialValueRef.current,
              sessionId,
              resolveEditorDraftUrl(),
              accessToken,
            ),
          ],
          {
            type: 'text/html;charset=utf-8',
          },
        );
        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;
        iframe.addEventListener('load', handleLoad);
        iframe.src = objectUrl;
      };

      void mountEditor();

      return () => {
        cancelled = true;

        if (handleLoad) {
          iframe.removeEventListener('load', handleLoad);
        }

        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }
      };
      // Remount when session changes; parent bumps key alongside sessionId.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId]);

    useEffect(() => {
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument ?? iframe?.contentWindow?.document ?? null;
      const body = doc?.body;

      if (body) {
        body.contentEditable = disabled ? 'false' : 'true';
      }

      requestIframeFlush();
    }, [disabled, requestIframeFlush]);

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 280,
          border: '1px solid #ddd',
          borderRadius: 6,
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: '6px 8px',
            borderBottom: '1px solid #eee',
            background: '#fafafa',
            flexWrap: 'wrap',
          }}
        >
          <ToolbarButton
            label="B"
            title="Pogrubienie"
            bold
            disabled={disabled}
            onClick={() => {
              iframeRef.current?.contentWindow?.postMessage(
                { type: 'owocni-mail-exec', command: 'bold', arg: null },
                '*',
              );
              requestIframeFlush();
            }}
          />
          <ToolbarButton
            label="I"
            title="Kursywa"
            italic
            disabled={disabled}
            onClick={() => {
              iframeRef.current?.contentWindow?.postMessage(
                { type: 'owocni-mail-exec', command: 'italic', arg: null },
                '*',
              );
              requestIframeFlush();
            }}
          />
          <ToolbarButton
            label="U"
            title="Podkreślenie"
            underline
            disabled={disabled}
            onClick={() => {
              iframeRef.current?.contentWindow?.postMessage(
                { type: 'owocni-mail-exec', command: 'underline', arg: null },
                '*',
              );
              requestIframeFlush();
            }}
          />
          <ToolbarButton
            label="•"
            title="Lista punktowana"
            disabled={disabled}
            onClick={() => {
              iframeRef.current?.contentWindow?.postMessage(
                { type: 'owocni-mail-exec', command: 'insertUnorderedList', arg: null },
                '*',
              );
              requestIframeFlush();
            }}
          />
          <ToolbarButton
            label="1."
            title="Lista numerowana"
            disabled={disabled}
            onClick={() => {
              iframeRef.current?.contentWindow?.postMessage(
                { type: 'owocni-mail-exec', command: 'insertOrderedList', arg: null },
                '*',
              );
              requestIframeFlush();
            }}
          />
          <ToolbarButton
            label="¶"
            title="Akapit"
            disabled={disabled}
            onClick={() => {
              iframeRef.current?.contentWindow?.postMessage(
                { type: 'owocni-mail-exec', command: 'formatBlock', arg: 'p' },
                '*',
              );
              requestIframeFlush();
            }}
          />
        </div>
        <iframe
          ref={iframeRef}
          title="Edytor treści maila"
          style={{
            display: 'block',
            width: '100%',
            height: 360,
            border: 'none',
            background: '#fff',
            opacity: disabled ? 0.65 : 1,
            pointerEvents: disabled ? 'none' : 'auto',
          }}
        />
      </div>
    );
  },
);
