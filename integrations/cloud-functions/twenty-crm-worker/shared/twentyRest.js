"use strict";

const { getTwentyConfig } = require("./config");

async function twentyRequest(method, path, body) {
  const cfg = getTwentyConfig();
  const url = `${cfg.restUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
      "User-Agent": "owocni-twenty-crm-worker/1.0",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  return { statusCode: res.status, body: parsed, rawBody: text };
}

function parseTwentyListRecords(collection, responseBody) {
  const data = responseBody?.data || {};
  if (Array.isArray(data[collection])) {
    return data[collection];
  }
  return [];
}

function extractCreatedId(collection, responseBody) {
  const data = responseBody?.data || {};
  let createKey =
    "create" + collection.charAt(0).toUpperCase() + collection.slice(1, -1);
  if (collection === "people") createKey = "createPerson";
  if (collection === "opportunities") createKey = "createOpportunity";
  if (collection === "messageThreads") createKey = "createMessageThread";
  if (collection === "messages") createKey = "createMessage";
  if (collection === "messageParticipants") createKey = "createMessageParticipant";
  if (collection === "notes") createKey = "createNote";
  if (collection === "noteTargets") createKey = "createNoteTarget";
  if (collection === "timelineActivities") createKey = "createTimelineActivity";
  const singularGuess = collection.endsWith("ies")
    ? collection.slice(0, -3) + "y"
    : collection.endsWith("s")
      ? collection.slice(0, -1)
      : collection;
  const record =
    data[createKey] ||
    data[singularGuess] ||
    data[collection.slice(0, -1)] ||
    data.person ||
    data.opportunity ||
    data.note ||
    data.noteTarget ||
    data.timelineActivity ||
    {};
  return record.id || null;
}

function extractPatchedIdOid(collection, responseBody) {
  const data = responseBody?.data || {};
  if (collection === "people") {
    const person = data.updatePerson || data.person || {};
    return person.idOid || null;
  }
  const opp = data.updateOpportunity || data.opportunity || {};
  return opp.idOid || null;
}

function buildTwentyListPath(collection, filterExpr, limit) {
  let path = `/${collection}?filter=${encodeURIComponent(filterExpr)}`;
  if (limit) path += `&limit=${limit}`;
  return path;
}

const { emailLookupKeys, displayEmail } = require("./gmailEmail");

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function personPrimaryEmail(person) {
  if (!person?.emails) return "";
  return normalizeEmail(person.emails.primaryEmail);
}

async function findPersonByPrimaryEmailEq(email) {
  const key = String(email || "").trim();
  if (!key) return null;
  const path = buildTwentyListPath(
    "people",
    `emails.primaryEmail[eq]:${key}`,
    5,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`find person HTTP ${res.statusCode} ${res.rawBody}`);
  }
  const people = parseTwentyListRecords("people", res.body);
  const expected = displayEmail(key) || normalizeEmail(key);
  return (
    people.find((person) => {
      const got = personPrimaryEmail(person);
      return !got || got === expected || got === normalizeEmail(key);
    }) ||
    people[0] ||
    null
  );
}

async function findPersonByEmail(email) {
  if (!email) return null;
  const keys = emailLookupKeys(email);
  if (!keys.length) keys.push(normalizeEmail(email));
  const found = [];
  const seen = new Set();
  for (const key of keys) {
    const person = await findPersonByPrimaryEmailEq(key);
    if (person?.id && !seen.has(person.id)) {
      seen.add(person.id);
      found.push(person);
    }
  }
  if (found.length <= 1) return found[0] || null;
  for (const person of found) {
    const open = await findOpenOpportunityByPersonId(person.id);
    if (open?.id) return person;
  }
  found.sort((a, b) =>
    String(a.createdAt || "").localeCompare(String(b.createdAt || "")),
  );
  return found[0];
}

async function findPersonByPhone(rawPhone) {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  if (!digits) return null;
  const national =
    digits.length === 11 && digits.startsWith("48")
      ? digits.slice(2)
      : digits.length > 9 && digits.startsWith("48")
        ? digits.slice(-9)
        : digits.length === 9
          ? digits
          : digits.slice(-9);
  if (national.length < 9) return null;
  const path = buildTwentyListPath(
    "people",
    `phones.primaryPhoneNumber[eq]:${national}`,
    1,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`find person by phone HTTP ${res.statusCode} ${res.rawBody}`);
  }
  const people = parseTwentyListRecords("people", res.body);
  return people.length ? people[0] : null;
}

async function findOpportunityByIdOid(idOid) {
  const path = buildTwentyListPath("opportunities", `idOid[eq]:${idOid}`, 1);
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`find opp HTTP ${res.statusCode} ${res.rawBody}`);
  }
  const opps = parseTwentyListRecords("opportunities", res.body);
  let opp = opps.length ? opps[0] : null;
  if (opp && String(opp.idOid || "").trim() !== String(idOid).trim()) {
    opp = null;
  }
  return opp;
}

async function findOpportunityByMetaLeadgenId(leadgenId) {
  const id = String(leadgenId || "").trim();
  if (!id) return null;
  const path = buildTwentyListPath(
    "opportunities",
    `metaLeadgenId[eq]:${id}`,
    1,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`find opp by leadgen HTTP ${res.statusCode} ${res.rawBody}`);
  }
  const opps = parseTwentyListRecords("opportunities", res.body);
  let opp = opps.length ? opps[0] : null;
  if (opp && String(opp.metaLeadgenId || "").trim() !== id) {
    opp = null;
  }
  return opp;
}

function unwrapSingleRecord(collectionSingular, responseBody) {
  const data = responseBody?.data || {};
  return (
    data[collectionSingular] ||
    data[collectionSingular + "s"]?.[0] ||
    (data.id ? data : null) ||
    null
  );
}

async function getPersonById(personId) {
  const id = String(personId || "").trim();
  if (!id) return null;
  const res = await twentyRequest("GET", `/people/${encodeURIComponent(id)}`);
  if (res.statusCode === 404) return null;
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`get person HTTP ${res.statusCode} ${res.rawBody}`);
  }
  return unwrapSingleRecord("person", res.body);
}

async function getCompanyById(companyId) {
  const id = String(companyId || "").trim();
  if (!id) return null;
  const res = await twentyRequest("GET", `/companies/${encodeURIComponent(id)}`);
  if (res.statusCode === 404) return null;
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`get company HTTP ${res.statusCode} ${res.rawBody}`);
  }
  return unwrapSingleRecord("company", res.body);
}

/**
 * Latest Opportunity for Person with bizSqlConfirmed=true (continuity fallback).
 * Returns null when none — does not create records.
 */
async function findLatestSqlOpportunityByPersonId(personId) {
  const id = String(personId || "").trim();
  if (!id) return null;
  const filter = `pointOfContactId[eq]:${id},bizSqlConfirmed[eq]:true`;
  let path = buildTwentyListPath("opportunities", filter, 5);
  path += "&order_by=bizSqlConfirmedAt[DescNullsLast]";
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(
      `find sql opp by person HTTP ${res.statusCode} ${res.rawBody}`,
    );
  }
  const opps = parseTwentyListRecords("opportunities", res.body);
  if (!opps.length) return null;
  const match = opps.find(
    (opp) =>
      String(opp.pointOfContactId || opp.pointOfContact?.id || "").trim() ===
        id && opp.bizSqlConfirmed === true,
  );
  return match || opps[0] || null;
}

const OPEN_OPPORTUNITY_STAGES = new Set([
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "CONTRACT_SENT",
  "PAYING",
]);

/**
 * Open Opportunity for Person — dedupe create_lead (esp. leads@ vs BB sync).
 * Prefer BETTER_BITRIX_LEGACY / bitrixDealId, else newest open.
 */
async function findOpenOpportunityByPersonId(personId) {
  const id = String(personId || "").trim();
  if (!id) return null;
  const filter = `pointOfContactId[eq]:${id}`;
  let path = buildTwentyListPath("opportunities", filter, 20);
  path += "&order_by=createdAt[DescNullsLast]";
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(
      `find open opp by person HTTP ${res.statusCode} ${res.rawBody}`,
    );
  }
  const opps = parseTwentyListRecords("opportunities", res.body).filter(
    (opp) =>
      String(opp.pointOfContactId || opp.pointOfContact?.id || "").trim() ===
        id && OPEN_OPPORTUNITY_STAGES.has(String(opp.stage || "")),
  );
  return preferOpenOpportunity(opps);
}

/** Pure: pick BB/Pipedrive legacy over Sortownia over newest. */
function preferOpenOpportunity(opps) {
  if (!opps || !opps.length) return null;
  return (
    opps.find(
      (o) =>
        o.srcSystem === "BETTER_BITRIX_LEGACY" ||
        o.srcSystem === "PIPEDRIVE_LEGACY" ||
        String(o.bitrixDealId || "").trim(),
    ) ||
    opps.find((o) => o.srcSystem === "OWOCNI_SORTOWNIA") ||
    opps[0] ||
    null
  );
}

async function patchTwentyRecord(collection, recordId, patchBody) {
  const res = await twentyRequest(
    "PATCH",
    `/${collection}/${encodeURIComponent(recordId)}`,
    patchBody,
  );
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(
      `PATCH ${collection} HTTP ${res.statusCode} ${res.rawBody}`,
    );
  }
  return res.body;
}

module.exports = {
  twentyRequest,
  parseTwentyListRecords,
  extractCreatedId,
  extractPatchedIdOid,
  buildTwentyListPath,
  findPersonByEmail,
  findPersonByPhone,
  findOpportunityByIdOid,
  findOpportunityByMetaLeadgenId,
  getPersonById,
  getCompanyById,
  findLatestSqlOpportunityByPersonId,
  findOpenOpportunityByPersonId,
  preferOpenOpportunity,
  OPEN_OPPORTUNITY_STAGES,
  patchTwentyRecord,
};
