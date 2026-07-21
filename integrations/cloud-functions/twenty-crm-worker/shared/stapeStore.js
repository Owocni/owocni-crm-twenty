"use strict";

const { getStapeConfig, COLLECTION_TASK_QUEUE } = require("./config");

function normalizeTaskItem(item) {
  const key = item.key || "";
  const raw = item.data || {};
  if (
    raw.data &&
    typeof raw.data === "object" &&
    raw.status === undefined &&
    raw.job_type === undefined
  ) {
    return { key, data: raw.data };
  }
  return { key, data: raw };
}

async function stapeFetch(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Stape API ${res.status}: ${text.slice(0, 500)}`);
  }
  return body;
}

function collectionsBase() {
  return getStapeConfig().collectionsUrl;
}

async function fetchPendingTasksByJobType(jobType, limit = 50) {
  const url = `${collectionsBase()}/${COLLECTION_TASK_QUEUE}/documents`;
  const requestBody = {
    filter: {
      data: {
        status: { $eq: "pending" },
        job_type: { $eq: jobType },
      },
    },
    pagination: {
      sort: [{ field: "created_at", order: "asc" }],
      limit,
    },
  };

  const parsed = await stapeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  const items = parsed?.data?.items || [];
  return items
    .map(normalizeTaskItem)
    .filter((t) => t.data?.status === "pending" && t.data?.job_type === jobType);
}

async function putTaskDocument(taskKey, taskData) {
  const url = `${collectionsBase()}/${COLLECTION_TASK_QUEUE}/documents/${encodeURIComponent(taskKey)}`;
  await stapeFetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(taskData),
  });
}

async function putTwentyStateDocument(docKey, doc) {
  const url = `${collectionsBase()}/twenty_state/documents/${encodeURIComponent(docKey)}`;
  await stapeFetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
}

async function putIdentityMapDocument(docKey, doc) {
  const url = `${collectionsBase()}/identity_map/documents/${encodeURIComponent(docKey)}`;
  await stapeFetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
}

async function readIdentityMapDocument(docKey) {
  const url = `${collectionsBase()}/identity_map/documents/${encodeURIComponent(docKey)}`;
  try {
    const parsed = await stapeFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    return parsed?.data?.data || parsed?.data || null;
  } catch (err) {
    if (String(err.message || "").includes("404")) {
      return null;
    }
    throw err;
  }
}

async function readTwentyStateDocument(docKey) {
  const url = `${collectionsBase()}/twenty_state/documents/${encodeURIComponent(docKey)}`;
  try {
    const parsed = await stapeFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    return parsed?.data?.data || parsed?.data || null;
  } catch (err) {
    if (String(err.message || "").includes("404")) {
      return null;
    }
    throw err;
  }
}

async function setPendingWrite(opportunityId, adapterId, ttlMs) {
  const docKey = `pending_write_twenty_${opportunityId}`;
  await putTwentyStateDocument(docKey, {
    active: true,
    adapter: adapterId,
    expires_at: Date.now() + ttlMs,
  });
}

async function clearPendingWrite(opportunityId, adapterId) {
  const docKey = `pending_write_twenty_${opportunityId}`;
  await putTwentyStateDocument(docKey, {
    active: false,
    adapter: adapterId,
    cleared_at: Date.now(),
  });
}

module.exports = {
  fetchPendingTasksByJobType,
  putTaskDocument,
  putTwentyStateDocument,
  readTwentyStateDocument,
  putIdentityMapDocument,
  readIdentityMapDocument,
  setPendingWrite,
  clearPendingWrite,
};
