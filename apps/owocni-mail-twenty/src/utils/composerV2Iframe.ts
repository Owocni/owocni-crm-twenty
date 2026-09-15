import {
  MAX_EMAIL_ATTACHMENT_BYTES,
  MAX_EMAIL_ATTACHMENTS,
} from 'src/utils/emailAttachmentShared';
import { SMS_TEMPLATES } from 'src/utils/smsTemplates';

export const MAIL_V2_ENVELOPE = 'owocni-mail-v2-envelope';
export const MAIL_V2_ENVELOPE_EDIT = 'owocni-mail-v2-envelope-edit';
export const MAIL_V2_SENT = 'owocni-mail-v2-sent';
export const MAIL_V2_STATUS = 'owocni-mail-v2-status';
export const COMPOSER_V2_ENVELOPE_PREFIX = 'v2envelope:';

export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function composerV2EnvelopeKey(sessionId: string): string {
  return `${COMPOSER_V2_ENVELOPE_PREFIX}${sessionId}`;
}

export type ComposerV2Envelope = {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  recordId?: string;
  connectedAccountId?: string;
  inReplyToMessageId?: string;
  files?: Array<{ id: string; name: string }>;
  mode?: 'internal' | 'forward';
  opportunityId?: string;
  composeDraftKey?: string;
  templateId?: string;
  canSend?: boolean;
  sendBlockedReason?: string;
  cardPhone?: string;
};

export type ComposerV2SrcDocConfig = {
  sendUrl: string;
  envelope: ComposerV2Envelope;
  sessionRefreshUrl: string;
  sessionTicket: string;
  uploadUrl: string;
};

export function parseComposerV2EnvelopeJson(
  raw: string | null | undefined,
): ComposerV2Envelope | null {
  if (!raw?.trim()) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return parsed as ComposerV2Envelope;
  } catch {
    return null;
  }
}

export function composerV2Css(): string {
  return `
    #owocni-v2-bar {
      flex-shrink: 0;
      padding: 10px 12px 12px;
      border-top: 1px solid #eee;
      background: #fff;
    }
    #owocni-v2-actions { display: flex; gap: 8px; align-items: stretch; }
    #owocni-v2-send, #owocni-v2-now, #owocni-v2-cancel {
      height: 42px;
      padding: 0 12px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
    }
    #owocni-v2-send {
      flex: 1;
      border: none;
      background: #4f46e5;
      color: #fff;
    }
    #owocni-v2-send[disabled] { background: #999; cursor: not-allowed; }
    #owocni-v2-now {
      display: none;
      flex: 1;
      border: none;
      background: #4f46e5;
      color: #fff;
    }
    #owocni-v2-cancel {
      display: none;
      flex: 1;
      border: 1px solid #fdba74;
      background: #fff;
      color: #9a3412;
    }
    #owocni-v2-status { font-size: 12px; margin-top: 6px; color: #555; }
    #owocni-v2-status.is-busy { color: #1d4ed8; }
    #owocni-v2-status.is-error { color: #b91c1c; }
    #owocni-v2-hint { font-size: 11px; margin-top: 4px; color: #888; }
    #owocni-v2-sms-toggle {
      height: 42px;
      padding: 0 12px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      border: 1px solid #c4b5fd;
      background: #fff;
      color: #5b21b6;
    }
    #owocni-v2-sms-toggle.is-on {
      background: #5b21b6;
      color: #fff;
      border-color: #5b21b6;
    }
    #owocni-v2-sms {
      margin-bottom: 8px;
      padding: 8px;
      border: 1px solid #ddd6fe;
      border-radius: 6px;
      background: #faf5ff;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    #owocni-v2-sms[hidden] { display: none !important; }
    #owocni-v2-sms-phone, #owocni-v2-sms-body {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #ddd;
      border-radius: 4px;
      font: inherit;
      padding: 6px 8px;
    }
    #owocni-v2-sms-body { min-height: 72px; resize: vertical; }
    #owocni-v2-sms-templates { display: flex; flex-wrap: wrap; gap: 4px; }
    #owocni-v2-sms-templates button {
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid #c4b5fd;
      background: #fff;
      color: #5b21b6;
      cursor: pointer;
    }
    #owocni-v2-envelope {
      flex-shrink: 0;
      padding: 6px 8px 4px;
      border-bottom: 1px solid #eee;
      background: #fff;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    #owocni-v2-envelope label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 600;
      color: #555;
    }
    #owocni-v2-envelope label[hidden] { display: none !important; }
    #owocni-v2-envelope label span { width: 46px; flex-shrink: 0; }
    #owocni-v2-envelope input[type="text"],
    #owocni-v2-envelope input[type="email"] {
      flex: 1;
      min-width: 0;
      height: 30px;
      padding: 0 8px;
      border: 1px solid #ddd;
      border-radius: 5px;
      font-size: 13px;
      font-weight: 400;
      color: #222;
    }
    #owocni-v2-to-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    #owocni-v2-to-row > label { flex: 1; min-width: 0; }
    #owocni-v2-to-row button {
      height: 30px;
      padding: 0 8px;
      border: 1px solid #ddd;
      border-radius: 5px;
      background: #fff;
      font-size: 11px;
      font-weight: 600;
      color: #444;
      cursor: pointer;
      flex-shrink: 0;
    }
    #owocni-v2-to-row button[hidden] { display: none !important; }
    .owocni-v2-copy-hide {
      width: 24px;
      height: 30px;
      padding: 0;
      border: none;
      background: transparent;
      color: #6b7280;
      font-size: 16px;
      cursor: pointer;
      flex-shrink: 0;
    }
    #owocni-v2-subject-row { display: flex; align-items: center; gap: 8px; }
    #owocni-v2-clip {
      position: relative;
      width: 30px;
      height: 30px;
      flex-shrink: 0;
      border: 1px solid #d1d5db;
      border-radius: 5px;
      background: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #374151;
    }
    #owocni-v2-clip svg { pointer-events: none; }
    #owocni-v2-clip input[type="file"] {
      position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;
    }
    #owocni-v2-clip.busy {
      opacity: 0.85; cursor: wait;
    }
    #owocni-v2-clip.busy input[type="file"] { pointer-events: none; }
    #owocni-v2-clip.busy svg { display: none; }
    #owocni-v2-clip.busy::after { content: '…'; font-size: 16px; line-height: 1; color: #1d4ed8; }
    #owocni-v2-files { display: flex; flex-wrap: wrap; gap: 6px; padding-left: 54px; }
    #owocni-v2-files:empty { display: none; }
    .owocni-v2-chip {
      display: inline-flex; align-items: center; gap: 6px;
      max-width: 100%; padding: 3px 8px; border-radius: 999px;
      background: #f3f4f6; border: 1px solid #e5e7eb; font-size: 12px; font-weight: 400; color: #374151;
    }
    .owocni-v2-chip.pending {
      color: #1d4ed8; border-color: #bfdbfe; background: #eff6ff;
    }
    .owocni-v2-chip button {
      border: none; background: transparent; cursor: pointer; color: #6b7280; padding: 0; font-size: 14px; line-height: 1;
    }
  `;
}

