"use strict";

const CREATE_LEAD_BUILD_ID = "2026-08-20-gcp-v13-continuity";

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
    ewa: process.env.TWENTY_OWNER_EWA || "b9e2b31e-0b4a-4936-9d2a-2e5b4a3e0b16",
    // Meta Instant Form / FACEBOOK → zawsze Robert Mańk (nie Marta/Gosia RR)
    robert: process.env.TWENTY_OWNER_ROBERT || "23ac9976-0232-4097-b056-5dc391bf7c34",
  };
}

/** Map firmowych numerów Play PBX → workspaceMemberId handlowca. */
function getPhoneOwnerMap() {
  const owners = getOwnerIds();
  const defaults = {
    48660970980: owners.marta,
    48570704470: owners.gosia,
    48733337712: owners.ewa,
    48535009444: owners.maciej,
    48575970640: owners.robert,
  };
  const raw = process.env.PHONE_OWNER_MAP;
  if (!raw) return defaults;

  const map = { ...defaults };
  for (const entry of raw.split(",")) {
    const [phone, ownerId] = entry.split(":").map((part) => part.trim());
    const digits = phone?.replace(/\D/g, "");
    if (digits && ownerId) map[digits] = ownerId;
  }
  return map;
}

function isCreateLeadWriteEnabled() {
  const flag = process.env.CREATE_LEAD_WRITE_ENABLED;
  if (flag === undefined || flag === "") {
    return true;
  }
  return flag === "true" || flag === "1";
}

/** Continuity routing: returning clients → SQL Account Owner. Default OFF. */
function isContinuityRoutingEnabled() {
  const flag = process.env.CONTINUITY_ROUTING_ENABLED;
  return flag === "true" || flag === "1";
}

/**
 * Workspace members allowed as continuity owners (never Ewa by default).
 * Override: CONTINUITY_OWNER_IDS=uuid,uuid,...
 */
function getContinuityOwnerIds() {
  const owners = getOwnerIds();
  const raw = process.env.CONTINUITY_OWNER_IDS;
  if (!raw || !String(raw).trim()) {
    return new Set([
      owners.marta,
      owners.gosia,
      owners.maciej,
      owners.robert,
    ]);
  }
  return new Set(
    String(raw)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

module.exports = {
  CREATE_LEAD_BUILD_ID,
  getStapeConfig,
  getTwentyConfig,
  getOwnerIds,
  getPhoneOwnerMap,
  isCreateLeadWriteEnabled,
  isContinuityRoutingEnabled,
  getContinuityOwnerIds,
  MAX_CREATE_LEAD_TASKS: Number(process.env.MAX_CREATE_LEAD_TASKS || 5),
  MAX_UPDATE_PERSON_TASKS: Number(process.env.MAX_UPDATE_PERSON_TASKS || 10),
  MAX_CALL_TRANSCRIPT_TASKS: Number(process.env.MAX_CALL_TRANSCRIPT_TASKS || 5),
  PENDING_WRITE_TTL_MS: 45000,
  COLLECTION_TASK_QUEUE: "task_queue",
  PENDING_WRITE_PREFIX: "pending_write_twenty_",
};
