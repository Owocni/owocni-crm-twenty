"use strict";

const crypto = require("crypto");
const {
  CREATE_LEAD_BUILD_ID,
  MAX_CALL_TRANSCRIPT_TASKS,
  PENDING_WRITE_TTL_MS,
  getPhoneOwnerMap,
} = require("../shared/config");
const {
  fetchPendingTasksByJobType,
  putTaskDocument,
  putTwentyStateDocument,
  setPendingWrite,
  clearPendingWrite,
} = require("../shared/stapeStore");
const {
  twentyRequest,
  parseTwentyListRecords,
  patchTwentyRecord,
  buildTwentyListPath,
} = require("../shared/twentyRest");
const { resolveForwardLastContactAt } = require("../shared/lastContact");
const { postCallTimelineOnLead } = require("../shared/callTimeline");

const ADAPTER_ID = "crm:call_transcript_ingest";
const CLOSED_STAGES = new Set(["WON", "LOST"]);
const VOICEMAIL_RE =
  /niedost[eę]pny|nie odpowiada|po sygnale|nagraj wiadomo[sś][cć]|skrzynk[aę] głosow|pozostaw wiadomo[sś][cć]|użytkownik,? do którego/i;

function isEnabled() {
  const flag = process.env.CALL_TRANSCRIPT_INGEST_ENABLED;
  if (flag === undefined || flag === "") return true;
  return flag === "true" || flag === "1";
}

function ourPhoneNumbers() {
  const raw = process.env.OUR_PHONE_NUMBERS || "48660970980,48570704470";
  return raw
    .split(",")
    .map((item) => digitsOnly(item))
    .filter(Boolean);
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePhoneE164(value) {
  let digits = digitsOnly(value);
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 9) return `+48${digits}`;
  if (digits.length === 11 && digits.startsWith("48")) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

function nationalNumber(e164) {
  const digits = digitsOnly(e164);
  if (digits.startsWith("48") && digits.length === 11) return digits.slice(2);
  if (digits.length === 9) return digits;
  return digits;
}

function phoneHandleVariants(clientHandle) {
  const variants = new Set();
  const digits = digitsOnly(clientHandle);
  const e164 = normalizePhoneE164(clientHandle);
  const national = nationalNumber(clientHandle);
  if (e164) variants.add(e164);
  if (national) {
    variants.add(national);
    variants.add(`+48${national}`);
    variants.add(`48${national}`);
  }
  if (digits) variants.add(digits);
  if (digits.length === 11 && digits.startsWith("48")) {
    variants.add(digits.slice(2));
  }
  return [...variants].filter(Boolean);
}

function resolveDirection(taskData) {
  const explicit = String(taskData.direction || "").toUpperCase();
  if (explicit === "INBOUND" || explicit === "OUTBOUND") return explicit;
  if (explicit === "MT") return "INBOUND";
  if (explicit === "MO") return "OUTBOUND";

  const calling = digitsOnly(taskData.callingNumber);
  const called = digitsOnly(taskData.calledNumber);
  const ours = ourPhoneNumbers();
  if (ours.includes(called) && !ours.includes(calling)) return "INBOUND";
  if (ours.includes(calling) && !ours.includes(called)) return "OUTBOUND";
  return "INBOUND";
}

function clientPhone(taskData) {
  const calling = normalizePhoneE164(taskData.callingNumber);
  const called = normalizePhoneE164(taskData.calledNumber);
  const ours = ourPhoneNumbers();
  const callingDigits = digitsOnly(calling);
  const calledDigits = digitsOnly(called);
  if (callingDigits && !ours.includes(callingDigits)) return calling;
  if (calledDigits && !ours.includes(calledDigits)) return called;
  return calling || called;
}

function ourPhone(taskData) {
  const calling = digitsOnly(taskData.callingNumber);
  const called = digitsOnly(taskData.calledNumber);
  const ours = ourPhoneNumbers();
  if (ours.includes(called)) return normalizePhoneE164(taskData.calledNumber);
  if (ours.includes(calling)) return normalizePhoneE164(taskData.callingNumber);
  return null;
}

function resolveSalesOwnerId(ourHandle, explicitOwnerId) {
  if (explicitOwnerId) return explicitOwnerId;
  const digits = digitsOnly(ourHandle);
  if (!digits) return null;
  return getPhoneOwnerMap()[digits] || null;
}

function resolveMatchStatus(personMatch) {
  if (personMatch?.conflict) return "CONFLICT";
  if (personMatch?.personId) return "MATCHED";
  return "UNMATCHED";
}

function parkingTasksEnabled() {
  const flag = process.env.CALL_TRANSCRIPT_PARKING_TASKS;
  if (flag === undefined || flag === "") return false;
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

function transcriptCollection() {
  return process.env.CALL_TRANSCRIPT_OBJECT || "callTranscripts";
}

function participantCollection() {
  return process.env.CALL_TRANSCRIPT_PARTICIPANT_OBJECT ||
    "callTranscriptParticipants";
}

function toIsoTimestamp(value) {
  if (!value) return new Date().toISOString();
  const normalized = String(value).trim().replace(" ", "T");
  const parsed = Date.parse(normalized);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return new Date().toISOString();
}

function buildTitle(taskData, clientHandle) {
  const ts = String(taskData.timestamp || "").slice(0, 16);
  return `Rozmowa ${clientHandle || "nieznany"} ${ts}`.trim();
}

async function findExistingTranscript(externalCallId) {
  const path = buildTwentyListPath(
    transcriptCollection(),
    `externalCallId[eq]:${externalCallId}`,
    1,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`find transcript HTTP ${res.statusCode}`);
  }
  const rows = parseTwentyListRecords(transcriptCollection(), res.body);
  return rows[0] || null;
}

async function findPersonByPrimaryPhone(clientHandle) {
  const searchKeys = [
    ...new Set(
      phoneHandleVariants(clientHandle).map((variant) => nationalNumber(variant)),
    ),
  ].filter(Boolean);
  const matchesById = new Map();

  for (const national of searchKeys) {
    const path = buildTwentyListPath(
      "people",
      `phones.primaryPhoneNumber[eq]:${national}`,
      5,
    );
    const res = await twentyRequest("GET", path);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`find person HTTP ${res.statusCode}`);
    }
    const people = parseTwentyListRecords("people", res.body);
    for (const person of people) {
      const stored = digitsOnly(person?.phones?.primaryPhoneNumber);
      const target = nationalNumber(national);
      if (
        stored === target ||
        stored.endsWith(target.slice(-9)) ||
        target.endsWith(stored.slice(-9))
      ) {
        matchesById.set(person.id, person);
      }
    }
  }

  const matches = [...matchesById.values()];
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return { conflict: true, matches };
  return null;
}

