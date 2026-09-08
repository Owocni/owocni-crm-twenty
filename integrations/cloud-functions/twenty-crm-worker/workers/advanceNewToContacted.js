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
  findPersonByEmail,
} = require("../shared/twentyRest");
const { resolveForwardLastContactAt } = require("../shared/lastContact");
const {
  shouldApplyFollowUpFlag,
  resolveFollowUpFlag,
} = require("../shared/followUp");
const {
  resolveEmailContactKind,
  selectExternalClientParticipant,
  pickResolvedOpportunity,
} = require("../shared/emailContactKind");

const PROCESSED_PREFIX = "email_contact_processed_";
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

function computeHoursToFirstResponse(createdAt, outboundIso) {
  const created = Date.parse(createdAt || "");
  const outbound = Date.parse(outboundIso || "");
  if (!Number.isFinite(created) || !Number.isFinite(outbound)) return null;
  let hours = Math.round(((outbound - created) / 3_600_000) * 100) / 100;
  if (hours < 0) hours = 0;
  return hours;
}

function hasFirstResponseMetrics(opp) {
  return (
    opp?.hoursToFirstResponse !== null &&
    opp?.hoursToFirstResponse !== undefined &&
    opp?.hoursToFirstResponse !== ""
  );
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
  return selectExternalClientParticipant(parts);
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

async function findNewestOpenOpportunityByCardEmail(emailRaw) {
  const email = normalizeEmail(emailRaw);
  if (!email || !email.includes("@")) return null;
  const path = buildTwentyListPath(
    "opportunities",
    `bizCardEmail[eq]:${email}`,
    20,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`list opportunities by card email HTTP ${res.statusCode}`);
  }
  const opps = parseTwentyListRecords("opportunities", res.body).filter(
    (opp) =>
      normalizeEmail(opp.bizCardEmail) === email &&
      !CLOSED_STAGES.has(String(opp.stage || "").toUpperCase()),
  );
  if (!opps.length) return null;
  opps.sort((a, b) => {
    const ta = Date.parse(a.updatedAt || a.createdAt || 0);
    const tb = Date.parse(b.updatedAt || b.createdAt || 0);
    return tb - ta;
  });
  return opps[0];
}

async function resolveOpenOpportunity(participant, threadOpp) {
  let byLinkedPersonId = null;
  let byEmailPerson = null;
  let byCardEmail = null;
  if (participant?.personId) {
    byLinkedPersonId = await findNewestOpenOpportunity(participant.personId);
  }
  const handle = participant?.handle;
  if (handle && !byLinkedPersonId) {
    const person = await findPersonByEmail(handle);
    if (person?.id) {
      byEmailPerson = await findNewestOpenOpportunity(person.id);
    }
    if (!byEmailPerson) {
      byCardEmail = await findNewestOpenOpportunityByCardEmail(handle);
    }
  }
  return pickResolvedOpportunity({
    byLinkedPersonId,
    byEmailPerson,
    byCardEmail,
    byThread: threadOpp,
  });
}

async function findNewestOpenOpportunity(personId) {
  if (!personId) return null;
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

async function findOpenOpportunityFromThreadTarget(threadId) {
  if (!threadId) return null;
  const path = buildTwentyListPath(
    "messageThreadTargets",
    `messageThreadId[eq]:${threadId}`,
    10,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`list messageThreadTargets HTTP ${res.statusCode}`);
  }
  const targets = parseTwentyListRecords("messageThreadTargets", res.body);
  for (const target of targets) {
    const opportunityId = target.targetOpportunityId;
    if (!opportunityId) continue;
    const oppRes = await twentyRequest(
      "GET",
      `/opportunities/${encodeURIComponent(opportunityId)}`,
    );
    if (oppRes.statusCode === 404) continue;
    if (oppRes.statusCode < 200 || oppRes.statusCode >= 300) {
      throw new Error(`get opportunity HTTP ${oppRes.statusCode}`);
    }
    const opp = oppRes.body?.data?.opportunity || oppRes.body?.data || null;
    if (!opp?.id) continue;
    if (CLOSED_STAGES.has(String(opp.stage || "").toUpperCase())) continue;
    return opp;
  }
  return null;
}

