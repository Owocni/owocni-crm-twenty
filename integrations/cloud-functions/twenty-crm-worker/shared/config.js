"use strict";

const CREATE_LEAD_BUILD_ID = "2026-07-07-gcp-v5";

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

function getOwnerIds() {
  return {
    maciej: process.env.TWENTY_OWNER_MACIEJ || "7fddba1d-e443-47d4-97b7-a3a829efd8c1",
    marta: process.env.TWENTY_OWNER_MARTA || "4704e0c0-8d77-4640-ad1e-1875294294df",
    gosia: process.env.TWENTY_OWNER_GOSIA || "ccac533d-a34b-4cfc-a036-9e75ee3f8910",
  };
}

function isCreateLeadWriteEnabled() {
  const flag = process.env.CREATE_LEAD_WRITE_ENABLED;
  if (flag === undefined || flag === "") {
    return true;
  }
  return flag === "true" || flag === "1";
}

module.exports = {
  CREATE_LEAD_BUILD_ID,
  getStapeConfig,
  getTwentyConfig,
  getOwnerIds,
  isCreateLeadWriteEnabled,
  MAX_CREATE_LEAD_TASKS: Number(process.env.MAX_CREATE_LEAD_TASKS || 5),
  MAX_UPDATE_PERSON_TASKS: Number(process.env.MAX_UPDATE_PERSON_TASKS || 10),
  PENDING_WRITE_TTL_MS: 45000,
  COLLECTION_TASK_QUEUE: "task_queue",
  PENDING_WRITE_PREFIX: "pending_write_twenty_",
};