async function findPersonFromParticipantHistory(clientHandle) {
  const personIds = new Set();
  for (const handle of phoneHandleVariants(clientHandle)) {
    const path = buildTwentyListPath(
      participantCollection(),
      `handle[eq]:${handle}`,
      20,
    );
    const res = await twentyRequest("GET", path);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`find participant history HTTP ${res.statusCode}`);
    }
    const parts = parseTwentyListRecords(participantCollection(), res.body);
    for (const part of parts) {
      if (part.personId) personIds.add(part.personId);
    }
  }
  const ids = [...personIds];
  if (ids.length === 1) return { personId: ids[0] };
  if (ids.length > 1) return { conflict: true, personIds: ids };
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

async function createTwentyRecord(collection, body) {
  const res = await twentyRequest("POST", `/${collection}`, body);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(
      `create ${collection} HTTP ${res.statusCode} ${res.rawBody?.slice?.(0, 400)}`,
    );
  }
  const data = res.body?.data || {};
  const singular = collection.endsWith("s") ? collection.slice(0, -1) : collection;
  const createKey =
    "create" + singular.charAt(0).toUpperCase() + singular.slice(1);
  const record =
    data[createKey] ||
    data[singular] ||
    data.person ||
    data.opportunity ||
    data.task ||
    {};
  return record.id || null;
}

