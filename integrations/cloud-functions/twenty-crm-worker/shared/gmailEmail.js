"use strict";

/**
 * Gmail treats dots (and +tags) in the local-part as the same mailbox.
 * Twenty IMAP matches Person.emails exactly — so kamildnp@gmail.com
 * and kamil.dnp@gmail.com become two People unless we look up / store both.
 * IDENTITY §5.8.1: canonical form is the index key; CRM primary stays as typed.
 */

function displayEmail(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  const at = s.lastIndexOf("@");
  if (at < 1 || s.indexOf("@") !== at) return "";
  let local = s.slice(0, at);
  let domain = s.slice(at + 1);
  if (!local || !domain) return "";
  if (domain === "googlemail.com") domain = "gmail.com";
  return `${local}@${domain}`;
}

function canonicalEmail(raw) {
  const display = displayEmail(raw);
  if (!display) return "";
  const at = display.lastIndexOf("@");
  let local = display.slice(0, at);
  const domain = display.slice(at + 1);
  if (domain !== "gmail.com") return display;
  local = local.split("+")[0].replace(/\./g, "");
  if (!local) return "";
  return `${local}@${domain}`;
}

function emailLookupKeys(raw) {
  const keys = [];
  const display = displayEmail(raw);
  const canon = canonicalEmail(raw);
  if (display) keys.push(display);
  if (canon && canon !== display) keys.push(canon);
  return keys;
}

function twentyEmailsFields(raw, existingAdditional, existingPrimary) {
  const display = displayEmail(raw);
  if (!display) return null;
  const extra = new Set();
  const canon = canonicalEmail(raw);
  if (canon && canon !== display) extra.add(canon);
  const prev = displayEmail(existingPrimary);
  if (prev && prev !== display) extra.add(prev);
  const extraList = Array.isArray(existingAdditional)
    ? existingAdditional
    : [];
  for (const item of extraList) {
    const d = displayEmail(typeof item === "string" ? item : item?.email);
    if (d && d !== display) extra.add(d);
  }
  return {
    primaryEmail: display,
    additionalEmails: [...extra],
  };
}

function preferPersonId(opts) {
  const existingPersonId = String(opts.existingPersonId || "").trim();
  const aliasPersonId = String(opts.aliasPersonId || "").trim();
  const aliasHasOpenOpp = Boolean(opts.aliasHasOpenOpp);
  const existingHasOpenOpp = Boolean(opts.existingHasOpenOpp);
  if (
    aliasPersonId &&
    aliasHasOpenOpp &&
    aliasPersonId !== existingPersonId &&
    !existingHasOpenOpp
  ) {
    return aliasPersonId;
  }
  if (existingPersonId) return existingPersonId;
  if (aliasPersonId) return aliasPersonId;
  return "";
}

module.exports = {
  displayEmail,
  canonicalEmail,
  emailLookupKeys,
  twentyEmailsFields,
  preferPersonId,
};
