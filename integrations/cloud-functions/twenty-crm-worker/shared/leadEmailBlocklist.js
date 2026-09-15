"use strict";

/**
 * Emails / domains that must never mint Person + Opportunity via createLead.
 *
 * Append here, then deploy twenty-crm-worker. Syntax:
 *   artur@maxseo.pl  — exact address (case-insensitive; Gmail dots/+tags folded)
 *   @maxseo.pl       — whole domain
 *
 * Hot-add without a code change: env LEAD_EMAIL_BLOCKLIST (comma-separated,
 * same syntax). Twenty Settings → Accounts → Blocklist still needed for
 * Email Sync; this list is the form / Meta / leads@ write gate.
 */

const { emailLookupKeys } = require("./gmailEmail");

const LEAD_EMAIL_BLOCKLIST = [
  "artur@maxseo.pl",
];

function normalizeHandle(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase();
}

function splitEnvHandles(raw) {
  return String(raw || "")
    .split(/[,;\s]+/)
    .map(normalizeHandle)
    .filter(Boolean);
}

function getLeadEmailBlocklist(extra) {
  const extras = Array.isArray(extra)
    ? extra.map(normalizeHandle).filter(Boolean)
    : splitEnvHandles(
        extra !== undefined ? extra : process.env.LEAD_EMAIL_BLOCKLIST,
      );
  return [...new Set([...LEAD_EMAIL_BLOCKLIST.map(normalizeHandle), ...extras])];
}

function emailDomain(email) {
  const keys = emailLookupKeys(email);
  if (!keys.length) return "";
  const at = keys[0].lastIndexOf("@");
  return at > 0 ? keys[0].slice(at + 1) : "";
}

function matchBlockedHandle(email, handles) {
  const keys = emailLookupKeys(email);
  if (!keys.length) return "";
  const domain = emailDomain(email);
  for (const handle of handles) {
    if (!handle) continue;
    if (handle.startsWith("@")) {
      if (domain && domain === handle.slice(1)) return handle;
      continue;
    }
    const handleKeys = emailLookupKeys(handle);
    for (const key of keys) {
      if (handleKeys.includes(key)) return handle;
    }
  }
  return "";
}

function collectTaskEmails(taskData) {
  const data = taskData && typeof taskData === "object" ? taskData : {};
  const answers =
    data.biz_form_answers || data.form_answers || data.answers || {};
  const fromAnswers =
    answers && typeof answers === "object"
      ? [answers.email, answers.mail, answers.e_mail]
      : [];
  return [data.biz_email, data.email, ...fromAnswers];
}

function findBlockedLeadEmail(emails, extra) {
  const handles = getLeadEmailBlocklist(extra);
  for (const email of emails || []) {
    const matched = matchBlockedHandle(email, handles);
    if (matched) return { email: String(email).trim(), handle: matched };
  }
  return null;
}

function isEmailOnLeadBlocklist(email, extra) {
  return Boolean(findBlockedLeadEmail([email], extra));
}

function isLeadEmailBlocked(taskData, extra) {
  return Boolean(findBlockedLeadEmail(collectTaskEmails(taskData), extra));
}

module.exports = {
  LEAD_EMAIL_BLOCKLIST,
  getLeadEmailBlocklist,
  matchBlockedHandle,
  findBlockedLeadEmail,
  isEmailOnLeadBlocklist,
  isLeadEmailBlocked,
  collectTaskEmails,
};
