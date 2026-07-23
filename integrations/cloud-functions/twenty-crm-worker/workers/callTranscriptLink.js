"use strict";

const crypto = require("crypto");
const { PENDING_WRITE_TTL_MS } = require("../shared/config");
const {
  twentyRequest,
  parseTwentyListRecords,
  patchTwentyRecord,
  buildTwentyListPath,
  extractCreatedId,
} = require("../shared/twentyRest");
const { resolveForwardLastContactAt } = require("../shared/lastContact");

const ADAPTER_ID = "crm:call_transcript_link";

function transcriptCollection() {
  return process.env.CALL_TRANSCRIPT_OBJECT || "callTranscripts";
}

function participantCollection() {
  return process.env.CALL_TRANSCRIPT_PARTICIPANT_OBJECT ||
    "callTranscriptParticipants";
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function nationalNumber(value) {
  const digits = digitsOnly(value);
  if (digits.startsWith("48") && digits.length === 11) return digits.slice(2);
  if (digits.length === 9) return digits;
  return digits;
}

function formatPhoneForTwenty(raw) {
  const national = nationalNumber(raw);
  if (!national || national.length < 7) return null;
  if (national.length === 9) {
    return { primaryPhoneCallingCode: "+48", primaryPhoneNumber: national };
  }
  return { primaryPhoneCallingCode: "+48", primaryPhoneNumber: national };
}

function generateULID() {
  const chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let result = "";
  const bytes = crypto.randomBytes(26);
  for (let i = 0; i < 26; i++) {
    result += chars.charAt(bytes[i] % 32);
  }
  return result;
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

async function getRecord(collection, recordId) {
  const res = await twentyRequest(
    "GET",
    `/${collection}/${encodeURIComponent(recordId)}`,
  );
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`GET ${collection} HTTP ${res.statusCode}`);
  }
  const singular = collection.endsWith("s") ? collection.slice(0, -1) : collection;
  return (
    res.body?.data?.[singular] ||
    res.body?.data?.person ||
    res.body?.data?.opportunity ||
    res.body?.data?.callTranscript ||
    {}
  );
}

async function listParticipantsForTranscript(transcriptId) {
  const path = buildTwentyListPath(
    participantCollection(),
    `callTranscriptId[eq]:${transcriptId}`,
    10,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`list participants HTTP ${res.statusCode}`);
  }
  return parseTwentyListRecords(participantCollection(), res.body);
}

function clientParticipantRole(direction) {
  return String(direction || "").toUpperCase() === "OUTBOUND" ? "CALLEE" : "CALLER";
}

function findClientParticipant(participants, direction) {
  const role = clientParticipantRole(direction);
  const byRole = participants.filter(
    (part) =>
      String(part.participantRole || "").toUpperCase() === role &&
      !part.workspaceMemberId,
  );
  if (byRole.length === 1) return byRole[0];
  const nonStaff = participants.filter((part) => !part.workspaceMemberId);
  if (nonStaff.length === 1) return nonStaff[0];
  return byRole[0] || nonStaff[0] || null;
}

async function touchOpportunity(opp, startedAtIso, direction) {
  const patch = {};
  const forward = resolveForwardLastContactAt(opp.lastContactAt, startedAtIso);
  if (forward.advanced && forward.lastContactAt) {
    patch.lastContactAt = forward.lastContactAt;
    patch.bizLastContactLabel = buildContactLabelFresh();
  }
  let advanced = false;
  let m2Written = false;

  if (
    String(direction || "").toUpperCase() === "OUTBOUND" &&
    !hasFirstResponseMetrics(opp) &&
    startedAtIso
  ) {
    const hours = computeHoursToFirstResponse(opp.createdAt, startedAtIso);
    if (hours !== null) {
      patch.firstResponseAt = startedAtIso;
      patch.hoursToFirstResponse = hours;
      m2Written = true;
    }
  }

  if (
    String(opp.stage || "").toUpperCase() === "NEW" &&
    String(direction || "").toUpperCase() === "OUTBOUND"
  ) {
    patch.stage = "CONTACTED";
    advanced = true;
  }

  if (!Object.keys(patch).length) {
    return { advanced: false, m2Written: false, lastContactAdvanced: false };
  }

  await patchTwentyRecord("opportunities", opp.id, patch);
  return {
    advanced,
    m2Written,
    lastContactAdvanced: Boolean(forward.advanced),
  };
}

async function ensurePersonPhone(personId, clientPhone) {
  if (!personId || !clientPhone) return false;
  const person = await getRecord("people", personId);
  const existing = digitsOnly(person?.phones?.primaryPhoneNumber);
  const target = nationalNumber(clientPhone);
  if (existing && existing === target) return false;
  if (existing && existing.endsWith(target.slice(-9))) return false;
  const phoneFields = formatPhoneForTwenty(clientPhone);
  if (!phoneFields) return false;
  await patchTwentyRecord("people", personId, { phones: phoneFields });
  return true;
}

