"use strict";

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function getConfig() {
  return {
    verifyToken: requireEnv("META_WEBHOOK_VERIFY_TOKEN"),
    pageAccessToken: requireEnv("META_PAGE_ACCESS_TOKEN"),
    pageId: String(process.env.META_PAGE_ID || "").trim(),
    graphApiVersion: String(process.env.META_GRAPH_API_VERSION || "v21.0").trim(),
    workerUrl: requireEnv("TWENTY_CRM_WORKER_URL").replace(/\/$/, ""),
    environment: String(process.env.RUNTIME_ENVIRONMENT || "sandbox").trim(),
  };
}

module.exports = { getConfig, requireEnv };
