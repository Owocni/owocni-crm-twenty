import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { getEditorDraft } from 'src/logic-functions/editor-draft-store';

const EMPTY_BODY = '<p><br></p>';
const MAIL_FLUSH = 'owocni-mail-flush';
const MAIL_SET_AUTH = 'owocni-mail-set-auth';
const MAIL_SET_HTML = 'owocni-mail-set-html';

function sanitizeBodyHtml(html: string): string {
  return html
    .replace(/<\/body>/gi, '')
    .replace(/<body\b[^>]*>/gi, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?script\b[^>]*>/gi, '');
}

function buildEditorPage(
  bodyHtml: string,
  sessionId: string,
  accessToken: string,
  draftSaveUrl: string,
): string {
  const content = sanitizeBodyHtml(bodyHtml.trim() || EMPTY_BODY);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <base target="_blank">
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #fff; }
    body {
      box-sizing: border-box; min-height: 100%; padding: 12px; outline: none;
      font-family: Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #222;
      overflow-y: auto; caret-color: #222;
    }
    p { margin: 0 0 0.75em; }
    ul, ol { margin: 0 0 0.75em; padding-left: 1.5em; }
  </style>
</head>
<body contenteditable="true">${content}</body>
<script>
(function () {
  var sessionId = ${JSON.stringify(sessionId)};
  var draftSaveUrl = ${JSON.stringify(draftSaveUrl)};
  var accessToken = ${JSON.stringify(accessToken)};
  var flushMessage = ${JSON.stringify(MAIL_FLUSH)};
  var setAuthMessage = ${JSON.stringify(MAIL_SET_AUTH)};
  var setHtmlMessage = ${JSON.stringify(MAIL_SET_HTML)};
  var saveTimer;
  var lastSaved = '';

  function toBase64(text) {
    try {
      var bytes = new TextEncoder().encode(text);
      var binary = '';
      for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    } catch (e) {
      return '';
    }
  }

  function saveDraftToServer(html) {
    if (!sessionId || !draftSaveUrl || !accessToken) return;
    if (html === lastSaved) return;
    lastSaved = html;
    try {
      fetch(draftSaveUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + accessToken
        },
        body: JSON.stringify({
          sessionId: sessionId,
          htmlBase64: toBase64(html),
          html: String(html).slice(0, 50000)
        })
      }).catch(function () {});
    } catch (e) {}
  }

  function publishHtml() {
    saveDraftToServer(document.body.innerHTML);
  }

  function schedulePublish() {
    if (saveTimer) clearTimeout(saveTimer);
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
    childList: true, subtree: true, characterData: true, attributes: true
  });

  window.addEventListener('message', function (event) {
    if (!event.data || typeof event.data !== 'object') return;
    if (event.data.type === flushMessage) {
      publishHtml();
      return;
    }
    if (event.data.type === setAuthMessage && typeof event.data.token === 'string') {
      accessToken = event.data.token;
      publishHtml();
      return;
    }
    if (event.data.type === setHtmlMessage && typeof event.data.html === 'string') {
      document.body.innerHTML = event.data.html.trim()
        ? event.data.html
        : ${JSON.stringify(EMPTY_BODY)};
      publishHtml();
      return;
    }
    if (event.data.type === 'owocni-mail-exec') {
      try {
        document.execCommand(event.data.command, false, event.data.arg);
      } catch (e) {}
      publishHtml();
    }
  });

  publishHtml();
})();
</script>
</html>`;
}

/**
 * Real-origin editor document for FC host with origin "null"
 * (blob:null iframes are blocked by the browser).
 * Content comes from durable mailEditorDraft (seeded by parent before navigate).
 */
const handler = async (event: RoutePayload) => {
  const sessionId = event.queryStringParameters?.sessionId?.trim() ?? '';
  const accessToken = event.queryStringParameters?.token?.trim() ?? '';

  if (!sessionId) {
    return new Response('<p>Brak sessionId</p>', {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  let html = EMPTY_BODY;

  try {
    const draft = await getEditorDraft(sessionId);
    if (draft && draft.trim()) {
      html = draft;
    }
  } catch {
    // fall through to empty body
  }

  // Same-origin relative draft path works inside this real-origin frame.
  const draftSaveUrl = '/s/mail/editor-draft';
  const page = buildEditorPage(html, sessionId, accessToken, draftSaveUrl);

  return new Response(page, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
};

export default defineLogicFunction({
  universalIdentifier: 'c8e4f1a2-9b7d-4c3e-8f6a-2d1e0b9c8a7f',
  name: 'get-editor-frame',
  description: 'Serves the visual mail editor HTML document for an iframe',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/mail/editor-frame',
    httpMethod: 'GET',
    isAuthRequired: false,
  },
});
