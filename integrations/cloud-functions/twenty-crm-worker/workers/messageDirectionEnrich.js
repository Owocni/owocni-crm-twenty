"use strict";

/**
 * E12.5 live enrich — Message.direction + ourMailboxes via API key.
 *
 * Twenty Workflow UPDATE_RECORD on system object Message fails with:
 *   "Object cannot be updated by automation"
 * REST/GraphQL with API key works — this worker is the live path.
 *
 * Firm rule (ADR #19): OUTGOING if any MCMA is OUTGOING, else INCOMING.
 * ourMailboxes: from MessageParticipant.handle (known @owocni.pl map).
 */

const {
  twentyRequest,
  parseTwentyListRecords,
  patchTwentyRecord,
  buildTwentyListPath,
} = require("../shared/twentyRest");

const HANDLE_TO_VALUE = {
  "marta@owocni.pl": "MARTA",
  "gosia@owocni.pl": "GOSIA",
  "mariusz@owocni.pl": "MARIUSZ",
  "studio@owocni.pl": "STUDIO",
  "leads@owocni.pl": "LEADS",
  "copywriting@owocni.pl": "COPYWRITING",
  "pomoc@owocni.pl": "POMOC",
  "obsluga@owocni.pl": "OBSLUGA",
};

function isEnabled() {
  const flag = process.env.MESSAGE_DIRECTION_ENRICH_ENABLED;
  if (flag === undefined || flag === "") return true;
  return flag === "true" || flag === "1";
}

function lookbackIso() {
  const minutes = Number(process.env.MESSAGE_DIRECTION_LOOKBACK_MINUTES || 45);
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function normalizeHandle(handle) {
  return String(handle || "")
    .trim()
    .toLowerCase();
}

function mailboxesFromParticipants(parts) {
  const set = new Set();
  for (const part of parts || []) {
    const val = HANDLE_TO_VALUE[normalizeHandle(part.handle)];
    if (val) set.add(val);
  }
  return [...set].sort();
}

function sameMailboxSet(a, b) {
  const aa = [...(a || [])].map(String).sort();
  const bb = [...(b || [])].map(String).sort();
  if (aa.length !== bb.length) return false;
  return aa.every((v, i) => v === bb[i]);
}

async function fetchMessage(messageId) {
  const res = await twentyRequest(
    "GET",
    `/messages/${encodeURIComponent(messageId)}`,
  );
  if (res.statusCode === 404) return null;
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`get message HTTP ${res.statusCode}`);
  }
  return res.body?.data?.message || res.body?.data || null;
}

async function listAssociationsForMessage(messageId) {
  const path = buildTwentyListPath(
    "messageChannelMessageAssociations",
    `messageId[eq]:${messageId}`,
    20,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`list mcma HTTP ${res.statusCode}`);
  }
  return parseTwentyListRecords(
    "messageChannelMessageAssociations",
    res.body,
  );
}

async function listParticipantsForMessage(messageId) {
  const path = buildTwentyListPath(
    "messageParticipants",
    `messageId[eq]:${messageId}`,
    50,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`list participants HTTP ${res.statusCode}`);
  }
  return parseTwentyListRecords("messageParticipants", res.body);
}

function resolveDirection(associations, hintDirection) {
  const dirs = (associations || []).map((a) =>
    String(a.direction || "").toUpperCase(),
  );
  if (dirs.includes("OUTGOING")) return "OUTGOING";
  if (dirs.includes("INCOMING")) return "INCOMING";
  const hint = String(hintDirection || "").toUpperCase();
  if (hint === "OUTGOING" || hint === "INCOMING") return hint;
  return null;
}