async function createParkingTask(taskData, clientHandle, transcriptId) {
  const title = `Przypnij rozmowę ${clientHandle || "?"}`;
  const body =
    `Numer klienta: ${clientHandle || "?"}\n` +
    `Czas: ${taskData.timestamp || "?"}\n` +
    `Kierunek: ${resolveDirection(taskData)}\n` +
    `Transkrypt ID: ${transcriptId || "?"}`;
  const taskId = await createTwentyRecord("tasks", {
    title,
    bodyV2: { markdown: body },
    status: "TODO",
  });
  if (taskId && transcriptId) {
    await createTwentyRecord("taskTargets", {
      taskId,
      callTranscriptId: transcriptId,
    }).catch(() => null);
  }
  return taskId;
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
    direction === "OUTBOUND" &&
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

  if (String(opp.stage || "").toUpperCase() === "NEW" && direction === "OUTBOUND") {
    patch.stage = "CONTACTED";
    advanced = true;
  }

  if (!Object.keys(patch).length) {
    return { advanced: false, m2Written: false, lastContactAdvanced: false };
  }

  await setPendingWrite(opp.id, ADAPTER_ID, PENDING_WRITE_TTL_MS);
  await patchTwentyRecord("opportunities", opp.id, patch);
  await clearPendingWrite(opp.id, ADAPTER_ID);
  return {
    advanced,
    m2Written,
    lastContactAdvanced: Boolean(forward.advanced),
  };
}

async function resolvePersonId(clientHandle) {
  const history = await findPersonFromParticipantHistory(clientHandle);
  if (history?.personId) return { personId: history.personId, source: "history" };
  if (history?.conflict) return { conflict: true, source: "history" };

  const person = await findPersonByPrimaryPhone(clientHandle);
  if (person?.conflict) return { conflict: true, source: "primary_phone" };
  if (person?.id) return { personId: person.id, source: "primary_phone" };
  return { personId: null, source: "none" };
}

async function processOneTask(task) {
  const taskData = task.data || {};
  const externalCallId = String(taskData.externalCallId || "").trim();
  const transcript = String(taskData.transcript || "").trim();
  const summary = String(taskData.summary || transcript.slice(0, 500)).trim();

  if (!externalCallId) throw new Error("missing externalCallId");
  if (!transcript) throw new Error("missing transcript");

  const existing = await findExistingTranscript(externalCallId);
  if (existing?.id) {
    await updateTaskDone(task.key, taskData, "already_exists");
    return { skipped: "already_exists", transcriptId: existing.id };
  }

  const clientHandle = clientPhone(taskData);
  const ourHandle = ourPhone(taskData);
  const direction = resolveDirection(taskData);
  const startedAtIso = toIsoTimestamp(taskData.timestamp);
  const salesOwnerId = resolveSalesOwnerId(
    ourHandle,
    taskData.workspaceMemberId || null,
  );
  const personMatch = clientHandle
    ? await resolvePersonId(clientHandle)
    : { personId: null, source: "none" };
  const matchStatus = resolveMatchStatus(personMatch);

  let opportunity = null;
  if (personMatch.personId && !personMatch.conflict) {
    opportunity = await findNewestOpenOpportunity(personMatch.personId);
  }

  const transcriptId = await createTwentyRecord(transcriptCollection(), {
    name: clientHandle || buildTitle(taskData, clientHandle),
    title: buildTitle(taskData, clientHandle),
    externalCallId,
    clientPhone: clientHandle,
    ourPhone: ourHandle,
    matchStatus,
    ownerId: salesOwnerId,
    startedAt: startedAtIso,
    endedAt: startedAtIso,
    direction,
    transcript: { markdown: transcript },
    summary: { markdown: summary },
    recording: taskData.recordingWebUrl
      ? { primaryLinkUrl: taskData.recordingWebUrl }
      : undefined,
    opportunityId: opportunity?.id || null,
  });

  if (!transcriptId) throw new Error("CallTranscript create returned no id");

  await createTwentyRecord(participantCollection(), {
    handle: clientHandle,
    displayName: clientHandle,
    participantRole: direction === "INBOUND" ? "CALLER" : "CALLEE",
    callTranscriptId: transcriptId,
    personId: personMatch.conflict ? null : personMatch.personId || null,
  });

  await createTwentyRecord(participantCollection(), {
    handle: ourHandle,
    displayName: ourHandle,
    participantRole: direction === "INBOUND" ? "CALLEE" : "CALLER",
    callTranscriptId: transcriptId,
    workspaceMemberId: salesOwnerId,
  });

  let parkingTaskId = null;
  if (
    parkingTasksEnabled() &&
    (!personMatch.personId || personMatch.conflict)
  ) {
    parkingTaskId = await createParkingTask(taskData, clientHandle, transcriptId);
  }

  let contact = null;
  let timeline = null;
  if (opportunity?.id) {
    contact = await touchOpportunity(opportunity, startedAtIso, direction);
    timeline = await postCallTimelineOnLead({
      transcript: {
        id: transcriptId,
        title: buildTitle(taskData, clientHandle),
        name: clientHandle,
        clientPhone: clientHandle,
        ourPhone: ourHandle,
        direction,
        startedAt: startedAtIso,
        createdAt: startedAtIso,
        summary: { markdown: summary },
        recording: taskData.recordingWebUrl
          ? { primaryLinkUrl: taskData.recordingWebUrl }
          : null,
      },
      opportunityId: opportunity.id,
      personId: personMatch.personId || null,
    }).catch((err) => {
      console.warn("call timeline post failed:", err.message);
      return { error: err.message };
    });
  }

  await putTwentyStateDocument(`call_transcript_processed_${externalCallId}`, {
    processed: true,
    transcript_id: transcriptId,
    person_id: personMatch.personId || null,
    opportunity_id: opportunity?.id || null,
    parking_task_id: parkingTaskId,
    timeline_note_id: timeline?.noteId || null,
    updated_at: Date.now(),
  });
  await updateTaskDone(task.key, taskData, "created");

  return {
    transcriptId,
    personId: personMatch.personId || null,
    opportunityId: opportunity?.id || null,
    parkingTaskId,
    contact,
    timeline,
    matchSource: personMatch.source,
    conflict: Boolean(personMatch.conflict),
  };
}

