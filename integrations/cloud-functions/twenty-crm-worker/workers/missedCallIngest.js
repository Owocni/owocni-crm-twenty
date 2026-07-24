"use strict";

/**
 * Play PBX missed calls (getCallHistory status=MISSED) → Opportunity counter.
 * Does NOT touch lastContactAt (P-11 / D-15: missed ≠ contact).
 */

const {
  MAX_CALL_TRANSCRIPT_TASKS,
  PENDING_WRITE_TTL_MS,
  getPhoneOwnerMap,
} = require("../shared/config");
const {
  fetchPendingTasksByJobType,
  putTaskDocument,
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
  extractCreatedId,
} = require("../shared/twentyRest");

const ADAPTER_ID = "crm:missed_call_ingest";
const PROCESSED_PREFIX = "missed_call_processed_";
const CLOSED_STAGES = new Set(["WON", "LOST"]);

function isEnabled() {
  const flag = process.env.MISSED_CALL_INGEST_ENABLED;
  if (flag === undefined || flag === "") return true;
  return flag === "true" || flag === "1";
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function ourPhoneDigits() {
  const fromMap = Object.keys(getPhoneOwnerMap() || {});
  const fromEnv = String(process.env.OUR_PHONE_NUMBERS || "")
    .split(",")
    .map((p) => digitsOnly(p))
    .filter(Boolean);
  return new Set([...fromMap, ...fromEnv]);
}

function toE164Plus(digits) {
  const d = digitsOnly(digits);
  if (!d) return null;
  if (d.length === 9) return `+48${d}`;
  if (d.startsWith("48") && d.length === 11) return `+${d}`;
  if (d.startsWith("00")) return `+${d.slice(2)}`;
  return d.startsWith("+") ? d : `+${d}`;
}

/** Client number for a Play CDR row (MT=inbound to us, MO=outbound from us). */
function clientPhoneFromCall(call) {
  const our = ourPhoneDigits();
  const calling = digitsOnly(call.callingNumber);
  const called = digitsOnly(call.calledNumber);
  const dir = String(call.direction || "").toUpperCase();
  if (dir === "MT" || our.has(called)) return toE164Plus(calling);
  if (dir === "MO" || our.has(calling)) return toE164Plus(called);
  if (!our.has(calling)) return toE164Plus(calling);
  return toE164Plus(called);
}

function toIsoTimestamp(raw) {
  if (!raw) return new Date().toISOString();
  const s = String(raw).trim();
  if (s.includes("T")) return new Date(s).toISOString();
  // Play: "2026-07-22 17:10:22" (Europe/Warsaw wall clock — treat as local +02 in summer is hard;
  // store as UTC by appending Z would be wrong. Prefer parse as local ISO without Z via Date.)
  const normalized = s.replace(" ", "T");
  const ms = Date.parse(normalized);
  if (Number.isFinite(ms)) return new Date(ms).toISOString();
  return new Date().toISOString();
}

function nationalVariants(e164) {
  const d = digitsOnly(e164);
  const out = new Set();
  if (!d) return [];
  out.add(d);
  if (d.startsWith("48") && d.length === 11) out.add(d.slice(2));
  if (d.length === 9) out.add(`48${d}`);
  return [...out];
}

async function findPersonByPhone(clientPhone) {
  const variants = nationalVariants(clientPhone);
  const found = [];
  for (const v of variants) {
    const path = buildTwentyListPath(
      "people",
      `phones.primaryPhoneNumber[eq]:${v}`,
      5,
    );
    const res = await twentyRequest("GET", path);
    if (res.statusCode < 200 || res.statusCode >= 300) continue;
    for (const p of parseTwentyListRecords("people", res.body)) {
      if (p?.id) found.push(p);
    }
  }
  const uniq = [...new Map(found.map((p) => [p.id, p])).values()];
  if (uniq.length > 1) return { conflict: true, people: uniq };
  if (uniq.length === 1) return { person: uniq[0] };
  return { person: null };
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

async function createNoteOnOpp(oppId, personId, title, markdown) {
  const noteRes = await twentyRequest("POST", "/notes", {
    title,
    bodyV2: { markdown },
  });
  if (noteRes.statusCode < 200 || noteRes.statusCode >= 300) return null;
  const noteId = extractCreatedId("notes", noteRes.body);
  if (!noteId) return null;
  await twentyRequest("POST", "/noteTargets", {
    noteId,
    opportunityId: oppId,
  }).catch(() => null);
  if (personId) {
    await twentyRequest("POST", "/noteTargets", {
      noteId,
      personId,
    }).catch(() => null);
  }
  return noteId;
}

async function processOneTask(task) {
  const data = task.data || {};
  const externalId = String(
    data.externalCallId || data.callSessionId || "",
  ).trim();
  if (!externalId) throw new Error("missing externalCallId/callSessionId");

  const stateKey = PROCESSED_PREFIX + externalId;
  const existing = await readTwentyStateDocument(stateKey);
  if (existing?.processed === true) {
    await updateTaskDone(task.key, data, "already_processed");
    return { skipped: "already_processed", externalId };
  }

  const clientPhone = clientPhoneFromCall(data);
  if (!clientPhone) {
    await updateTaskDone(task.key, data, "no_client_phone");
    return { skipped: "no_client_phone", externalId };
  }

  const match = await findPersonByPhone(clientPhone);
  if (match.conflict) {
    await putTwentyStateDocument(stateKey, {
      processed: true,
      skipped: "person_conflict",
      client_phone: clientPhone,
      updated_at: Date.now(),
    });
    await updateTaskDone(task.key, data, "person_conflict");
    return { skipped: "person_conflict", clientPhone, externalId };
  }
  if (!match.person?.id) {
    await putTwentyStateDocument(stateKey, {
      processed: true,
      skipped: "no_person",
      client_phone: clientPhone,
      updated_at: Date.now(),
    });
    await updateTaskDone(task.key, data, "no_person");
    return { skipped: "no_person", clientPhone, externalId };
  }

  const opp = await findNewestOpenOpportunity(match.person.id);
  if (!opp?.id) {
    await putTwentyStateDocument(stateKey, {
      processed: true,
      skipped: "no_open_opp",
      person_id: match.person.id,
      client_phone: clientPhone,
      updated_at: Date.now(),
    });
    await updateTaskDone(task.key, data, "no_open_opp");
    return {
      skipped: "no_open_opp",
      personId: match.person.id,
      clientPhone,
      externalId,
    };
  }

  const missedAt = toIsoTimestamp(data.timestamp);
  const prevCount = Number(opp.bizMissedCallsCount);
  const nextCount = (Number.isFinite(prevCount) ? prevCount : 0) + 1;
  const prevLast = opp.bizLastMissedCallAt;
  const prevMs = Date.parse(prevLast || "");
  const nextMs = Date.parse(missedAt);
  const lastPatch =
    !Number.isFinite(prevMs) || nextMs >= prevMs
      ? missedAt
      : prevLast;

  const patch = {
    bizMissedCallsCount: nextCount,
    bizLastMissedCallAt: lastPatch,
  };

  await setPendingWrite(opp.id, ADAPTER_ID, PENDING_WRITE_TTL_MS);
  await patchTwentyRecord("opportunities", opp.id, patch);
  await clearPendingWrite(opp.id, ADAPTER_ID);

  const dir =
    String(data.direction || "").toUpperCase() === "MO"
      ? "wychodzące (klient nie odebrał)"
      : "przychodzące (nieodebrane)";
  const noteId = await createNoteOnOpp(
    opp.id,
    match.person.id,
    `Nieodebrane · ${clientPhone}`,
    [
      `**Nieodebrane połączenie** (${dir})`,
      "",
      `Czas: ${data.timestamp || missedAt}`,
      `Klient: ${clientPhone}`,
      `Sesja Play: \`${externalId}\``,
      "",
      `_To nie jest kontakt — lastContactAt bez zmian._`,
    ].join("\n"),
  );

  await putTwentyStateDocument(stateKey, {
    processed: true,
    opportunity_id: opp.id,
    person_id: match.person.id,
    client_phone: clientPhone,
    count: nextCount,
    note_id: noteId,
    updated_at: Date.now(),
  });
  await updateTaskDone(task.key, data, "counted");

  return {
    opportunityId: opp.id,
    personId: match.person.id,
    clientPhone,
    count: nextCount,
    noteId,
    externalId,
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

async function enqueueMissedCallTask(payload, environment) {
  const externalCallId = String(
    payload.externalCallId || payload.callSessionId || "",
  ).trim();
  if (!externalCallId) throw new Error("missing externalCallId/callSessionId");

  const status = String(payload.status || "MISSED").toUpperCase();
  if (status !== "MISSED") {
    return { skipped: "not_missed", status };
  }

  const taskId = `${externalCallId}_crm_missed_call_ingest`;
  const timestamp = Date.now();
  await putTaskDocument(taskId, {
    job_type: ADAPTER_ID,
    status: "pending",
    created_at: timestamp,
    environment: environment || payload.environment || "prod",
    adapter: ADAPTER_ID,
    src_system: "PLAY_PBX",
    externalCallId,
    callSessionId: payload.callSessionId || externalCallId,
    timestamp: payload.timestamp,
    direction: payload.direction,
    callingNumber: payload.callingNumber,
    calledNumber: payload.calledNumber,
    callStatus: "MISSED",
    duration: payload.duration ?? 0,
  });
  return { taskId, enqueued: true };
}

async function runMissedCallIngestWorker() {
  if (!isEnabled()) {
    return { skipped: "disabled" };
  }

  const tasks = await fetchPendingTasksByJobType(
    ADAPTER_ID,
    MAX_CALL_TRANSCRIPT_TASKS * 10,
  );
  const stats = { processed: 0, failed: 0, results: [] };
  const slice = tasks.slice(0, MAX_CALL_TRANSCRIPT_TASKS);

  for (const task of slice) {
    try {
      const result = await processOneTask(task);
      stats.processed += 1;
      stats.results.push(result);
    } catch (err) {
      console.error("missed_call_ingest fail", task.key, err.message);
      await updateTaskFailed(task.key, task.data || {}, err.message);
      stats.failed += 1;
    }
  }
  return stats;
}

module.exports = {
  enqueueMissedCallTask,
  runMissedCallIngestWorker,
  clientPhoneFromCall,
  ADAPTER_ID,
};
