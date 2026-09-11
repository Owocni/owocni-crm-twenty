export const EMPTY_EDITOR_BODY = '<p><br></p>';
export const MAIL_FLUSH = 'owocni-mail-flush';
export const MAIL_SET_AUTH = 'owocni-mail-set-auth';
export const MAIL_SET_HTML = 'owocni-mail-set-html';
export const MAIL_EXEC = 'owocni-mail-exec';

export function sanitizeEditorBodyHtml(html: string): string {
  return html
    .replace(/<\/body>/gi, '')
    .replace(/<body\b[^>]*>/gi, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?script\b[^>]*>/gi, '');
}

/** http(s) / mailto only. Bare domains get https://. javascript: is rejected. */
export function normalizeEditorLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (/[\s<>"]/.test(trimmed)) {
    return null;
  }

  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return null;
  }

  if (/^mailto:/i.test(trimmed)) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  if (/^www\./i.test(trimmed) || /^[^\s/]+\.[^\s]+/.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return null;
}

export const EDITOR_FONT_SIZES = [
  { label: '12', value: '12px' },
  { label: '13', value: '13px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '24', value: '24px' },
] as const;

type BuildVisualEditorSrcDocParams = {
  bodyHtml: string;
  sessionId: string;
  draftSaveUrl: string;
  accessToken: string;
  durableSessionId?: string;
};

export const EDITOR_TEXT_COLORS = [
  { label: 'Czarny', value: '#222222' },
  { label: 'Zielony', value: '#008000' },
  { label: 'Zieleń Owocni', value: '#38761d' },
  { label: 'Szary', value: '#808080' },
  { label: 'Niebieski', value: '#1155cc' },
] as const;

function toolbarHtml(): string {
  const sizes = EDITOR_FONT_SIZES.map(
    (size) =>
      `<option value="${size.value}">${size.label}</option>`,
  ).join('');
  const colors = EDITOR_TEXT_COLORS.map(
    (color) =>
      `<button type="button" data-cmd="foreColor" data-arg="${color.value}" title="${color.label}" aria-label="${color.label}"><span class="owocni-swatch" style="background:${color.value}"></span></button>`,
  ).join('');

  return `
<div id="owocni-toolbar">
  <button type="button" data-cmd="bold" title="Pogrubienie"><b>B</b></button>
  <button type="button" data-cmd="italic" title="Kursywa"><i>I</i></button>
  <button type="button" data-cmd="underline" title="Podkreślenie"><u>U</u></button>
  <select data-cmd="fontSize" title="Rozmiar tekstu" aria-label="Rozmiar tekstu">
    <option value="">Rozmiar</option>
    ${sizes}
  </select>
  ${colors}
  <label class="owocni-color" title="Dowolny kolor tekstu">
    <input type="color" data-cmd="foreColor" value="#008000" aria-label="Kolor tekstu">
  </label>
  <button type="button" data-cmd="insertUnorderedList" title="Lista punktowana">•</button>
  <button type="button" data-cmd="insertOrderedList" title="Lista numerowana">1.</button>
  <button type="button" data-cmd="createLink" title="Wstaw lub edytuj link">Link</button>
</div>
<div id="owocni-link-bar" hidden>
  <input id="owocni-link-url" type="text" placeholder="https://… lub mailto:osoba@firma.pl" autocomplete="off">
  <button type="button" id="owocni-link-ok">Wstaw</button>
  <button type="button" id="owocni-link-remove">Usuń</button>
  <button type="button" id="owocni-link-cancel">Anuluj</button>
</div>`;
}

export function buildVisualEditorSrcDoc({
  bodyHtml,
  sessionId,
  draftSaveUrl,
  accessToken,
  durableSessionId = '',
}: BuildVisualEditorSrcDocParams): string {
  const content = sanitizeEditorBodyHtml(
    bodyHtml.trim() || EMPTY_EDITOR_BODY,
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <base target="_blank">
  <style>
    html, body {
      margin: 0; padding: 0; height: 100%; overflow: hidden; background: #fff;
    }
    body {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      font-family: Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      color: #222;
    }
    #owocni-toolbar {
      display: flex;
      gap: 4px;
      align-items: center;
      flex-wrap: wrap;
      flex-shrink: 0;
      padding: 6px 8px;
      border-bottom: 1px solid #eee;
      background: #fafafa;
    }
    #owocni-toolbar button,
    #owocni-toolbar select {
      min-width: 28px;
      height: 28px;
      padding: 0 6px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: #fff;
      color: #333;
      font-size: 13px;
      cursor: pointer;
    }
    #owocni-toolbar select { min-width: 88px; font-size: 12px; }
    #owocni-toolbar .owocni-swatch {
      display: block;
      width: 14px;
      height: 14px;
      margin: 6px auto;
      border-radius: 2px;
      border: 1px solid rgba(0,0,0,0.15);
    }
    #owocni-toolbar .owocni-color {
      display: inline-flex;
      align-items: center;
      height: 28px;
      margin: 0;
    }
    #owocni-toolbar input[type="color"] {
      width: 32px;
      height: 28px;
      padding: 2px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: #fff;
      cursor: pointer;
    }
    #owocni-link-bar {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
      flex-shrink: 0;
      padding: 6px 8px;
      border-bottom: 1px solid #eee;
      background: #f8fafc;
    }
    #owocni-link-bar[hidden] { display: none !important; }
    #owocni-link-url {
      flex: 1;
      min-width: 160px;
      height: 28px;
      padding: 0 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
    }
    #owocni-link-bar button {
      height: 28px;
      padding: 0 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: #fff;
      font-size: 12px;
      cursor: pointer;
    }
    #owocni-link-ok { background: #eef2ff; border-color: #6366f1; color: #3730a3; font-weight: 600; }
    #editor {
      box-sizing: border-box;
      flex: 1;
      min-height: 0;
      padding: 12px;
      outline: none;
      overflow-x: hidden;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      caret-color: #222;
    }
    #editor p { margin: 0 0 0.75em; }
    #editor ul, #editor ol { margin: 0 0 0.75em; padding-left: 1.5em; }
    #editor a { color: #1155cc; text-decoration: underline; }
  </style>
