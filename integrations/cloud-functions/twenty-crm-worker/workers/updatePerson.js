"use strict";

const crypto = require("crypto");
const {
  MAX_UPDATE_PERSON_TASKS,
  PENDING_WRITE_TTL_MS,
} = require("../shared/config");
const {
  fetchPendingTasksByJobType,
  putTaskDocument,
  setPendingWrite,
} = require("../shared/stapeStore");
const {
  patchTwentyRecord,
  extractPatchedIdOid,
} = require("../shared/twentyRest");

const ADAPTER_ID = "crm:twenty_update_person";

function generateULID() {
  const chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let result = "";
  const bytes = crypto.randomBytes(26);
  for (let i = 0; i < 26; i++) {
    result += chars.charAt(bytes[i] % 32);
  }
  return result;
}

async function patchTwentyIdOid(collection, recordId, idOid) {
  const body = await patchTwentyRecord(collection, recordId, { idOid });
  const patchedIdOid = extractPatchedIdOid(collection, body);
  if (patchedIdOid && patchedIdOid !== idOid) {
    throw new Error(
      `PATCH idOid mismatch expected=${idOid} got=${patchedIdOid}`,
    );
  }
}

async function updateTaskDone(taskKey, taskData, idOid) {
  const updated = structuredClone(taskData);
  updated.status = "done";
  updated.id_oid = idOid;
  updated.backfill_completed_at = Date.now();
  updated.backfill_runtime = "gcp";
  await putTaskDocument(taskKey, updated);
}

async function processOneTask(task) {
  const taskData = task.data || {};
  let opportunityId = taskData.opportunity_id || "";
  let personId = taskData.person_id || "";
  let idOid = taskData.id_oid || "";

  if (!opportunityId && !personId) {
    throw new Error("missing opportunity_id and person_id");
  }

  console.log(
    ADAPTER_ID,
    "task",
    task.key,
    "person=",
    personId,
    "opp=",
    opportunityId,
    "id_oid=",
    idOid,
  );

  if (!idOid || idOid === "pending_mint" || idOid === "no_oid") {
    idOid = generateULID();
    console.log(
      ADAPTER_ID,
      "mint idOid",
      idOid,
      "opp=",
      opportunityId,
      "person=",
      personId,
    );
  }

  if (opportunityId) {
    await setPendingWrite(opportunityId, ADAPTER_ID, PENDING_WRITE_TTL_MS);
    if (personId) {
      console.log(ADAPTER_ID, "PATCH Person start", personId, idOid);
      await patchTwentyIdOid("people", personId, idOid);
    }
    await patchTwentyIdOid("opportunities", opportunityId, idOid);
    await updateTaskDone(task.key, taskData, idOid);
    console.log(ADAPTER_ID, "OK backfill", personId || opportunityId, idOid);
    return;
  }

  if (!personId) throw new Error("person backfill missing person_id");
  console.log(ADAPTER_ID, "PATCH Person start", personId, idOid);
  await patchTwentyIdOid("people", personId, idOid);
  await updateTaskDone(task.key, taskData, idOid);
  console.log(ADAPTER_ID, "OK backfill", personId, idOid);
}

async function runUpdatePersonWorker() {
  console.log("=== update_person worker (GCP) ===", ADAPTER_ID);
  const tasks = await fetchPendingTasksByJobType(
    ADAPTER_ID,
    MAX_UPDATE_PERSON_TASKS * 10,
  );
  console.log(ADAPTER_ID, "pending CRM tasks:", tasks.length);

  const stats = { processed: 0, failed: 0 };
  const slice = tasks.slice(0, MAX_UPDATE_PERSON_TASKS);

  for (const task of slice) {
    try {
      await processOneTask(task);
      stats.processed += 1;
    } catch (err) {
      stats.failed += 1;
      console.error(ADAPTER_ID, "FAIL", task.key, err.message);
    }
  }

  console.log(
    ADAPTER_ID,
    "done processed=",
    stats.processed,
    "failed=",
    stats.failed,
  );
  return stats;
}

module.exports = { runUpdatePersonWorker, ADAPTER_ID };
