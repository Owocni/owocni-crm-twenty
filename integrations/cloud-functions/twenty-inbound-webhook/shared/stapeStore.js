"use strict";

const { getStapeConfig, COLLECTION_TASK_QUEUE, COLLECTION_IDENTITY_MAP, COLLECTION_TWENTY_STATE } = require("./config");

function unwrapStoreDocument(body) {
  if (!body || typeof body !== "object") {
    return {};
  }
  if (body.data && body.data.data && typeof body.data.data === "object") {
    return body.data.data;
  }
  if (
    body.last_stage !== undefined ||
    body.last_campaignRejected !== undefined ||
    body.active !== undefined
  ) {
    return body;
  }
  if (body.data && typeof body.data === "object") {
    return body.data;
  }
  return body;
}

async function stapeFetch(url, options = {}, { throwOnError = true } = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok && throwOnError) {
    throw new Error(`Stape API ${res.status}: ${text.slice(0, 500)}`);
  }
  return { statusCode: res.status, body, rawText: text };
}

function collectionsBase() {
  return getStapeConfig().collectionsUrl;
}

async function readTwentyStateDoc(documentKey) {
  try {
    const url = `${collectionsBase()}/${COLLECTION_TWENTY_STATE}/documents/${encodeURIComponent(documentKey)}`;
    const res = await stapeFetch(url, { method: "GET" }, { throwOnError: false });
    if (res.statusCode === 404) {
      return {};
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      return {};
    }
    return unwrapStoreDocument(res.body);
  } catch {
    return {};
  }
}

async function writeTwentyStateDoc(documentKey, obj) {
  const url = `${collectionsBase()}/${COLLECTION_TWENTY_STATE}/documents/${encodeURIComponent(documentKey)}`;
  await stapeFetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  });
}

async function readIdentityMapDoc(key) {
  try {
    const url = `${collectionsBase()}/${COLLECTION_IDENTITY_MAP}/documents/${encodeURIComponent(key)}`;
    const res = await stapeFetch(url, { method: "GET" }, { throwOnError: false });
    if (res.statusCode === 404) {
      return null;
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`HTTP ${res.statusCode}`);
    }
    return unwrapStoreDocument(res.body);
  } catch (err) {
    throw err;
  }
}

async function readIdentityMapOid(key) {
  const doc = await readIdentityMapDoc(key);
  if (!doc) {
    return null;
  }
  return doc.id_oid || null;
}

async function putIdentityMapDocument(key, doc) {
  const url = `${collectionsBase()}/${COLLECTION_IDENTITY_MAP}/documents/${encodeURIComponent(key)}`;
  await stapeFetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
}

async function writeIdentityMapProfile(idOid, email, phone, tier, env, identityAdapterId) {
  const profile = {
    id_oid: idOid,
    biz_email: email || null,
    biz_phone: phone || null,
    identity_status: tier === "T4" ? "needs_review" : "verified",
    vbb_eligible: false,
    identity_tier: tier,
    updated_at: String(Date.now()),
    last_resolver: identityAdapterId,
    environment: env,
  };
  const keys = [idOid];
  if (email) keys.push(email);
  if (phone) keys.push(phone);
  for (const key of keys) {
    await putIdentityMapDocument(key, profile);
  }
}

async function putTaskDocument(taskKey, taskData) {
  const url = `${collectionsBase()}/${COLLECTION_TASK_QUEUE}/documents/${encodeURIComponent(taskKey)}`;
  await stapeFetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(taskData),
  });
}

module.exports = {
  stapeFetch,
  unwrapStoreDocument,
  readTwentyStateDoc,
  writeTwentyStateDoc,
  readIdentityMapOid,
  readIdentityMapDoc,
  putIdentityMapDocument,
  writeIdentityMapProfile,
  putTaskDocument,
};
