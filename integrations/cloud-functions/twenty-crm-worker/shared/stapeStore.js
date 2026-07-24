"use strict";

const { getStapeConfig, COLLECTION_TASK_QUEUE } = require("./config");

/** Avoid hammering a paused/broken Stape container within one instance lifetime. */
let circuitOpenUntil = 0;
const CIRCUIT_TTL_MS = 10 * 60 * 1000;

/** One list-pending fetch shared across job-type workers in a single poll request. */
let pendingTasksCache = null;

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
  if (Date.now() < circuitOpenUntil) {
    throw new Error(
      `Stape circuit open until ${new Date(circuitOpenUntil).toISOString()}`,
    );
  }

  const res = await fetch(url, options);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    // Container paused / wrong base path — not a missing document
    if (
      res.status === 404 &&
      /page not found/i.test(text || "")
    ) {
      circuitOpenUntil = Date.now() + CIRCUIT_TTL_MS;
      console.warn(
        "Stape circuit OPEN for",
        CIRCUIT_TTL_MS / 1000,
        "s (container paused or API path broken)",
      );
    }
    throw new Error(`Stape API ${res.status}: ${text.slice(0, 500)}`);
  }
  return body;
}

function collectionsBase() {
  return getStapeConfig().collectionsUrl;
}

async function fetchAllPendingTasks(limit = 99) {
  const url = `${collectionsBase()}/${COLLECTION_TASK_QUEUE}/documents`;
  const safeLimit = Math.min(Math.max(Number(limit) || 99, 1), 99);
  const requestBody = {
    filter: {
      data: {
        status: { $eq: "pending" },
      },
    },
    pagination: {
      sort: [{ field: "created_at", order: "asc" }],
      limit: safeLimit,
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
    .filter((t) => t.data?.status === "pending");
}

/**
 * Wrap a poll cycle so all job-type workers share one Stape list call.
 */
async function withPendingTasksCache(fn) {
  pendingTasksCache = { promise: null };
  try {
    return await fn();
  } finally {
    pendingTasksCache = null;
  }
}

async function fetchPendingTasksByJobType(jobType, limit = 50) {
  if (pendingTasksCache) {
    if (!pendingTasksCache.promise) {
      pendingTasksCache.promise = fetchAllPendingTasks(99);
    }
    const all = await pendingTasksCache.promise;
    return all
      .filter((t) => t.data?.job_type === jobType)
      .slice(0, limit);
  }

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
    const msg = String(err.message || "");
    if (msg.includes("404") && !/page not found/i.test(msg) && !/circuit open/i.test(msg)) {
      return null;
    }
    if (msg.includes("404") && /page not found/i.test(msg)) {
      throw err;
    }
    if (/circuit open/i.test(msg)) throw err;
    if (msg.includes("404")) return null;
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
    const msg = String(err.message || "");
    if (/circuit open/i.test(msg)) throw err;
    if (msg.includes("404") && /page not found/i.test(msg)) throw err;
    if (msg.includes("404")) return null;
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
  fetchAllPendingTasks,
  withPendingTasksCache,
  putTaskDocument,
  putTwentyStateDocument,
  readTwentyStateDocument,
  putIdentityMapDocument,
  readIdentityMapDocument,
  setPendingWrite,
  clearPendingWrite,
};