async function linkCallTranscriptToOpportunity(transcriptId, opportunityId) {
  const transcript = await getRecord(transcriptCollection(), transcriptId);
  if (!transcript?.id) throw new Error("call transcript not found");

  const opp = await getRecord("opportunities", opportunityId);
  if (!opp?.id) throw new Error("opportunity not found");

  const personId = opp.pointOfContactId;
  if (!personId) {
    throw new Error("Opportunity nie ma przypisanej osoby (Point of contact)");
  }

  const participants = await listParticipantsForTranscript(transcriptId);
  const clientPart = findClientParticipant(participants, transcript.direction);
  if (clientPart?.id) {
    await patchTwentyRecord(participantCollection(), clientPart.id, { personId });
  }

  await patchTwentyRecord(transcriptCollection(), transcriptId, {
    opportunityId,
    matchStatus: "MATCHED",
  });

  const phonePatched = await ensurePersonPhone(personId, transcript.clientPhone);
  const contact = await touchOpportunity(
    opp,
    transcript.startedAt || transcript.createdAt,
    transcript.direction,
  );

  return {
    transcriptId,
    opportunityId,
    personId,
    participantId: clientPart?.id || null,
    phonePatched,
    contact,
  };
}

async function createLeadFromCallTranscript({ transcriptId, contactName }) {
  const transcript = await getRecord(transcriptCollection(), transcriptId);
  if (!transcript?.id) throw new Error("call transcript not found");
  if (transcript.opportunityId) {
    return {
      skipped: "already_linked",
      transcriptId,
      opportunityId: transcript.opportunityId,
    };
  }

  const phone = String(transcript.clientPhone || "").trim();
  const idOid = generateULID();
  const label = String(contactName || phone || "Lead telefon").trim();
  const phoneFields = formatPhoneForTwenty(phone);

  const personBody = {
    name: { firstName: label, lastName: "" },
    idOid,
  };
  if (phoneFields) personBody.phones = phoneFields;

  const personRes = await twentyRequest("POST", "/people", personBody);
  if (personRes.statusCode < 200 || personRes.statusCode >= 300) {
    throw new Error(`POST people HTTP ${personRes.statusCode} ${personRes.rawBody}`);
  }
  const personId = extractCreatedId("people", personRes.body);
  if (!personId) throw new Error("POST people — brak id");

  const oppBody = {
    name: `Rozmowa ${label}`,
    stage: "NEW",
    idOid,
    srcSystem: "TWENTY_UI",
    ownerId: transcript.ownerId || null,
    pointOfContactId: personId,
    lastContactAt: transcript.startedAt || new Date().toISOString(),
    bizLastContactLabel: buildContactLabelFresh(),
    bizCardPhone: phone || null,
  };
  const oppRes = await twentyRequest("POST", "/opportunities", oppBody);
  if (oppRes.statusCode < 200 || oppRes.statusCode >= 300) {
    throw new Error(
      `POST opportunities HTTP ${oppRes.statusCode} ${oppRes.rawBody}`,
    );
  }
  const opportunityId = extractCreatedId("opportunities", oppRes.body);
  if (!opportunityId) throw new Error("POST opportunities — brak id");

  const linked = await linkCallTranscriptToOpportunity(transcriptId, opportunityId);
  return { created: true, idOid, ...linked };
}

function extractWebhookRecord(payload) {
  let record = payload.record || payload.data?.record || payload.data || payload;
  if (record?.record && typeof record.record === "object") {
    record = record.record;
  }
  let previous =
    payload.previousRecord ||
    payload.data?.previousRecord ||
    payload.before ||
    payload.data?.before ||
    null;
  if (previous?.record && typeof previous.record === "object") {
    previous = previous.record;
  }
  return { record, previous };
}

async function processCallTranscriptWebhook(webhookBody) {
  const payload = webhookBody || {};
  const eventName = String(
    payload.event ||
      payload.operation ||
      payload.type ||
      payload.name ||
      payload.eventName ||
      "",
  );
  const objectName = String(
    payload.objectMetadata?.nameSingular ||
      payload.objectName ||
      payload.data?.objectMetadata?.nameSingular ||
      "",
  ).toLowerCase();

  const isCallTranscriptEvent =
    eventName.toLowerCase().includes("calltranscript") ||
    objectName === "calltranscript";
  if (!isCallTranscriptEvent) {
    return { skipped: "unsupported_event", eventName, objectName };
  }

  const { record, previous } = extractWebhookRecord(payload);
  const transcriptId = record?.id;
  const opportunityId = record?.opportunityId || null;
  const previousOpportunityId = previous?.opportunityId || null;

  if (!transcriptId) {
    return { skipped: "missing_transcript_id", eventName };
  }
  if (!opportunityId || opportunityId === previousOpportunityId) {
    return {
      skipped: "no_opportunity_change",
      eventName,
      transcriptId,
      opportunityId,
      previousOpportunityId,
    };
  }

  const linked = await linkCallTranscriptToOpportunity(transcriptId, opportunityId);
  return { ok: true, mode: "webhook_link", eventName, ...linked };
}

module.exports = {
  ADAPTER_ID,
  linkCallTranscriptToOpportunity,
  createLeadFromCallTranscript,
  processCallTranscriptWebhook,
};