export function composerV2EnvelopeHtml(envelope: ComposerV2Envelope): string {
  const to = escapeHtmlAttr(envelope.to ?? '');
  const cc = escapeHtmlAttr(envelope.cc ?? '');
  const bcc = escapeHtmlAttr(envelope.bcc ?? '');
  const subject = escapeHtmlAttr(envelope.subject ?? '');
  const showCc = Boolean(envelope.cc);
  const showBcc = Boolean(envelope.bcc);

  return `
<div id="owocni-v2-envelope">
  <div id="owocni-v2-to-row">
    <label>
      <span>Do</span>
      <input id="owocni-v2-to" type="text" value="${to}" placeholder="email@klienta.pl" autocomplete="off">
    </label>
    <button type="button" id="owocni-v2-cc-toggle"${showCc ? ' hidden' : ''}>DW</button>
    <button type="button" id="owocni-v2-bcc-toggle"${showBcc ? ' hidden' : ''}>UDW</button>
  </div>
  <label id="owocni-v2-cc-row"${showCc ? '' : ' hidden'}>
    <span>DW</span>
    <input id="owocni-v2-cc" type="text" value="${cc}" placeholder="kopia@…" autocomplete="off">
    <button type="button" id="owocni-v2-cc-hide" class="owocni-v2-copy-hide" aria-label="Ukryj DW">×</button>
  </label>
  <label id="owocni-v2-bcc-row"${showBcc ? '' : ' hidden'}>
    <span>UDW</span>
    <input id="owocni-v2-bcc" type="text" value="${bcc}" placeholder="udw@…" autocomplete="off">
    <button type="button" id="owocni-v2-bcc-hide" class="owocni-v2-copy-hide" aria-label="Ukryj UDW">×</button>
  </label>
  <div id="owocni-v2-subject-row">
    <label style="flex:1;min-width:0">
      <span>Temat</span>
      <input id="owocni-v2-subject" type="text" value="${subject}" placeholder="Temat wiadomości" autocomplete="off">
    </label>
    <label id="owocni-v2-clip" title="Dodaj załącznik" aria-label="Dodaj załącznik">
      <input id="owocni-v2-file" type="file" multiple>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
      </svg>
    </label>
  </div>
  <div id="owocni-v2-files"></div>
</div>`;
}

export function composerV2BarHtml(envelope: ComposerV2Envelope = {}): string {
  const phone = escapeHtmlAttr(envelope.cardPhone ?? '');
  return `
<div id="owocni-v2-bar">
  <div id="owocni-v2-sms" hidden>
    <label>Numer
      <input id="owocni-v2-sms-phone" type="tel" inputmode="tel" autocomplete="tel" value="${phone}" placeholder="Wpisz numer telefonu">
    </label>
    <textarea id="owocni-v2-sms-body" rows="4" placeholder="Napisz SMS albo wklej szablon"></textarea>
    <div id="owocni-v2-sms-templates"></div>
  </div>
  <div id="owocni-v2-actions">
    <button type="button" id="owocni-v2-sms-toggle">SMS</button>
    <button type="button" id="owocni-v2-send">Wyślij email</button>
    <button type="button" id="owocni-v2-now">Wyślij teraz</button>
    <button type="button" id="owocni-v2-cancel">Anuluj</button>
  </div>
  <div id="owocni-v2-status"></div>
  <div id="owocni-v2-hint">Odliczanie 15 s jest w tej ramce. Zamknięcie karty nie wysyła.</div>
</div>`;
}

export function composerV2BootScript(config: ComposerV2SrcDocConfig): string {
  return `
  var composerV2 = true;
  var sendUrl = ${JSON.stringify(config.sendUrl)};
  var envelope = ${JSON.stringify(config.envelope)};
  var envelopeMessage = ${JSON.stringify(MAIL_V2_ENVELOPE)};
  var envelopeEditMessage = ${JSON.stringify(MAIL_V2_ENVELOPE_EDIT)};
  var sentMessage = ${JSON.stringify(MAIL_V2_SENT)};
  var v2StatusMessage = ${JSON.stringify(MAIL_V2_STATUS)};
  var envelopeKeyPrefix = ${JSON.stringify(COMPOSER_V2_ENVELOPE_PREFIX)};
  var sessionRefreshUrl = ${JSON.stringify(config.sessionRefreshUrl)};
  var sessionTicket = ${JSON.stringify(config.sessionTicket)};
  var uploadUrl = ${JSON.stringify(config.uploadUrl)};
  var maxAttachmentBytes = ${JSON.stringify(MAX_EMAIL_ATTACHMENT_BYTES)};
  var maxAttachments = ${JSON.stringify(MAX_EMAIL_ATTACHMENTS)};
  var smsTemplates = ${JSON.stringify(SMS_TEMPLATES)};
`;
}

