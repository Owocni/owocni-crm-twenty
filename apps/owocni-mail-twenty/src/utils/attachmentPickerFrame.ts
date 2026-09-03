import {
  ATTACHMENT_FRAME_MESSAGE_TYPE,
  ATTACHMENT_UPLOAD_PATH,
  MAX_EMAIL_ATTACHMENT_BYTES,
} from 'src/utils/emailAttachmentShared';
import { resolveAppOrigin } from 'src/utils/editorDraftApi';

/**
 * Real-DOM attachment picker for the FC sandbox.
 * Remote-DOM refs have no `.click()` and never receive File bytes — the iframe
 * owns the native file input and posts base64 to our logic function.
 *
 * Success/errors go to the parent via postMessage. Do not remount this iframe
 * while an upload is in flight — that aborts fetch and looks like a silent miss.
 */
export function buildAttachmentPickerSrcDoc(options: {
  sessionId: string;
  accessToken: string;
  disabled?: boolean;
}): string {
  const origin = resolveAppOrigin();
  const uploadUrl = origin
    ? `${origin}${ATTACHMENT_UPLOAD_PATH}`
    : ATTACHMENT_UPLOAD_PATH;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body {
      margin: 0; padding: 0; width: 100%; height: 100%;
      background: #fff; overflow: hidden;
    }
    label {
      position: relative; display: flex; align-items: center; justify-content: center;
      width: 100%; height: 100%; cursor: pointer; color: #374151;
      box-sizing: border-box;
    }
    label.disabled { cursor: not-allowed; opacity: 0.55; pointer-events: none; }
    input[type=file] {
      position: absolute; inset: 0; opacity: 0; cursor: pointer;
      width: 100%; height: 100%;
    }
    svg { display: block; pointer-events: none; }
    .busy { font: 12px/1 system-ui, sans-serif; color: #6b7280; }
  </style>
</head>
<body>
  <label id="root" title="Dodaj załącznik" aria-label="Dodaj załącznik">
    <input id="file" type="file" multiple ${options.disabled ? 'disabled' : ''} />
    <svg id="icon" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
    <span id="busy" class="busy" hidden>…</span>
  </label>
  <script>
(function () {
  var sessionId = ${JSON.stringify(options.sessionId)};
  var accessToken = ${JSON.stringify(options.accessToken)};
  var uploadUrl = ${JSON.stringify(uploadUrl)};
  var maxBytes = ${MAX_EMAIL_ATTACHMENT_BYTES};
  var messageType = ${JSON.stringify(ATTACHMENT_FRAME_MESSAGE_TYPE)};
  var disabled = ${options.disabled ? 'true' : 'false'};
  var input = document.getElementById('file');
  var root = document.getElementById('root');
  var icon = document.getElementById('icon');
  var busy = document.getElementById('busy');
  var uploading = false;

  function notify(payload) {
    var message = { type: messageType, sessionId: sessionId };
    for (var key in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        message[key] = payload[key];
      }
    }
    try {
      window.parent.postMessage(message, '*');
    } catch (e) {}
  }

  function setBusy(on) {
    uploading = on;
    notify({ uploading: on });
    if (on) {
      icon.hidden = true;
      busy.hidden = false;
      root.classList.add('disabled');
      input.disabled = true;
    } else {
      icon.hidden = false;
      busy.hidden = true;
      if (!disabled) {
        root.classList.remove('disabled');
        input.disabled = false;
      }
    }
  }

  if (disabled) root.classList.add('disabled');

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || '');
        var comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = function () { reject(reader.error || new Error('read failed')); };
      reader.readAsDataURL(file);
    });
  }

  async function postJson(body) {
    var response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken
      },
      body: JSON.stringify(body)
    });
    var data = null;
    try { data = await response.json(); } catch (e) { data = null; }
    if (!response.ok) {
      var message = (data && data.error) ? data.error : ('HTTP ' + response.status);
      throw new Error(message);
    }
    if (data && data.ok === false) {
      throw new Error(data.error || 'Upload failed');
    }
    return data || {};
  }

  input.addEventListener('change', async function () {
    var files = Array.prototype.slice.call(input.files || [], 0);
    input.value = '';
    if (!files.length || uploading || disabled) return;

    setBusy(true);
    try {
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (!file || file.size <= 0) {
          notify({ ok: false, error: 'Plik jest pusty.' });
          continue;
        }
        if (file.size > maxBytes) {
          notify({
            ok: false,
            error: 'Plik jest za duży (max ' + Math.round(maxBytes / (1024 * 1024)) + ' MB).'
          });
          continue;
        }
        var contentBase64 = await fileToBase64(file);
        var data = await postJson({
          action: 'upload',
          sessionId: sessionId,
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          contentBase64: contentBase64
        });
        var uploaded = data && data.file && data.file.id && data.file.name
          ? data.file
          : { id: '', name: file.name };
        if (!uploaded.id) {
          notify({ ok: false, error: 'Upload „' + file.name + '” nie zwrócił id pliku.' });
          continue;
        }
        notify({ ok: true, file: uploaded });
      }
    } catch (e) {
      notify({
        ok: false,
        error: (e && e.message) ? e.message : 'Nie udało się dodać załącznika.'
      });
    } finally {
      setBusy(false);
    }
  });
})();
  </script>
</body>
</html>`;
}
