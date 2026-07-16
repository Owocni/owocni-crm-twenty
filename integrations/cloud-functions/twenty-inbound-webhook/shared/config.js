"use strict";

const INBOUND_BUILD_ID = "2026-07-16-gcp-v6-freemail";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function getStapeConfig() {
  const apiBase = (
    process.env.STAPE_API_BASE || "https://uinpcbwf.eug.stape.io/stape-api"
  ).replace(/\/$/, "");
  return {
    apiKey: requireEnv("STAPE_API_KEY"),
    apiBase,
    collectionsUrl: `${apiBase}/${requireEnv("STAPE_API_KEY")}/v2/store/collections`,
  };
}

function getTwentyConfig() {
  return {
    restUrl: (process.env.TWENTY_REST_URL || "https://api.twenty.com/rest").replace(
      /\/$/,
      "",
    ),
    apiKey: requireEnv("TWENTY_API_KEY"),
  };
}

function getRuntimeEnvironment(headerValue) {
  const raw = headerValue || process.env.RUNTIME_ENVIRONMENT || "sandbox";
  const n = String(raw).toLowerCase();
  return n === "sandbox" ? "sandbox" : "prod";
}

module.exports = {
  INBOUND_BUILD_ID,
  getStapeConfig,
  getTwentyConfig,
  getRuntimeEnvironment,
  LEADS_AT_MESSAGE_CHANNEL_ID:
    process.env.LEADS_AT_MESSAGE_CHANNEL_ID ||
    "32629e97-6dc2-452f-aa26-38c72eaab3a4",
  PENDING_WRITE_TTL_MS: Number(process.env.PENDING_WRITE_TTL_MS || 45000),
  COLLECTION_TASK_QUEUE: "task_queue",
  COLLECTION_IDENTITY_MAP: "identity_map",
  COLLECTION_TWENTY_STATE: "twenty_state",
};
