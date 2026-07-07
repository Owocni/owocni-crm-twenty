"use strict";

const { PENDING_WRITE_TTL_MS } = require("../shared/config");
const {
  putTwentyStateDocument,
  readTwentyStateDocument,
  setPendingWrite,
  clearPendingWrite,
} = require("../shared/stapeStore");
const {
  twentyRequest,
  parseTwentyListRecords,
  patchTwentyRecord,
  buildTwentyListPath,
} = require("../shared/twentyRest");

const PROCESSED_PREFIX = "outgoing_contact_processed_";
const INTERNAL_DOMAIN = "@owocni.pl";
const NOTIFY_SUBJECT_PREFIX = "Nowy lead:";

function lookbackIso() {
  const minutes = Number(process.env.OUTGOING_CONTACT_LOOKBACK_MINUTES || 45);
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function isEnabled() {
  const flag = process.env.ADVANCE_NEW_TO_CONTACTED_ENABLED;
  if (flag === undefined || flag === "") return true;
  return flag === "true" || flag === "1";
}

async function listRecentOutgoingAssociations() {
  const since = lookbackIso();
  const filter = `direction[eq]:OUTGOING,createdAt[gte]:${since}`;
  const path = buildTwentyListPath(
    "messageChannelMessageAssociations",
    filter,
    Number(process.env.MAX_OUTGOING_CONTACT_SCAN || 20),
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(
      `list associations HTTP ${res.statusCode} ${res.rawBody?.slice?.(0, 300)}`,
    );
  }
  return parseTwentyListRecords(
    "messageChannelMessageAssociations",
    res.body,
  );
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

async function fetchClientToParticipant(messageId) {
  const path = buildTwentyListPath(
    "messageParticipants",
    `messageId[eq]:${messageId},role[eq]:TO`,
    5,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`list participants HTTP ${res.statusCode}`);
  }
  const parts = parseTwentyListRecords("messageParticipants", res.body);
  for (const part of parts) {
    const handle = String(part.handle || "").toLowerCase();
    if (!part.personId) continue;
    if (handle.includes(INTERNAL_DOMAIN)) continue;
    return part;
  }
  return null;
}

async function findNewestNewOpportunity(personId) {
  const path = buildTwentyListPath(
    "opportunities",
    `pointOfContactId[eq]:${personId},stage[eq]:NEW`,
    5,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`list opportunities HTTP ${res.statusCode}`);
  }
  const opps = parseTwentyListRecords("opportunities", res.body);
  if (!opps.length) return null;
  opps.sort((a, b) => {
    const ta = Date.parse(a.createdAt || 0);
    const tb = Date.parse(b.createdAt || 0);
    return tb - ta;
  });
  return opps[0];
}

async function wasProcessed(associationId) {
  const doc = await readTwentyStateDocument(PROCESSED_PREFIX + associationId);
  return Boolean(doc && doc.processed === true);
}

async function markProcessed(associationId, opportunityId, messageId) {
  await putTwentyStateDocument(PROCESSED_PREFIX + associationId, {
    processed: true,
    association_id: associationId,
    message_id: messageId,
    opportunity_id: opportunityId,
    updated_at: Date.now(),
  });
}

async function processAssociation(assoc) {
  const associationId = assoc.id;
  const messageId = assoc.messageId;
  if (!associationId || !messageId) {
    return { skipped: "missing_ids" };
  }
  if (await wasProcessed(associationId)) {
    return { skipped: "already_processed" };
  }

  const message = await fetchMessage(messageId);
  if (!message) {
    return { skipped: "message_not_found" };
  }
  const subject = String(message.subject || "");
  if (subject.includes(NOTIFY_SUBJECT_PREFIX)) {
    await markProcessed(associationId, null, messageId);
    return { skipped: "owner_notify" };
  }

  const participant = await fetchClientToParticipant(messageId);
  if (!participant) {
    return { skipped: "no_client_to" };
  }

  const opp = await findNewestNewOpportunity(participant.personId);
  if (!opp) {
    return { skipped: "no_new_opp" };
  }

  await setPendingWrite(opp.id, "gcp:advance_new_to_contacted", PENDING_WRITE_TTL_MS);
  await patchTwentyRecord("opportunities", opp.id, { stage: "CONTACTED" });
  await clearPendingWrite(opp.id, "gcp:advance_new_to_contacted");
  await markProcessed(associationId, opp.id, messageId);

  console.log(
    "ADVANCE_CONTACTED: OK",
    opp.id,
    opp.name,
    "person=",
    participant.personId,
    "msg=",
    messageId,
  );
  return {
    advanced: true,
    opportunityId: opp.id,
    opportunityName: opp.name,
    personId: participant.personId,
    messageId,
  };
}

async function runAdvanceNewToContactedWorker() {
  if (!isEnabled()) {
    console.log("advance_new_to_contacted: disabled");
    return { enabled: false, processed: 0, advanced: 0, results: [] };
  }

  console.log("=== advance_new_to_contacted worker (GCP) ===");
  const associations = await listRecentOutgoingAssociations();
  console.log("outgoing associations in window:", associations.length);

  const results = [];
  let advanced = 0;
  for (const assoc of associations) {
    try {
      const result = await processAssociation(assoc);
      results.push({ associationId: assoc.id, ...result });
      if (result.advanced) advanced += 1;
    } catch (err) {
      console.error("ADVANCE_CONTACTED: FAIL", assoc.id, err.message);
      results.push({
        associationId: assoc.id,
        error: err.message,
      });
    }
  }

  console.log(
    "advance_new_to_contacted done advanced=",
    advanced,
    "scanned=",
    associations.length,
  );
  return {
    enabled: true,
    scanned: associations.length,
    advanced,
    results,
  };
}

module.exports = {
  runAdvanceNewToContactedWorker,
  NOTIFY_SUBJECT_PREFIX,
};
