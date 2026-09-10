"use strict";

/**
 * DSN / bounce (zwrotka). Nie mylić z odpowiedzią klienta ani z Autoreply.
 *
 * Match na kartę: nieudany adres z treści DSN → Person / bizCardEmail.
 * Nadawca to mailer-daemon, więc native linking Twenty tego nie zrobi.
 */

const INTERNAL_DOMAIN = "@owocni.pl";

const BOUNCE_SUBJECT_RE =
  /undelivered mail|mail delivery failed|delivery status notification|returned mail|undeliverable|failure notice|niedostarcz|nie dostarczono|mail delivery subsystem|delivery failure/i;

const DSN_BODY_RE =
  /mail delivery software|this is the mail system at|could not be delivered|address\(es\) failed|recipient address rejected|user unknown|unknown user|mailbox unavailable|final-recipient:|diagnostic-code:|retry timeout exceeded|550\s*5\.1\.1|550\s*5\.1\.0|status:\s*5\.\d\.\d|host .+ said:\s*5/i;

const EMAIL_RE = /[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi;

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .replace(/^<|>$/g, "");
}

function isBounceSender(handle, displayName) {
  const h = normalizeEmail(handle);
  const d = String(displayName || "").toLowerCase();
  if (h.includes("mailer-daemon")) return true;
  if (d.includes("mail delivery")) return true;
  if (h.startsWith("postmaster@")) {
    return !d || d.includes("postmaster") || d.includes("mail delivery");
  }
  return false;
}

function isBounceSubject(subject) {
  return BOUNCE_SUBJECT_RE.test(String(subject || ""));
}

function isDsnBody(text) {
  return DSN_BODY_RE.test(String(text || ""));
}

function isBounceMessage({ subject, text, fromHandle, fromDisplayName } = {}) {
  const sender = isBounceSender(fromHandle, fromDisplayName);
  const subj = isBounceSubject(subject);
  const body = isDsnBody(text);
  if (sender && (subj || body)) return true;
  if (subj && body) return true;
  return false;
}

function isIgnoredBounceAddress(email) {
  const n = normalizeEmail(email);
  if (!n || !n.includes("@")) return true;
  if (n.includes("mailer-daemon")) return true;
  if (n.startsWith("postmaster@")) return true;
  if (n.includes(INTERNAL_DOMAIN)) return true;
  if (n.endsWith("@form2020.owocni.pl")) return true;
  if (n.startsWith("noreply@") || n.startsWith("no-reply@")) return true;
  return false;
}

function pushUniqueEmail(list, raw) {
  const n = normalizeEmail(raw);
  if (!n || isIgnoredBounceAddress(n) || list.includes(n)) return;
  list.push(n);
}

function extractBouncedRecipients(text) {
  const raw = String(text || "");
  const found = [];

  for (const match of raw.matchAll(
    /Final-Recipient:\s*(?:rfc822;)?\s*([^\s;>]+)/gi,
  )) {
    pushUniqueEmail(found, match[1]);
  }
  for (const match of raw.matchAll(
    /Original-Recipient:\s*(?:rfc822;)?\s*([^\s;>]+)/gi,
  )) {
    pushUniqueEmail(found, match[1]);
  }
  for (const match of raw.matchAll(/X-Failed-Recipients:\s*([^\s,;]+)/gi)) {
    pushUniqueEmail(found, match[1]);
  }
  for (const match of raw.matchAll(
    /<([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})>\s*:/gi,
  )) {
    pushUniqueEmail(found, match[1]);
  }

  const failedIdx = raw.toLowerCase().indexOf("address(es) failed");
  if (failedIdx >= 0) {
    const slice = raw.slice(failedIdx, failedIdx + 500);
    for (const match of slice.matchAll(EMAIL_RE)) {
      pushUniqueEmail(found, match[0]);
    }
  }

  if (!found.length) {
    for (const match of raw.matchAll(EMAIL_RE)) {
      pushUniqueEmail(found, match[0]);
    }
  }

  return found;
}

function classifyBounceReason(text) {
  const raw = String(text || "");
  if (
    /over quota|mailbox full|insufficient storage|quota exceeded|5\.2\.2|retry timeout exceeded/i.test(
      raw,
    )
  ) {
    return "undelivered";
  }
  if (
    /user unknown|unknown user|mailbox unavailable|recipient address rejected|invalid recipient|does not exist|nie istnieje|no such user|user not found|unrouteable|unroutable|no route to host|host not found|domain not found|status:\s*5\.1\.[01]|550\s*5\.1\.[01]/i.test(
      raw,
    )
  ) {
    return "invalid";
  }
  return "undelivered";
}

function bounceFollowUpLabel(reason) {
  return reason === "invalid"
    ? "Zwrotka · niepoprawny adres"
    : "Zwrotka · nie dostarczono";
}

module.exports = {
  INTERNAL_DOMAIN,
  normalizeEmail,
  isBounceSender,
  isBounceSubject,
  isDsnBody,
  isBounceMessage,
  isIgnoredBounceAddress,
  extractBouncedRecipients,
  classifyBounceReason,
  bounceFollowUpLabel,
};