async function updateTaskDone(taskKey, taskData, result) {
  const updated = structuredClone(taskData);
  updated.status = "done";
  updated.result = result;
  updated.completed_at = Date.now();
  await putTaskDocument(taskKey, updated);
}

async function updateTaskFailed(taskKey, taskData, message) {
  const updated = structuredClone(taskData);
  updated.status = "failed";
  updated.error = message;
  updated.failed_at = Date.now();
  await putTaskDocument(taskKey, updated);
}

async function enqueueCallTranscriptTask(payload, environment) {
  const externalCallId = String(payload.externalCallId || "").trim();
  if (!externalCallId) throw new Error("missing externalCallId");

  const transcript = String(payload.transcript || "").trim();
  if (!transcript) throw new Error("missing transcript");
  if (transcript.length < 100 && VOICEMAIL_RE.test(transcript)) {
    return { skipped: "voicemail_heuristic" };
  }

  const taskId = `${externalCallId}_crm_call_transcript_ingest`;
  const timestamp = Date.now();
  await putTaskDocument(taskId, {
    job_type: ADAPTER_ID,
    status: "pending",
    created_at: timestamp,
    environment: environment || payload.environment || "prod",
    adapter: ADAPTER_ID,
    src_system: "PLAY_PBX",
    externalCallId,
    timestamp: payload.timestamp,
    direction: payload.direction,
    callingNumber: payload.callingNumber,
    calledNumber: payload.calledNumber,
    transcript,
    summary: payload.summary || "",
    recordingWebUrl: payload.recordingWebUrl || null,
    workspaceMemberId: payload.workspaceMemberId || null,
  });
  return { taskId, enqueued: true };
}

async function runCallTranscriptIngestWorker() {
  if (!isEnabled()) {
    return { skipped: "disabled" };
  }

  const tasks = await fetchPendingTasksByJobType(
    ADAPTER_ID,
    MAX_CALL_TRANSCRIPT_TASKS * 10,
  );
  const stats = { processed: 0, failed: 0 };
  const slice = tasks.slice(0, MAX_CALL_TRANSCRIPT_TASKS);

  for (const task of slice) {
    try {
      await processOneTask(task);
      stats.processed += 1;
    } catch (err) {
      stats.failed += 1;
      console.error(ADAPTER_ID, "FAIL", task.key, err.message);
      await updateTaskFailed(task.key, task.data || {}, err.message);
    }
  }

  return stats;
}

module.exports = {
  ADAPTER_ID,
  enqueueCallTranscriptTask,
  runCallTranscriptIngestWorker,
  normalizePhoneE164,
};
