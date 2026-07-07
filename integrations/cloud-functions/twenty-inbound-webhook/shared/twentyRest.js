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
      "User-Agent": "owocni-twenty-inbound-webhook/1.0",
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
  const data = responseBody?.data || responseBody || {};
  if (Array.isArray(data[collection])) {
    return data[collection];
  }
  return [];
}

function buildTwentyListPath(collection, filterExpr, limit) {
  let path = `/${collection}?filter=${encodeURIComponent(filterExpr)}`;
  if (limit) {
    path += `&limit=${limit}`;
  }
  return path;
}

async function patchOpportunity(opportunityId, bodyObj) {
  const res = await twentyRequest(
    "PATCH",
    `/opportunities/${encodeURIComponent(opportunityId)}`,
    bodyObj || {},
  );
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`HTTP ${res.statusCode} ${res.rawBody}`);
  }
  return res;
}

module.exports = {
  twentyRequest,
  parseTwentyListRecords,
  buildTwentyListPath,
  patchOpportunity,
};