</head>
<body>
${toolbarHtml()}
<div id="editor" contenteditable="true">${content}</div>
<script>
(function () {
  var sessionId = ${JSON.stringify(sessionId)};
  var durableSessionId = ${JSON.stringify(durableSessionId)};
  var draftSaveUrl = ${JSON.stringify(draftSaveUrl)};
  var accessToken = ${JSON.stringify(accessToken)};
  var flushMessage = ${JSON.stringify(MAIL_FLUSH)};
  var setAuthMessage = ${JSON.stringify(MAIL_SET_AUTH)};
  var setHtmlMessage = ${JSON.stringify(MAIL_SET_HTML)};
  var execMessage = ${JSON.stringify(MAIL_EXEC)};
  var emptyBody = ${JSON.stringify(EMPTY_EDITOR_BODY)};
  var editor = document.getElementById('editor');
  var toolbar = document.getElementById('owocni-toolbar');
  var linkBar = document.getElementById('owocni-link-bar');
  var linkUrl = document.getElementById('owocni-link-url');
  var saveTimer;
  var lastSaved = '';
  var savedRange = null;
  var applying = false;

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

  function editorHtml() {
    return editor ? editor.innerHTML : '';
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
          durableSessionId: durableSessionId || undefined,
          htmlBase64: toBase64(html),
          html: String(html).slice(0, 50000)
        })
      }).catch(function () {});
    } catch (e) {}
  }

  function publishHtml() {
    saveDraftToServer(editorHtml());
  }

  function schedulePublish() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = undefined;
      publishHtml();
    }, 120);
  }

  function rememberSelection(allowCollapsed) {
    try {
      if (applying) return;
      var sel = document.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      var range = sel.getRangeAt(0);
      if (!allowCollapsed && range.collapsed) return;
      savedRange = range.cloneRange();
    } catch (e) {}
  }

  function restoreSelection() {
    if (!savedRange || !editor) return;
    try {
      editor.focus();
      var sel = document.getSelection();
      if (!sel) return;
      sel.removeAllRanges();
      sel.addRange(savedRange);
    } catch (e) {}
  }

  function wrapSelection(tagName, styleName, styleValue) {
    var sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    var range = sel.getRangeAt(0);
    if (range.collapsed) return false;
    try {
      var node = document.createElement(tagName);
      if (styleName && styleValue) node.style[styleName] = styleValue;
      node.appendChild(range.extractContents());
      range.insertNode(node);
      sel.removeAllRanges();
      var next = document.createRange();
      next.selectNodeContents(node);
      sel.addRange(next);
      savedRange = next.cloneRange();
      return true;
    } catch (e) {
      return false;
    }
  }

  function applyFontSize(px) {
    var ok = false;
    try {
      ok = document.execCommand('fontSize', false, '7');
    } catch (e) {}
    if (ok) {
      var fonts = editor.querySelectorAll('font[size="7"]');
      for (var i = 0; i < fonts.length; i++) {
        var el = fonts[i];
        var span = document.createElement('span');
        span.style.fontSize = px;
        while (el.firstChild) span.appendChild(el.firstChild);
        if (el.parentNode) el.parentNode.replaceChild(span, el);
      }
      var huge = editor.querySelectorAll('span[style*="xxx-large"], span[style*="xx-large"]');
      for (var j = 0; j < huge.length; j++) {
        huge[j].style.fontSize = px;
      }
    }
    if (!ok) wrapSelection('span', 'fontSize', px);
  }

  function closestLink(node) {
    while (node && node !== editor) {
      if (node.nodeType === 1 && node.nodeName === 'A') return node;
      node = node.parentNode;
    }
    return null;
  }

  function currentLink() {
    try {
      var sel = document.getSelection();
      var node = sel && sel.anchorNode;
      if (!node && savedRange) node = savedRange.commonAncestorContainer;
      if (node && node.nodeType === 3) node = node.parentElement;
      return closestLink(node);
    } catch (e) {
      return null;
    }
  }

  function normalizeLinkUrl(raw) {
    var trimmed = String(raw || '').trim();
    if (!trimmed || /[\\s<>"]/.test(trimmed)) return null;
    if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return null;
    if (/^mailto:/i.test(trimmed)) return trimmed;
    if (/^https?:\\/\\//i.test(trimmed)) return trimmed;
    if (trimmed.indexOf('//') === 0) return 'https:' + trimmed;
    if (/^www\\./i.test(trimmed) || /^[^\\s/]+\\.[^\\s]+/.test(trimmed)) {
      return 'https://' + trimmed;
    }
    return null;
  }

  function decorateLink(anchor) {
    if (!anchor) return;
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
  }

  function applyLink(raw) {
    var href = normalizeLinkUrl(raw);
    if (!href) return false;
    restoreSelection();
    var existing = currentLink();
    if (existing) {
      existing.setAttribute('href', href);
      decorateLink(existing);
      return true;
    }
    var sel = document.getSelection();
    var collapsed = !sel || sel.rangeCount === 0 || sel.getRangeAt(0).collapsed;
    if (collapsed) {
      var a = document.createElement('a');
      a.setAttribute('href', href);
      a.textContent = href.replace(/^https?:\\/\\//i, '');
      decorateLink(a);
      var range = savedRange;
      if (range) {
        range.insertNode(a);
        sel = document.getSelection();
        if (sel) {
          sel.removeAllRanges();
          var next = document.createRange();
          next.selectNodeContents(a);
          sel.addRange(next);
          savedRange = next.cloneRange();
        }
      } else {
        editor.appendChild(a);
      }
      return true;
    }
    var ok = false;
    try { ok = document.execCommand('createLink', false, href); } catch (e) {}
    if (!ok) {
      var wrapped = wrapSelection('a');
      var created = currentLink();
      if (created) {
        created.setAttribute('href', href);
        decorateLink(created);
        return true;
      }
      return wrapped;
    }
    var links = editor.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) decorateLink(links[i]);
    return true;
  }

  function removeLink() {
    restoreSelection();
    var existing = currentLink();
    if (existing && existing.parentNode) {
      while (existing.firstChild) existing.parentNode.insertBefore(existing.firstChild, existing);
      existing.parentNode.removeChild(existing);
      return;
    }
    try { document.execCommand('unlink', false); } catch (e) {}
  }

  function closeLinkBar() {
    if (linkBar) linkBar.hidden = true;
  }

  function openLinkBar() {
    rememberSelection(true);
    var existing = currentLink();
    if (linkUrl) linkUrl.value = existing ? (existing.getAttribute('href') || '') : '';
    if (linkBar) linkBar.hidden = false;
    setTimeout(function () {
      try { if (linkUrl) linkUrl.focus(); } catch (e) {}
    }, 0);
  }

  function submitLink() {
    var raw = linkUrl ? linkUrl.value : '';
    if (!normalizeLinkUrl(raw)) {
      try { if (linkUrl) linkUrl.focus(); } catch (e) {}
      return;
    }
    applying = true;
    try {
      applyLink(raw);
    } finally {
      applying = false;
    }
    closeLinkBar();
    rememberSelection(true);
    publishHtml();
  }

  function submitUnlink() {
    applying = true;
    try {
      removeLink();
    } finally {
      applying = false;
    }
    closeLinkBar();
    rememberSelection(true);
    publishHtml();
  }

  function runCommand(command, arg) {
    if (command === 'createLink') {
      openLinkBar();
      return;
    }
    applying = true;
    try {
      restoreSelection();
      if (command === 'fontSize' && arg) {
        applyFontSize(arg);
      } else {
        var ok = false;
        try {
          if (arg == null || arg === '') {
            ok = document.execCommand(command, false);
          } else {
            ok = document.execCommand(command, false, arg);
          }
        } catch (e) {}
        if (!ok) {
          if (command === 'bold') wrapSelection('strong');
          else if (command === 'italic') wrapSelection('em');
          else if (command === 'underline') wrapSelection('u');
          else if (command === 'foreColor' && arg) wrapSelection('span', 'color', arg);
          else if (command === 'hiliteColor' && arg) wrapSelection('span', 'backgroundColor', arg);
        }
      }
    } finally {
      applying = false;
    }
    rememberSelection(true);
    publishHtml();
  }

  document.addEventListener('selectionchange', function () {
    if (linkBar && !linkBar.hidden) return;
    rememberSelection(false);
  });
  editor.addEventListener('mouseup', function () { rememberSelection(true); });
  editor.addEventListener('keyup', function () { rememberSelection(true); schedulePublish(); });
  editor.addEventListener('input', schedulePublish);
  editor.addEventListener('blur', publishHtml);

  function caretClientRect() {
    try {
      var sel = document.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      var range = sel.getRangeAt(0).cloneRange();
      range.collapse(false);
      var rect = range.getBoundingClientRect();
      if (rect && (rect.height || rect.width || rect.top || rect.bottom)) return rect;
      var marker = document.createElement('span');
      marker.appendChild(document.createTextNode('\u200b'));
      range.insertNode(marker);
      rect = marker.getBoundingClientRect();
      if (marker.parentNode) marker.parentNode.removeChild(marker);
      return rect;
    } catch (e) {
      return null;
    }
  }

  function scrollCaretIntoEditor() {
    var rect = caretClientRect();
    if (!rect || !editor) return;
    try {
      var editorRect = editor.getBoundingClientRect();
      var padding = 24;
      if (rect.bottom > editorRect.bottom - padding) {
        editor.scrollTop += rect.bottom - editorRect.bottom + padding;
      } else if (rect.top < editorRect.top + padding) {
        editor.scrollTop -= editorRect.top - rect.top + padding;
      }
    } catch (e) {}
  }

  editor.addEventListener('paste', function () {
    var frames = 0;
    function followPasteCaret() {
      scrollCaretIntoEditor();
      rememberSelection(true);
      frames += 1;
      if (frames < 8) {
        try { requestAnimationFrame(followPasteCaret); } catch (e2) {}
      }
    }
    setTimeout(followPasteCaret, 0);
    schedulePublish();
  });

  function eventEl(event) {
    var el = event.target;
    if (el && el.nodeType === 3) el = el.parentElement;
    return el;
  }

  toolbar.addEventListener('mousedown', function (event) {
    var el = eventEl(event);
    if (el && el.closest && (el.closest('select') || el.closest('input[type=color]'))) {
      rememberSelection(true);
      return;
    }
    event.preventDefault();
  });
  toolbar.addEventListener('click', function (event) {
    var el = eventEl(event);
    var btn = el && el.closest ? el.closest('button[data-cmd]') : null;
    if (!btn) return;
    event.preventDefault();
    runCommand(btn.getAttribute('data-cmd'), btn.getAttribute('data-arg'));
  });
  if (linkBar) {
    linkBar.addEventListener('mousedown', function (event) {
      var el = eventEl(event);
      if (el && el.closest && el.closest('input')) return;
      event.preventDefault();
    });
    var okBtn = document.getElementById('owocni-link-ok');
    var removeBtn = document.getElementById('owocni-link-remove');
    var cancelBtn = document.getElementById('owocni-link-cancel');
    if (okBtn) okBtn.addEventListener('click', function (event) {
      event.preventDefault();
      submitLink();
    });
    if (removeBtn) removeBtn.addEventListener('click', function (event) {
      event.preventDefault();
      submitUnlink();
    });
    if (cancelBtn) cancelBtn.addEventListener('click', function (event) {
      event.preventDefault();
      closeLinkBar();
    });
  }
  toolbar.addEventListener('change', function (event) {
    var el = event.target;
    if (!el) return;
    var cmd = el.getAttribute('data-cmd');
    if (cmd === 'fontSize') {
      var value = el.value;
      el.value = '';
      if (value) runCommand('fontSize', value);
      return;
    }
    if (cmd === 'foreColor' || cmd === 'hiliteColor') {
      if (el.value) runCommand(cmd, el.value);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (linkBar && !linkBar.hidden && event.target === linkUrl) {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitLink();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeLinkBar();
      }
      return;
    }
    var mod = event.metaKey || event.ctrlKey;
    if (mod && !event.altKey && String(event.key || '').toLowerCase() === 'k') {
      if (editor.contains(event.target) || event.target === editor) {
        event.preventDefault();
        event.stopPropagation();
        openLinkBar();
      }
      return;
    }
    if (!editor.contains(event.target) && event.target !== editor) return;
    if (!mod || event.altKey) return;
    var key = String(event.key || '').toLowerCase();
    var command = key === 'b' ? 'bold' : key === 'i' ? 'italic' : key === 'u' ? 'underline' : '';
    if (!command) return;
    event.preventDefault();
    event.stopPropagation();
    runCommand(command, null);
  });

  try {
    document.execCommand('styleWithCSS', false, 'true');
  } catch (e) {}

  new MutationObserver(schedulePublish).observe(editor, {
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
      editor.innerHTML = event.data.html.trim() ? event.data.html : emptyBody;
      publishHtml();
      return;
    }
    if (event.data.type === execMessage && typeof event.data.command === 'string') {
      runCommand(event.data.command, event.data.arg);
    }
  });

  publishHtml();
})();
</script>
</body>
</html>`;
}
