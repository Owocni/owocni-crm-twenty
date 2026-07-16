/**
 * Warstwa B — odcinanie Company freemail (Email Sync auto-mint).
 * company.created / company.updated / person z companyId → unlink People + DELETE Company.
 */
"use strict";

const { isFreeMail, registrableDomain } = require("../shared/isFreeMail");
const {
  twentyRequest,
  parseTwentyListRecords,
  buildTwentyListPath,
} = require("../shared/twentyRest");
const {
  readTwentyStateDoc,
  writeTwentyStateDoc,
} = require("../shared/stapeStore");

const STATE_PREFIX = "freemail_strip_";
const STATE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function makeString(value) {
  return String(value ?? "");
}

function domainFromCompanyRecord(record) {
  if (!record || typeof record !== "object") return "";
  const link =
    (record.domainName && record.domainName.primaryLinkUrl) ||
    record.domainName ||
    "";
  let d = makeString(link)
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./i, "")
    .trim()
    .toLowerCase();
  if (d) return registrableDomain(d) || d;
  const name = makeString(record.name).trim().toLowerCase();
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(name)) {
    return registrableDomain(name.replace(/^www\./, "")) || name;
  }
  return "";
}

function extractCompanyId(record, payload) {
  if (!record) return "";
  if (record.companyId) return makeString(record.companyId);
  if (record.company && record.company.id) return makeString(record.company.id);
  return makeString(payload?.id || record.id || "");
}

async function fetchCompany(companyId) {
  const res = await twentyRequest(
    "GET",
    `/companies/${encodeURIComponent(companyId)}`,
  );
  if (res.statusCode === 404) return null;
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`GET company HTTP ${res.statusCode} ${res.rawBody}`);
  }
  const data = res.body?.data || res.body || {};
  return data.company || data || null;
}

async function listPeopleForCompany(companyId) {
  const filter = `companyId[eq]:${companyId}`;
  const path = buildTwentyListPath("people", filter, 60);
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`LIST people HTTP ${res.statusCode} ${res.rawBody}`);
  }
  return parseTwentyListRecords("people", res.body);
}

async function unlinkPersonCompany(personId) {
  const res = await twentyRequest(
    "PATCH",
    `/people/${encodeURIComponent(personId)}`,
    { companyId: null },
  );
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(
      `PATCH person ${personId} HTTP ${res.statusCode} ${res.rawBody}`,
    );
  }
}

async function deleteCompany(companyId) {
  const res = await twentyRequest(
    "DELETE",
    `/companies/${encodeURIComponent(companyId)}`,
  );
  if (res.statusCode === 404) return { ok: true, alreadyGone: true };
  if (res.statusCode < 200 || res.statusCode >= 300) {
    return {
      ok: false,
      error: `HTTP ${res.statusCode} ${res.rawBody}`.slice(0, 300),
    };
  }
  return { ok: true };
}

async function stripCompanyIfFreemail(companyId, companyRecord) {
  if (!companyId) {
    return { status: "skipped", reason: "no_company_id" };
  }

  const stateKey = STATE_PREFIX + companyId;
  const prev = await readTwentyStateDoc(stateKey);
  if (prev && prev.stripped === true) {
    const stillFresh =
      !prev.expires_at || Number(prev.expires_at) > Date.now();
    if (stillFresh) {
      console.log("FREEMAIL_STRIP: SKIP_IDEMPOTENT", companyId);
      return { status: "skipped", reason: "already_stripped" };
    }
  }

  let record = companyRecord;
  if (!record || !domainFromCompanyRecord(record)) {
    record = await fetchCompany(companyId);
  }
  if (!record) {
    console.log("FREEMAIL_STRIP: COMPANY_GONE", companyId);
    return { status: "skipped", reason: "company_not_found" };
  }

  const domain = domainFromCompanyRecord(record);
  if (!domain || !isFreeMail(domain)) {
    console.log("FREEMAIL_STRIP: NOT_FREEMAIL", companyId, domain || "(empty)");
    return { status: "skipped", reason: "not_freemail", domain };
  }

  console.log("FREEMAIL_STRIP: START", companyId, domain);
  const people = await listPeopleForCompany(companyId);
  let unlinked = 0;
  for (const person of people) {
    if (!person || !person.id) continue;
    await unlinkPersonCompany(person.id);
    unlinked += 1;
  }

  const del = await deleteCompany(companyId);
  await writeTwentyStateDoc(stateKey, {
    stripped: true,
    domain,
    unlinked,
    deleted: del.ok === true,
    delete_error: del.error || null,
    expires_at: Date.now() + STATE_TTL_MS,
    updated_at: Date.now(),
  });

  if (!del.ok) {
    console.log(
      "FREEMAIL_STRIP: UNLINKED_DELETE_FAIL",
      companyId,
      del.error,
    );
    return {
      status: "partial",
      reason: "unlink_ok_delete_fail",
      domain,
      unlinked,
      error: del.error,
    };
  }

  console.log("FREEMAIL_STRIP: DONE", companyId, "unlinked=", unlinked);
  return {
    status: "stripped",
    domain,
    unlinked,
    deleted: true,
  };
}

/**
 * @param {object} parsed — wynik parseTwentyPayload (rozszerzony o companyId / companyRecord)
 * @param {object} options
 */
async function processFreemailCompanyStrip(parsed, options = {}) {
  const objectType = makeString(parsed && parsed.objectType).toLowerCase();
  const eventName = makeString(parsed && parsed.eventNamePlatform).toLowerCase();

  if (objectType === "company" || eventName.indexOf("company.") === 0) {
    const companyId = parsed.companyId || parsed.opportunityId || "";
    return stripCompanyIfFreemail(companyId, parsed._companyRecord || null);
  }

  if (objectType === "person" || eventName.indexOf("person.") === 0) {
    const companyId = parsed.personCompanyId || "";
    if (!companyId) {
      return { status: "skipped", reason: "person_no_company" };
    }
    return stripCompanyIfFreemail(companyId, null);
  }

  return { status: "skipped", reason: "not_company_or_person" };
}

module.exports = {
  processFreemailCompanyStrip,
  stripCompanyIfFreemail,
  domainFromCompanyRecord,
};