export function composerV2IdleBootScript(): string {
  return `
  var composerV2 = false;
  var sendUrl = '';
  var envelope = {};
  var envelopeMessage = ${JSON.stringify(MAIL_V2_ENVELOPE)};
  var envelopeEditMessage = ${JSON.stringify(MAIL_V2_ENVELOPE_EDIT)};
  var sentMessage = ${JSON.stringify(MAIL_V2_SENT)};
  var v2StatusMessage = ${JSON.stringify(MAIL_V2_STATUS)};
  var envelopeKeyPrefix = ${JSON.stringify(COMPOSER_V2_ENVELOPE_PREFIX)};
  var sessionRefreshUrl = '';
  var sessionTicket = '';
  var uploadUrl = '';
  var maxAttachmentBytes = 0;
  var maxAttachments = 0;
  function v2MergeEnvelope(next) {
    if (next && typeof next === 'object') envelope = next;
  }
  function v2UpdateHint() {}
`;
}

/** Wired after editor helpers exist (toBase64, editor, accessToken, sessionId, draftSaveUrl). */
export function composerV2RuntimeScript(): string {
  return `
  var v2SeedSigPlain = '';
  var v2SeedHandle = '';

  function v2HtmlToPlain(html) {
    return String(html || '')
      .replace(/<br\\s*\\/?>/gi, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\\s+/g, '');
  }

  function v2SigNode() {
    return editor ? editor.querySelector('[data-owocni-signature]') : null;
  }

  function v2RememberSeed(force) {
    var sig = v2SigNode();
    var handle = (sig && sig.getAttribute('data-owocni-handle')) || '';
    if (!force && v2SeedSigPlain && v2SeedHandle === handle) return;
    v2SeedHandle = handle;
    v2SeedSigPlain = sig ? v2HtmlToPlain(sig.innerHTML) : '';
  }

  function v2Plain(html) {
    var raw = String(html || '');
    raw = raw.replace(/<div[^>]*class="[^"]*gmail_quote[^"]*"[\\s\\S]*$/i, '');
    raw = raw.replace(/<div[^>]*class="[^"]*moz-cite-prefix[^"]*"[\\s\\S]*$/i, '');
    raw = raw.replace(/<blockquote\\b[^>]*>[\\s\\S]*?napisał\\(a\\):[\\s\\S]*?<\\/blockquote>/gi, '');
    var withoutSig = raw.replace(/<section[^>]*data-owocni-signature[\\s\\S]*?<\\/section>/gi, ' ');
    var outside = v2HtmlToPlain(withoutSig);
    if (outside) return outside;
    var match = /<section[^>]*data-owocni-signature="1"[^>]*>([\\s\\S]*?)<\\/section>/i.exec(raw);
    var inside = v2HtmlToPlain(match && match[1] ? match[1] : '');
    if (v2SeedSigPlain && inside && inside !== v2SeedSigPlain) return inside;
    return '';
  }

  function v2SetStatus(text, kind) {
    var node = document.getElementById('owocni-v2-status');
    if (!node) return;
    node.textContent = text || '';
    node.classList.remove('is-busy', 'is-error');
    if (kind === 'busy') node.classList.add('is-busy');
    if (kind === 'error') node.classList.add('is-error');
  }

  function v2Notify(type, extra) {
    try {
      var payload = extra && typeof extra === 'object' ? extra : {};
      payload.type = type;
      parent.postMessage(payload, '*');
    } catch (e) {}
  }

  function v2PullAuth(done) {
    if (!sessionRefreshUrl || !sessionTicket) {
      done();
      return;
    }
    try {
      fetch(sessionRefreshUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pull', ticket: sessionTicket })
      }).then(function (res) { return res.json(); }).then(function (data) {
        if (data && typeof data.accessToken === 'string' && data.accessToken.trim()) {
          accessToken = data.accessToken.trim();
          v2UpdateHint();
        }
        done();
      }).catch(function () { done(); });
    } catch (e) {
      done();
    }
  }

  function v2SaveStatus(html) {
    if (!draftSaveUrl || !accessToken || !sessionId) return;
    try {
      fetch(draftSaveUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + accessToken
        },
        body: JSON.stringify({
          sessionId: 'v2status:' + sessionId,
          htmlBase64: toBase64(html),
          html: String(html).slice(0, 2000)
        })
      }).catch(function () {});
    } catch (e) {}
  }

  function v2ShowIdle() {
    var sendBtn = document.getElementById('owocni-v2-send');
    var nowBtn = document.getElementById('owocni-v2-now');
    var cancelBtn = document.getElementById('owocni-v2-cancel');
    if (sendBtn) { sendBtn.style.display = 'block'; sendBtn.disabled = false; }
    if (nowBtn) nowBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
  }

  function v2FileCount() {
    return envelope && envelope.files && envelope.files.length ? envelope.files.length : 0;
  }

  function v2Input(id) {
    return document.getElementById(id);
  }

  function v2InputVal(id) {
    var el = v2Input(id);
    return el && 'value' in el ? String(el.value || '').trim() : '';
  }

  function v2MarkDirty(el) {
    if (el) el.setAttribute('data-dirty', '1');
  }

  function v2IsDirty(id) {
    var el = v2Input(id);
    return Boolean(el && el.getAttribute('data-dirty') === '1');
  }

  function v2ReadFormIntoEnvelope() {
    if (!envelope || typeof envelope !== 'object') envelope = {};
    var to = v2InputVal('owocni-v2-to');
    var cc = v2InputVal('owocni-v2-cc');
    var bcc = v2InputVal('owocni-v2-bcc');
    var subject = v2InputVal('owocni-v2-subject');
    envelope.to = to;
    envelope.cc = cc;
    envelope.bcc = bcc;
    envelope.subject = subject;
  }

  function v2NotifyEnvelopeEdit() {
    v2Notify(envelopeEditMessage, {
      to: envelope && envelope.to ? envelope.to : '',
      cc: envelope && envelope.cc ? envelope.cc : '',
      bcc: envelope && envelope.bcc ? envelope.bcc : '',
      subject: envelope && envelope.subject ? envelope.subject : ''
    });
  }

  function v2FillPristineForm() {
    var map = [
      ['owocni-v2-to', envelope && envelope.to ? envelope.to : ''],
      ['owocni-v2-cc', envelope && envelope.cc ? envelope.cc : ''],
      ['owocni-v2-bcc', envelope && envelope.bcc ? envelope.bcc : ''],
      ['owocni-v2-subject', envelope && envelope.subject ? envelope.subject : ''],
      ['owocni-v2-sms-phone', envelope && envelope.cardPhone ? envelope.cardPhone : '']
    ];
    for (var i = 0; i < map.length; i++) {
      var id = map[i][0];
      var value = map[i][1];
      var el = v2Input(id);
      if (!el || v2IsDirty(id)) continue;
      el.value = value;
    }
    var ccRow = v2Input('owocni-v2-cc-row');
    var bccRow = v2Input('owocni-v2-bcc-row');
    if (ccRow && envelope && envelope.cc) ccRow.hidden = false;
    if (bccRow && envelope && envelope.bcc) bccRow.hidden = false;
    v2SyncCopyVisibility();
  }

  function v2SyncCopyVisibility() {
    var ccRow = v2Input('owocni-v2-cc-row');
    var bccRow = v2Input('owocni-v2-bcc-row');
    var ccToggle = v2Input('owocni-v2-cc-toggle');
    var bccToggle = v2Input('owocni-v2-bcc-toggle');
    if (ccToggle) ccToggle.hidden = Boolean(ccRow && !ccRow.hidden);
    if (bccToggle) bccToggle.hidden = Boolean(bccRow && !bccRow.hidden);
  }

  function v2PersistEnvelope() {
    v2ReadFormIntoEnvelope();
    if (!draftSaveUrl || !accessToken || !sessionId) return;
    var json = JSON.stringify(envelope);
    try {
      fetch(draftSaveUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + accessToken
        },
        body: JSON.stringify({
          sessionId: envelopeKeyPrefix + sessionId,
          htmlBase64: toBase64(json),
          html: String(json).slice(0, 50000)
        })
      }).catch(function () {});
    } catch (e) {}
  }

  var v2PersistTimer = null;
  function v2SchedulePersist() {
    if (v2PersistTimer) clearTimeout(v2PersistTimer);
    v2PersistTimer = setTimeout(function () {
      v2PersistTimer = null;
      v2PersistEnvelope();
    }, 200);
  }

  var v2Uploading = false;
  var v2WaitingAuth = false;
  var v2PendingFiles = [];
  var v2PendingUi = [];
  var v2AuthWaitTries = 0;

  function v2RenderFiles() {
    var box = v2Input('owocni-v2-files');
    if (!box) return;
    box.innerHTML = '';
    var files = envelope && envelope.files ? envelope.files : [];
    for (var i = 0; i < files.length; i++) {
      (function (file) {
        if (!file || !file.id) return;
        var chip = document.createElement('span');
        chip.className = 'owocni-v2-chip';
        var name = document.createElement('span');
        name.textContent = file.name || file.id;
        var del = document.createElement('button');
        del.type = 'button';
        del.setAttribute('aria-label', 'Usuń ' + (file.name || ''));
        del.textContent = '×';
        del.addEventListener('click', function () {
          envelope.files = (envelope.files || []).filter(function (entry) {
            return entry && entry.id !== file.id;
          });
          v2RenderFiles();
          v2UpdateHint();
          v2PersistEnvelope();
        });
        chip.appendChild(name);
        chip.appendChild(del);
        box.appendChild(chip);
      })(files[i]);
    }
    var pendingNames = v2PendingUi || [];
    for (var p = 0; p < pendingNames.length; p++) {
      var pendingChip = document.createElement('span');
      pendingChip.className = 'owocni-v2-chip pending';
      pendingChip.textContent = 'Trwa załączanie: ' + (pendingNames[p] || 'plik') + '…';
      box.appendChild(pendingChip);
    }
  }

  function v2FileToBase64(file) {
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

  function v2SetClipBusy(on) {
    v2Uploading = on;
    var clip = v2Input('owocni-v2-clip');
    var input = v2Input('owocni-v2-file');
    if (clip) {
      if (on) {
        clip.classList.add('busy');
        clip.setAttribute('title', 'Trwa załączanie pliku…');
      } else {
        clip.classList.remove('busy');
        clip.setAttribute('title', 'Dodaj załącznik');
      }
    }
    if (input) input.disabled = on;
  }

  function v2FailUpload(filename, detail) {
    var msg = 'Nie udało się dodać „' + (filename || 'pliku') + '”';
    if (detail) msg += ': ' + detail;
    else msg += '.';
    v2SetStatus(msg, 'error');
    v2Notify(v2StatusMessage, { error: msg });
    return msg;
  }

  function v2PostUpload(file, contentBase64, retried) {
    return fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken
      },
      body: JSON.stringify({
        action: 'upload',
        sessionId: sessionId,
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        contentBase64: contentBase64
      })
    }).then(function (res) {
      return res.json().then(function (data) {
        return { okHttp: res.ok, status: res.status, data: data || {} };
      }).catch(function () {
        return {
          okHttp: res.ok,
          status: res.status,
          data: { ok: false, error: 'HTTP ' + res.status }
        };
      });
    }).then(function (pack) {
      if (pack.status === 401 && !retried) {
        return new Promise(function (resolve, reject) {
          v2PullAuth(function () {
            v2PostUpload(file, contentBase64, true).then(resolve, reject);
          });
        });
      }
      return pack;
    });
  }

  function v2FlushPendingUploads() {
    if (v2Uploading) return;
    if (!v2PendingFiles.length) {
      v2PendingUi = [];
      v2WaitingAuth = false;
      v2AuthWaitTries = 0;
      v2RenderFiles();
      return;
    }
    if (!uploadUrl) {
      var noUrl = v2PendingFiles[0] && v2PendingFiles[0].name;
      v2PendingFiles = [];
      v2PendingUi = [];
      v2FailUpload(noUrl, 'brak adresu uploadu. Odśwież kartę (Cmd+Shift+R)');
      v2RenderFiles();
      return;
    }
    if (!accessToken) {
      if (v2WaitingAuth) return;
      v2WaitingAuth = true;
      v2PendingUi = v2PendingFiles.map(function (file) {
        return file && file.name ? file.name : 'plik';
      });
      v2SetClipBusy(false);
      var clipWait = v2Input('owocni-v2-clip');
      if (clipWait) {
        clipWait.classList.add('busy');
        clipWait.setAttribute('title', 'Trwa załączanie pliku…');
      }
      v2SetStatus('Trwa załączanie pliku. Czekam na uprawnienie…', 'busy');
      v2RenderFiles();
      v2PullAuth(function () {
        v2WaitingAuth = false;
        if (accessToken) {
          v2AuthWaitTries = 0;
          v2FlushPendingUploads();
          return;
        }
        v2AuthWaitTries += 1;
        if (v2AuthWaitTries >= 20) {
          var waited = v2PendingFiles[0] && v2PendingFiles[0].name;
          v2PendingFiles = [];
          v2PendingUi = [];
          v2AuthWaitTries = 0;
          var clipGiveUp = v2Input('owocni-v2-clip');
          if (clipGiveUp) {
            clipGiveUp.classList.remove('busy');
            clipGiveUp.setAttribute('title', 'Dodaj załącznik');
          }
          v2FailUpload(waited, 'brak uprawnienia. Odśwież kartę (Cmd+Shift+R)');
          v2RenderFiles();
          return;
        }
        setTimeout(function () { v2FlushPendingUploads(); }, 400);
      });
      return;
    }
    v2WaitingAuth = false;
    v2AuthWaitTries = 0;
    var queue = v2PendingFiles.slice();
    v2PendingFiles = [];
    v2PendingUi = queue.map(function (file) {
      return file && file.name ? file.name : 'plik';
    });
    v2SetClipBusy(true);
    v2SetStatus(
      queue.length === 1
        ? ('Trwa załączanie pliku „' + v2PendingUi[0] + '”…')
        : ('Trwa załączanie plików (' + queue.length + ')…'),
      'busy'
    );
    v2RenderFiles();
    var added = [];
    var hadError = false;
    var chain = Promise.resolve();
    queue.forEach(function (file, index) {
      chain = chain.then(function () {
        var label = file && file.name ? file.name : 'plik';
        v2SetStatus('Trwa załączanie pliku „' + label + '”…', 'busy');
        if (!file || file.size <= 0) {
          hadError = true;
          v2FailUpload(label, 'plik jest pusty');
          return;
        }
        if (file.size > maxAttachmentBytes) {
          hadError = true;
          v2FailUpload(label, 'plik jest za duży (max ' + Math.round(maxAttachmentBytes / (1024 * 1024)) + ' MB)');
          return;
        }
        if (v2FileCount() >= maxAttachments) {
          hadError = true;
          v2FailUpload(label, 'maks. ' + maxAttachments + ' załączników');
          return;
        }
        return v2FileToBase64(file).then(function (contentBase64) {
          return v2PostUpload(file, contentBase64, false).then(function (pack) {
            var uploaded = pack.data && pack.data.file;
            if (!pack.okHttp || !uploaded || !uploaded.id) {
              hadError = true;
              var detail = (pack.data && pack.data.error)
                ? pack.data.error
                : ('HTTP ' + (pack.status || '?'));
              v2FailUpload(label, detail);
              return;
            }
            if (!envelope.files) envelope.files = [];
            envelope.files.push({ id: uploaded.id, name: uploaded.name || label });
            added.push(uploaded.name || label);
            v2PendingUi = v2PendingUi.slice(index + 1);
            v2RenderFiles();
            v2UpdateHint();
            v2PersistEnvelope();
          });
        });
      });
    });
    chain.then(function () {
      v2SetClipBusy(false);
      v2PendingUi = [];
      v2RenderFiles();
      if (!hadError && added.length) {
        v2SetStatus(
          added.length === 1
            ? ('Załączono „' + added[0] + '”.')
            : ('Załączono ' + added.length + ' pliki.')
        );
      } else if (!hadError && !added.length) {
        v2SetStatus('Nie odczytano pliku. Spróbuj ponownie.', 'error');
      }
      if (v2PendingFiles.length) v2FlushPendingUploads();
    }).catch(function (err) {
      v2SetClipBusy(false);
      v2PendingUi = [];
      v2RenderFiles();
      v2FailUpload(
        queue[0] && queue[0].name,
        err && err.message ? err.message : 'sieć'
      );
      if (v2PendingFiles.length) v2FlushPendingUploads();
    });
  }

  function v2UploadFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || [], 0);
    if (!files.length) {
      v2SetStatus('Nie odczytano pliku. Spróbuj ponownie.', 'error');
      v2Notify(v2StatusMessage, { error: 'Nie odczytano pliku. Spróbuj ponownie.' });
      return;
    }
    for (var i = 0; i < files.length; i++) v2PendingFiles.push(files[i]);
    v2FlushPendingUploads();
  }

  function v2BindEnvelopeForm() {
    ['owocni-v2-to', 'owocni-v2-cc', 'owocni-v2-bcc', 'owocni-v2-subject'].forEach(function (id) {
      var el = v2Input(id);
      if (!el) return;
      function onEdit() {
        v2MarkDirty(el);
        v2ReadFormIntoEnvelope();
        v2NotifyEnvelopeEdit();
        v2SchedulePersist();
      }
      el.addEventListener('input', onEdit);
      el.addEventListener('change', onEdit);
      el.addEventListener('blur', onEdit);
    });
    var ccToggle = v2Input('owocni-v2-cc-toggle');
    var bccToggle = v2Input('owocni-v2-bcc-toggle');
    var ccRow = v2Input('owocni-v2-cc-row');
    var bccRow = v2Input('owocni-v2-bcc-row');
    if (ccToggle && ccRow) {
      ccToggle.addEventListener('click', function () {
        ccRow.hidden = false;
        v2SyncCopyVisibility();
        var cc = v2Input('owocni-v2-cc');
        if (cc) cc.focus();
      });
    }
    if (bccToggle && bccRow) {
      bccToggle.addEventListener('click', function () {
        bccRow.hidden = false;
        v2SyncCopyVisibility();
        var bcc = v2Input('owocni-v2-bcc');
        if (bcc) bcc.focus();
      });
    }
    var ccHide = v2Input('owocni-v2-cc-hide');
    var bccHide = v2Input('owocni-v2-bcc-hide');
    if (ccHide && ccRow) {
      ccHide.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        ccRow.hidden = true;
        var cc = v2Input('owocni-v2-cc');
        if (cc) {
          cc.value = '';
          v2MarkDirty(cc);
        }
        v2ReadFormIntoEnvelope();
        v2SchedulePersist();
        v2SyncCopyVisibility();
      });
    }
    if (bccHide && bccRow) {
      bccHide.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        bccRow.hidden = true;
        var bcc = v2Input('owocni-v2-bcc');
        if (bcc) {
          bcc.value = '';
          v2MarkDirty(bcc);
        }
        v2ReadFormIntoEnvelope();
        v2SchedulePersist();
        v2SyncCopyVisibility();
      });
    }
    v2SyncCopyVisibility();
    var fileInput = v2Input('owocni-v2-file');
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var picked = Array.prototype.slice.call(fileInput.files || [], 0);
        fileInput.value = '';
        v2UploadFiles(picked);
      });
    }
    v2RenderFiles();
  }

  function v2UpdateHint() {
    var hint = document.getElementById('owocni-v2-hint');
    var clip = v2Input('owocni-v2-clip');
    var fileInput = v2Input('owocni-v2-file');
    if (clip && !v2Uploading && !v2WaitingAuth) {
      clip.classList.remove('busy');
      clip.classList.remove('disabled');
    }
    if (fileInput && !v2Uploading) fileInput.disabled = false;
    if (accessToken && v2PendingFiles.length && !v2Uploading) {
      v2WaitingAuth = false;
      v2FlushPendingUploads();
    }
    if (!hint) return;
    if (!accessToken) {
      hint.textContent = 'Możesz pisać. Uprawnienie do wysyłki dociąga się w tle.';
      return;
    }
    var n = v2FileCount();
    hint.textContent = n
      ? ('Załączniki: ' + n + '. Odliczanie 15 s w tej ramce. Zamknięcie karty nie wysyła.')
      : 'Odliczanie 15 s jest w tej ramce. Zamknięcie karty nie wysyła.';
  }

  function v2MergeEnvelope(next) {
    if (!next || typeof next !== 'object') return;
    var prevFiles = envelope && envelope.files ? envelope.files : [];
    var dirtyTo = v2IsDirty('owocni-v2-to') ? v2InputVal('owocni-v2-to') : null;
    var dirtyCc = v2IsDirty('owocni-v2-cc') ? v2InputVal('owocni-v2-cc') : null;
    var dirtyBcc = v2IsDirty('owocni-v2-bcc') ? v2InputVal('owocni-v2-bcc') : null;
    var dirtySubject = v2IsDirty('owocni-v2-subject') ? v2InputVal('owocni-v2-subject') : null;
    envelope = next;
    if ((!envelope.files || !envelope.files.length) && prevFiles.length) {
      envelope.files = prevFiles;
    }
    if (dirtyTo !== null) envelope.to = dirtyTo;
    if (dirtyCc !== null) envelope.cc = dirtyCc;
    if (dirtyBcc !== null) envelope.bcc = dirtyBcc;
    if (dirtySubject !== null) envelope.subject = dirtySubject;
    v2FillPristineForm();
    v2RenderFiles();
    v2UpdateHint();
  }

  function v2LoadEnvelope(done) {
    if (!draftSaveUrl || !accessToken || !sessionId) {
      done();
      return;
    }
    var attempts = 0;
    function once() {
      attempts += 1;
      try {
        fetch(draftSaveUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + accessToken
          },
          body: JSON.stringify({
            sessionId: envelopeKeyPrefix + sessionId,
            action: 'read'
          })
        }).then(function (res) { return res.json(); }).then(function (data) {
          var raw = data && data.html;
          if (typeof raw === 'string' && raw.trim()) {
            try {
              var parsed = JSON.parse(raw);
              if (parsed && typeof parsed === 'object') {
                var storedFiles = parsed.files;
                if (storedFiles && storedFiles.length) {
                  envelope.files = storedFiles;
                  v2RenderFiles();
                }
              }
            } catch (e) {}
          }
          if (v2FileCount() === 0 && attempts < 3) {
            setTimeout(once, 250);
            return;
          }
          done();
        }).catch(function () {
          if (attempts < 3) {
            setTimeout(once, 250);
            return;
          }
          done();
        });
      } catch (e) {
        done();
      }
    }
    once();
  }

  function v2ShowCountdown(seconds) {
    var sendBtn = document.getElementById('owocni-v2-send');
    var nowBtn = document.getElementById('owocni-v2-now');
    var cancelBtn = document.getElementById('owocni-v2-cancel');
    if (sendBtn) sendBtn.style.display = 'none';
    if (nowBtn) {
      nowBtn.style.display = 'block';
      nowBtn.textContent = 'Wyślij teraz';
    }
    if (cancelBtn) {
      cancelBtn.style.display = 'block';
      cancelBtn.textContent = 'Anuluj (' + seconds + 's)';
    }
  }

  var v2Sending = false;
  var v2Remain = 0;
  var v2Timer = null;
  var v2AttemptId = '';

  function v2NewAttemptId() {
    try {
      if (crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) {}
    return String(sessionId || 'send') + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function v2Hash(html) {
    var hash = 5381;
    var text = String(html || '');
    for (var i = 0; i < text.length; i++) {
      hash = ((hash << 5) + hash) + text.charCodeAt(i);
      hash = hash | 0;
    }
    return (hash >>> 0).toString(16);
  }

  function v2StopTimer() {
    if (v2Timer) { clearInterval(v2Timer); v2Timer = null; }
    v2Remain = 0;
  }

  function v2DoSend() {
    v2AttemptId = v2NewAttemptId();
    v2ReadFormIntoEnvelope();
    v2PersistEnvelope();
    v2LoadEnvelope(function () {
      v2ReadFormIntoEnvelope();
      v2PullAuth(function () {
        v2DoSendBody(false);
      });
    });
  }

  function v2DoSendBody(retried) {
    if (v2Sending) return;
    v2ReadFormIntoEnvelope();
    var html = editor ? editor.innerHTML : '';
    if (!v2Plain(html)) {
      var emptyMsg = 'Treść maila jest pusta (sama stopka, cytat albo placeholder).';
      v2SetStatus(emptyMsg);
      v2Notify(v2StatusMessage, { error: emptyMsg });
      v2SaveStatus('error:' + emptyMsg);
      v2ShowIdle();
      return;
    }
    if (!envelope || !envelope.to) {
      var toMsg = 'Brak adresata.';
      v2SetStatus(toMsg);
      v2Notify(v2StatusMessage, { error: toMsg });
      v2ShowIdle();
      return;
    }
    if (!accessToken) {
      var tokMsg = 'Brak tokenu — odśwież kartę (Cmd+Shift+R).';
      v2SetStatus(tokMsg);
      v2Notify(v2StatusMessage, { error: tokMsg });
      v2ShowIdle();
      return;
    }
    var smsErr = v2SmsReadyError();
    if (smsErr) {
      v2SetStatus(smsErr, 'error');
      v2Notify(v2StatusMessage, { error: smsErr });
      v2ShowIdle();
      return;
    }
    v2Sending = true;
    var fileCount = v2FileCount();
    v2SetStatus(fileCount ? ('Wysyłanie… załączniki: ' + fileCount) : 'Wysyłanie…');
    var body = {
      composerV2: true,
      delayMs: 0,
      editorSessionId: sessionId,
      to: envelope.to,
      cc: envelope.cc,
      bcc: envelope.bcc,
      subject: envelope.subject,
      recordId: envelope.recordId,
      connectedAccountId: envelope.connectedAccountId,
      inReplyToMessageId: envelope.inReplyToMessageId,
      files: envelope.files || [],
      mode: envelope.mode,
      opportunityId: envelope.opportunityId,
      composeDraftKey: envelope.composeDraftKey,
      templateId: envelope.templateId,
      htmlBodyBase64: toBase64(html),
      seedSigPlain: v2SeedSigPlain,
      attemptId: v2AttemptId,
      bodyHash: v2Hash(html),
      revision: 1,
      smsEnabled: v2SmsOpen(),
      smsPhone: v2InputVal('owocni-v2-sms-phone'),
      smsMessage: v2InputVal('owocni-v2-sms-body')
    };
    fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (data) {
        return { okHttp: res.ok, status: res.status, data: data || {} };
      }).catch(function () {
        return { okHttp: res.ok, status: res.status, data: { ok: false, error: 'HTTP ' + res.status } };
      });
    }).then(function (pack) {
      if (pack.status === 401 && !retried) {
        v2PullAuth(function () {
          v2Sending = false;
          v2DoSendBody(true);
        });
        return;
      }
      v2Sending = false;
      if (pack.data && (pack.data.ok || pack.data.alreadySent)) {
        var sms = pack.data.sms;
        if (sms && sms.attempted && !sms.ok) {
          var smsFail = 'Mail wysłany · SMS wymaga sprawdzenia: ' + (sms.error || 'błąd');
          v2SetStatus(smsFail, 'error');
          v2SaveStatus('sent:' + JSON.stringify(pack.data));
          v2Notify(sentMessage, { result: pack.data });
          return;
        }
        v2SetStatus(sms && sms.attempted ? 'Wysłano mail i SMS.' : 'Wysłano.');
        v2SaveStatus('sent:' + JSON.stringify(pack.data));
        v2Notify(sentMessage, { result: pack.data });
        return;
      }
      var err = (pack.data && pack.data.error) || 'Nie udało się wysłać maila.';
      v2SetStatus(err);
      v2SaveStatus('error:' + err);
      v2Notify(v2StatusMessage, { error: err });
      v2ShowIdle();
    }).catch(function (err) {
      v2Sending = false;
      var msg = 'Nie udało się wysłać: ' + (err && err.message ? err.message : 'sieć');
      v2SetStatus(msg);
      v2SaveStatus('error:' + msg);
      v2Notify(v2StatusMessage, { error: msg });
      v2ShowIdle();
    });
  }

  function v2SmsOpen() {
    var panel = document.getElementById('owocni-v2-sms');
    return Boolean(panel && !panel.hidden);
  }

  function v2SetSmsOpen(on) {
    var panel = document.getElementById('owocni-v2-sms');
    var toggle = document.getElementById('owocni-v2-sms-toggle');
    if (panel) panel.hidden = !on;
    if (toggle) {
      toggle.classList.toggle('is-on', Boolean(on));
      toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (on) v2FillPristineForm();
  }

  function v2SmsDigits(value) {
    return String(value || '').replace(/\\D/g, '').replace(/^00/, '');
  }

  function v2SmsPhoneError(raw) {
    var digits = v2SmsDigits(raw);
    if (digits.length === 9) digits = '48' + digits;
    if (digits.length === 11 && digits.indexOf('48') === 0) {
      var first = digits.charAt(2);
      if (first === '5' || first === '6' || first === '7' || first === '8') return '';
    }
    if (!raw) return 'Brak numeru telefonu.';
    return 'Niepoprawny numer. Wpisz 9 cyfr albo +48…';
  }

  function v2SmsReadyError() {
    if (!v2SmsOpen()) return '';
    var phoneErr = v2SmsPhoneError(v2InputVal('owocni-v2-sms-phone'));
    if (phoneErr) return phoneErr;
    if (!v2InputVal('owocni-v2-sms-body')) return 'SMS jest włączony, ale treść jest pusta.';
    return '';
  }

  function v2BindSms() {
    var toggle = document.getElementById('owocni-v2-sms-toggle');
    var templates = document.getElementById('owocni-v2-sms-templates');
    var phone = document.getElementById('owocni-v2-sms-phone');
    var body = document.getElementById('owocni-v2-sms-body');
    if (toggle) {
      toggle.addEventListener('click', function () {
        v2SetSmsOpen(!v2SmsOpen());
      });
    }
    if (phone) {
      phone.addEventListener('input', function () { v2MarkDirty(phone); });
    }
    if (body) {
      body.addEventListener('input', function () { v2MarkDirty(body); });
    }
    if (templates && typeof smsTemplates !== 'undefined') {
      smsTemplates.forEach(function (row) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = row.shortName;
        btn.title = row.name;
        btn.addEventListener('click', function () {
          v2SetSmsOpen(true);
          if (body) {
            body.value = row.body;
            v2MarkDirty(body);
          }
        });
        templates.appendChild(btn);
      });
    }
  }

  function v2StartCountdown() {
    if (v2Sending || v2Timer) return;
    v2ReadFormIntoEnvelope();
    v2LoadEnvelope(function () {
      v2ReadFormIntoEnvelope();
      if (!envelope || !envelope.to) {
        v2SetStatus('Brak adresata.');
        return;
      }
      if (envelope && envelope.canSend === false) {
        v2SetStatus(envelope.sendBlockedReason || 'Nie można wysłać.');
        return;
      }
      var smsErr = v2SmsReadyError();
      if (smsErr) {
        v2SetStatus(smsErr, 'error');
        return;
      }
      v2Remain = 15;
      v2ShowCountdown(v2Remain);
      var n = v2FileCount();
      v2SetStatus(
        (n ? ('Załączniki: ' + n + '. ') : '') +
        'Wysyłka za ' + v2Remain + 's. Zamknięcie karty nie wyśle maila.'
      );
      v2Timer = setInterval(function () {
        v2Remain -= 1;
        if (v2Remain <= 0) {
          v2StopTimer();
          v2DoSend();
          return;
        }
        v2ShowCountdown(v2Remain);
        var count = v2FileCount();
        v2SetStatus(
          (count ? ('Załączniki: ' + count + '. ') : '') +
          'Wysyłka za ' + v2Remain + 's. Zamknięcie karty nie wyśle maila.'
        );
      }, 1000);
    });
  }

  function v2Cancel() {
    v2StopTimer();
    v2ShowIdle();
    v2SetStatus('Anulowano. Mail nie wyszedł.');
  }

  if (composerV2) {
    var sendEl = document.getElementById('owocni-v2-send');
    var nowEl = document.getElementById('owocni-v2-now');
    var cancelEl = document.getElementById('owocni-v2-cancel');
    if (sendEl) sendEl.addEventListener('click', v2StartCountdown);
    if (nowEl) nowEl.addEventListener('click', function () {
      v2StopTimer();
      v2DoSend();
    });
    if (cancelEl) cancelEl.addEventListener('click', v2Cancel);
    v2BindSms();
    v2BindEnvelopeForm();
    v2FillPristineForm();
    v2UpdateHint();
    var authTries = 0;
    var fastAuth = setInterval(function () {
      authTries += 1;
      v2PullAuth(function () {
        if (accessToken || authTries >= 20) {
          clearInterval(fastAuth);
        }
      });
    }, 400);
    setInterval(function () {
      v2PullAuth(function () {});
    }, 20000);
  }
`;
}
