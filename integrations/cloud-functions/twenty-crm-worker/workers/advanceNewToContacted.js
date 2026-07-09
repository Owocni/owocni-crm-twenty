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

const PROCESSED_PREFIX = "email_contact_processed_";
const INTERNAL_DOMAIN = "@owocni.pl";
const NOTIFY_SUBJECT_PREFIX = "Nowy lead:";
const CLOSED_STAGES = new Set(["WON", "LOST"]);

function lookbackIso() {
  const minutes = Number(process.env.OUTGOING_CONTACT_LOOKBACK_MINUTES || 45);
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function isEnabled() {
  const flag = process.env.ADVANCE_NEW_TO_CONTACTED_ENABLED;
  if (flag === undefined || flag === "") return true;
  return flag === "true" || flag === "1";
}

function buildContactLabelFresh() {
  return "Godzin: 0";
}

function messageContactIso(message, association) {
  return (
    message?.receivedAt ||
    message?.createdAt ||
    association?.createdAt ||
    new Date().toISOString()
  );
}

async function listRecentAssociations(direction) {
  const since = lookbackIso();
  const filter = `direction[eq]:${direction},createdAt[gte]:${since}`;
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

async function fetchClientParticipant(messageId, role) {
  const path = buildTwentyListPath(
    "messageParticipants",
    `messageId[eq]:${messageId},role[eq]:${role}`,
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

async function findNewestOpenOpportunity(personId) {
  const path = buildTwentyListPath(
    "opportunities",
    `pointOfContactId[eq]:${personId}`,
    20,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`list opportunities HTTP ${res.statusCode}`);
  }
  const opps = parseTwentyListRecords("opportunities", res.body).filter(
    (opp) => !CLOSED_STAGES.has(String(opp.stage || "").toUpperCase()),
  );
  if (!opps.length) return null;
  opps.sort((a, b) => {
    const ta = Date.parse(a.updatedAt || a.createdAt || 0);
    const tb = Date.parse(b.updatedAt || b.createdAt || 0);
    return tb - ta;
  });
  return opps[0];
}

async function wasProcessed(associationId) {
  const doc = await readTwentyStateDocument(PROCESSED_PREFIX + associationId);
  return Boolean(doc && doc.processed === true);
}

async function markProcessed(associationId, opportunityId, messageId, meta) {
  await putTwentyStateDocument(PROCESSED_PREFIX + associationId, {
    processed: true,
    association_id: associationId,
    message_id: messageId,
    opportunity_id: opportunityId,
    updated_at: Date.now(),
    ...meta,
  });
}

async function touchContactFields(opp, contactIso) {
  await setPendingWrite(opp.id, "gcp:email_contact_sync", PENDING_WRITE_TTL_MS);
  await patchTwentyRecord("opportunities", opp.id, {
    lastContactAt: contactIso,
    bizLastContactLabel: buildContactLabelFresh(),
  });
  await clearPendingWrite(opp.id, "gcp:email_contact_sync");
}

async function processOutgoingAssociation(assoc) {
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
    await markProcessed(associationId, null, messageId, {
      skipped: "owner_notify",
    });
    return { skipped: "owner_notify" };
  }

  const participant = await fetchClientParticipant(messageId, "TO");
  if (!participant) {
    return { skipped: "no_client_to" };
  }

  const opp = await findNewestOpenOpportunity(participant.personId);
  if (!opp) {
    return { skipped: "no_open_opp" };
  }

  const contactIso = messageContactIso(message, assoc);
  await touchContactFields(opp, contactIso);

  let advanced = false;
  if (String(opp.stage || "").toUpperCase() === "NEW") {
    await setPendingWrite(
      opp.id,
      "gcp:advance_new_to_contacted",
      PENDING_WRITE_TTL_MS,
    );
    await patchTwentyRecord("opportunities", opp.id, { stage: "CONTACTED" });
    await clearPendingWrite(opp.id, "gcp:advance_new_to_contacted");
    advanced = true;
  }

  await markProcessed(associationId, opp.id, messageId, {
    direction: "OUTGOING",
    advanced,
  });

  console.log(
    "EMAIL_CONTACT: OUTGOING OK",
    opp.id,
    opp.name,
    "person=",
    participant.personId,
    "msg=",
    messageId,
    advanced ? "advanced=CONTACTED" : "contact_only",
  );
  return {
    direction: "OUTGOING",
    contactUpdated: true,
    advanced,
    opportunityId: opp.id,
    opportunityName: opp.name,
    personId: participant.personId,
    messageId,
  };
}

async function processIncomingAssociation(assoc) {
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

  const participant = await fetchClientParticipant(messageId, "FROM");
  if (!participant) {
    return { skipped: "no_client_from" };
  }

  const opp = await findNewestOpenOpportunity(participant.personId);
  if (!opp) {
    return { skipped: "no_open_opp" };
  }

  const contactIso = messageContactIso(message, assoc);
  await touchContactFields(opp, contactIso);
  await markProcessed(associationId, opp.id, messageId, {
    direction: "INCOMING",
  });

  console.log(
    "EMAIL_CONTACT: INCOMING OK",
    opp.id,
    opp.name,
    "person=",
    participant.personId,
    "msg=",
    messageId,
  );
  return {
    direction: "INCOMING",
    contactUpdated: true,
    opportunityId: opp.id,
    opportunityName: opp.name,
    personId: participant.personId,
    messageId,
  };
}

async function processEmailContactWebhook(webhookBody) {
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
  const assoc = {
    id: record.id,
    messageId: record.messageId,
    direction: record.direction,
    createdAt: record.createdAt,
  };
  if (!assoc.id || !assoc.messageId) {
    return { skipped: "missing_association_fields", eventName };
  }

  if (String(assoc.direction || "").toUpperCase() === "INCOMING") {
    return processIncomingAssociation(assoc);
  }
  return processOutgoingAssociation(assoc);
}

async function runAdvanceNewToContactedWorker() {
  if (!isEnabled()) {
    console.log("advance_new_to_contacted: disabled");
    return { enabled: false, processed: 0, advanced: 0, results: [] };
  }

  console.log("=== email_contact_sync worker (GCP) ===");
  const outgoing = await listRecentAssociations("OUTGOING");
  const incoming = await listRecentAssociations("INCOMING");
  console.log(
    "associations in window outgoing=",
    outgoing.length,
    "incoming=",
    incoming.length,
  );

  const results = [];
  let advanced = 0;
  let contactUpdated = 0;

  for (const assoc of [...outgoing, ...incoming]) {
    try {
      const result =
        assoc.direction === "INCOMING"
          ? await processIncomingAssociation(assoc)
          : await processOutgoingAssociation(assoc);
      results.push({ associationId: assoc.id, ...result });
      if (result.advanced) advanced += 1;
      if (result.contactUpdated) contactUpdated += 1;
    } catch (err) {
      console.error("EMAIL_CONTACT: FAIL", assoc.id, err.message);
      results.push({
        associationId: assoc.id,
        error: err.message,
      });
    }
  }

  console.log(
    "email_contact_sync done contactUpdated=",
    contactUpdated,
    "advanced=",
    advanced,
    "scanned=",
    outgoing.length + incoming.length,
  );
  return {
    enabled: true,
    scanned: outgoing.length + incoming.length,
    outgoing: outgoing.length,
    incoming: incoming.length,
    contactUpdated,
    advanced,
    results,
  };
}

module.exports = {
  runAdvanceNewToContactedWorker,
  processEmailContactWebhook,
  NOTIFY_SUBJECT_PREFIX,
};
