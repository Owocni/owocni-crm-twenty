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
  const record =
    data[createKey] ||
    data[collection.slice(0, -1)] ||
    data.person ||
    data.opportunity ||
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

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function personPrimaryEmail(person) {
  if (!person?.emails) return "";
  return normalizeEmail(person.emails.primaryEmail);
}

async function findPersonByEmail(email) {
  if (!email) return null;
  const path = buildTwentyListPath(
    "people",
    `emails.primaryEmail[eq]:${email}`,
    1,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`find person HTTP ${res.statusCode} ${res.rawBody}`);
  }
  const people = parseTwentyListRecords("people", res.body);
  let person = people.length ? people[0] : null;
  if (person && personPrimaryEmail(person) !== normalizeEmail(email)) {
    person = null;
  }
  return person;
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
  findOpportunityByIdOid,
  patchTwentyRecord,
};