async function enrichMessage(messageId, hintDirection) {
  if (!messageId) return { skipped: "missing_message_id" };

  const message = await fetchMessage(messageId);
  if (!message) return { skipped: "message_not_found", messageId };

  const associations = await listAssociationsForMessage(messageId);
  const direction = resolveDirection(associations, hintDirection);
  const participants = await listParticipantsForMessage(messageId);
  const ourMailboxes = mailboxesFromParticipants(participants);

  const patch = {};
  if (direction && message.direction !== direction) {
    // Never downgrade OUTGOING → INCOMING if message already OUTGOING
    if (!(message.direction === "OUTGOING" && direction === "INCOMING")) {
      patch.direction = direction;
    }
  }
  if (ourMailboxes.length && !sameMailboxSet(message.ourMailboxes, ourMailboxes)) {
    patch.ourMailboxes = ourMailboxes;
  }

  if (!Object.keys(patch).length) {
    return {
      messageId,
      skipped: "already_enriched",
      direction: message.direction || direction,
      ourMailboxes: message.ourMailboxes || ourMailboxes,
    };
  }

  await patchTwentyRecord("messages", messageId, patch);
  return {
    messageId,
    updated: true,
    patch,
    direction: patch.direction || message.direction || direction,
    ourMailboxes: patch.ourMailboxes || message.ourMailboxes || ourMailboxes,
  };
}

/**
 * Called from MCMA webhook path (same event as email-contact).
 * Always runs enrich; does not replace contact-sync.
 */
async function enrichFromMcmaWebhook(webhookBody) {
  if (!isEnabled()) return { enabled: false, skipped: "disabled" };

  const payload = webhookBody || {};
  const eventName = String(
    payload.event ||
      payload.operation ||
      payload.type ||
      payload.name ||
      payload.eventName ||
      "",
  );
  if (!eventName.startsWith("messageChannelMessageAssociation.")) {
    return { skipped: "unsupported_event", eventName };
  }

  let record = payload.record || payload.data || payload;
  if (record && record.record && typeof record.record === "object") {
    record = record.record;
  }
  const messageId = record.messageId;
  const hintDirection = record.direction;
  if (!messageId) return { skipped: "missing_message_id", eventName };

  try {
    const result = await enrichMessage(messageId, hintDirection);
    console.log("MESSAGE_DIRECTION_ENRICH webhook", messageId, result);
    return { enabled: true, eventName, ...result };
  } catch (err) {
    console.error("MESSAGE_DIRECTION_ENRICH webhook FAIL", messageId, err.message);
    return { enabled: true, eventName, messageId, error: err.message };
  }
}

async function listRecentAssociations() {
  const since = lookbackIso();
  const limit = Number(process.env.MAX_MESSAGE_DIRECTION_SCAN || 40);
  const path = buildTwentyListPath(
    "messageChannelMessageAssociations",
    `createdAt[gte]:${since}`,
    limit,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(
      `list recent mcma HTTP ${res.statusCode} ${res.rawBody?.slice?.(0, 300)}`,
    );
  }
  return parseTwentyListRecords(
    "messageChannelMessageAssociations",
    res.body,
  );
}

async function runMessageDirectionEnrichWorker() {
  if (!isEnabled()) {
    console.log("message_direction_enrich: disabled");
    return { enabled: false, processed: 0, updated: 0, results: [] };
  }

  console.log("=== message_direction_enrich worker ===");
  const associations = await listRecentAssociations();
  const byMessage = new Map();
  for (const assoc of associations) {
    if (!assoc.messageId) continue;
    const prev = byMessage.get(assoc.messageId);
    if (!prev || String(assoc.direction).toUpperCase() === "OUTGOING") {
      byMessage.set(assoc.messageId, assoc.direction);
    }
  }

  const results = [];
  let updated = 0;
  for (const [messageId, hintDirection] of byMessage) {
    try {
      const result = await enrichMessage(messageId, hintDirection);
      results.push(result);
      if (result.updated) updated += 1;
    } catch (err) {
      console.error("MESSAGE_DIRECTION_ENRICH FAIL", messageId, err.message);
      results.push({ messageId, error: err.message });
    }
  }

  console.log(
    "message_direction_enrich done updated=",
    updated,
    "messages=",
    byMessage.size,
    "assoc=",
    associations.length,
  );
  return {
    enabled: true,
    scannedAssociations: associations.length,
    messages: byMessage.size,
    updated,
    results,
  };
}

module.exports = {
  enrichMessage,
  enrichFromMcmaWebhook,
  runMessageDirectionEnrichWorker,
  HANDLE_TO_VALUE,
};