async function touchContactFields(
  opp,
  contactIso,
  outboundIso,
  mailDirection,
  options = {},
) {
  const patch = {};
  const applyMetrics = options.metrics !== false;
  const forward = resolveForwardLastContactAt(opp.lastContactAt, contactIso);
  if (applyMetrics && forward.advanced && forward.lastContactAt) {
    patch.lastContactAt = forward.lastContactAt;
    patch.bizLastContactLabel = buildContactLabelFresh();
  }
  if (applyMetrics && !hasFirstResponseMetrics(opp) && outboundIso) {
    const hours = computeHoursToFirstResponse(opp.createdAt, outboundIso);
    if (hours !== null) {
      patch.firstResponseAt = outboundIso;
      patch.hoursToFirstResponse = hours;
    }
  }
  if (applyMetrics && outboundIso && !opp.bizFirstAttemptAt) {
    patch.bizFirstAttemptAt = outboundIso;
    patch.bizFirstAttemptChannel = "EMAIL";
  }
  const followUp = resolveFollowUpFlag(mailDirection);
  if (followUp !== null && shouldApplyFollowUpFlag(contactIso)) {
    if (opp.isFollowUp !== followUp) {
      patch.isFollowUp = followUp;
    }
    if (followUp === true && opp.snoozeUntil) {
      patch.snoozeUntil = null;
    }
  }
  if (!Object.keys(patch).length) {
    return false;
  }
  await setPendingWrite(opp.id, "gcp:email_contact_sync", PENDING_WRITE_TTL_MS);
  await patchTwentyRecord("opportunities", opp.id, patch);
  await clearPendingWrite(opp.id, "gcp:email_contact_sync");
  return Boolean(patch.firstResponseAt);
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
  const threadOpp = await findOpenOpportunityFromThreadTarget(
    message.messageThreadId,
  );
  const kind = resolveEmailContactKind({
    clientParticipant: participant,
    threadOpportunityId: threadOpp?.id || null,
    direction: "OUTGOING",
    subject: message.subject,
  });
  if (kind === "SKIP") {
    return { skipped: "no_client_to" };
  }
  if (kind === "INTERNAL_OUT") {
    await markProcessed(associationId, threadOpp.id, messageId, {
      skipped: "internal_handoff_out",
    });
    return { skipped: "internal_handoff_out", opportunityId: threadOpp.id };
  }

  const opp = await resolveOpenOpportunity(participant, threadOpp);
  if (!opp) {
    return { skipped: "no_open_opp" };
  }

  const contactIso = messageContactIso(message, assoc);
  const m2Written = await touchContactFields(
    opp,
    contactIso,
    contactIso,
    "OUTGOING",
  );

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
    m2Written,
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
    m2Written ? "m2=written" : "m2=skip",
  );
  return {
    direction: "OUTGOING",
    contactUpdated: true,
    m2Written,
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
  const threadOpp = await findOpenOpportunityFromThreadTarget(
    message.messageThreadId,
  );
  const kind = resolveEmailContactKind({
    clientParticipant: participant,
    threadOpportunityId: threadOpp?.id || null,
    direction: "INCOMING",
    subject: message.subject,
  });
  if (kind === "SKIP") {
    return { skipped: "no_client_from" };
  }

  const opp =
    kind === "INTERNAL_IN"
      ? threadOpp
      : await resolveOpenOpportunity(participant, threadOpp);
  if (!opp) {
    return { skipped: "no_open_opp" };
  }

  const contactIso = messageContactIso(message, assoc);
  await touchContactFields(opp, contactIso, null, "INCOMING", {
    metrics: kind !== "INTERNAL_IN",
  });
  await markProcessed(associationId, opp.id, messageId, {
    direction: "INCOMING",
    internalHandoff: kind === "INTERNAL_IN",
  });

  console.log(
    "EMAIL_CONTACT: INCOMING OK",
    opp.id,
    opp.name,
    kind === "INTERNAL_IN" ? "internal_handoff" : `person=${participant.personId}`,
    "msg=",
    messageId,
  );
  return {
    direction: "INCOMING",
    contactUpdated: true,
    opportunityId: opp.id,
    opportunityName: opp.name,
    personId: participant?.personId || null,
    internalHandoff: kind === "INTERNAL_IN",
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
