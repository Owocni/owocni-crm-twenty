/**
 * CRM_TWENTY_UPDATE_PERSON.sGTM.js
 * Worker: task_queue (job_type crm:twenty_update_person) → mint idOid → backfill Twenty.
 *
 * Wklej CAŁOŚĆ do Tag Template w sGTM.
 *
 * Permissions — włącz WSZYSTKIE 3:
 * - Logs to console, Reads event data, Sends HTTP requests
 *
 * Trigger: Custom Event `crm_twenty_update_person` (z Clienta POST /crm/twenty_worker)
 *
 * Zmienne kontenera: twenty_rest_url, twenty_api_key
 * (getEventData może nie widzieć Constants — uzupełnij TWENTY_* poniżej jak STORE w inbound)
 *
 * SSOT: EVENT_CONTRACT §6.1, pending_write_twenty_{opportunityId} (sync z INBOUND_TWENTY_WEBHOOK.sGTM.js)
 */

const sendHttpRequest = require("sendHttpRequest");
const JSON = require("JSON");
const logToConsole = require("logToConsole");
const getTimestampMillis = require("getTimestampMillis");
const makeString = require("makeString");
const encodeUriComponent = require("encodeUriComponent");
const getEventData = require("getEventData");
const generateRandom = require("generateRandom");

var ADAPTER_ID = "crm:twenty_update_person";
var COLLECTION_TASK_QUEUE = "task_queue";
var PENDING_WRITE_PREFIX = "pending_write_twenty_";

// Store — jawnie (wzorzec jak INBOUND_TWENTY_WEBHOOK.sGTM.js)
var BASE_URL = "https://uinpcbwf.eug.stape.io";
var API_KEY = "2d389d8d0875343a76c07c6ff388c586bbd9347duinpcbwf";
var API_BASE = BASE_URL + "/stape-api/" + API_KEY + "/v2/store/collections";

// Twenty — z Constants lub wpisz jawnie jeśli getEventData zwraca puste na workerze
var TWENTY_REST_URL = "https://api.twenty.com/rest";
var TWENTY_API_KEY = "";

var PENDING_WRITE_TTL_MS = 45000;
var MAX_TASKS_PER_RUN = 10;

function getEventDataWithFallback(key) {
  var result = getEventData(key);
  if (
    (result === null || result === undefined) &&
    data &&
    data.eventData &&
    typeof data.eventData === "object"
  ) {
    result = data.eventData[key];
  }
  return result;
}

function finish(ok) {
  if (ok) {
    data.gtmOnSuccess();
  } else {
    data.gtmOnFailure();
  }
}

function generateULID() {
  var chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  var result = "";
  var i = 0;
  while (i < 26) {
    result = result + chars.charAt(generateRandom(0, 31));
    i = i + 1;
  }
  return result;
}

function unwrapStoreDocument(body) {
  if (!body || typeof body !== "object") {
    return {};
  }
  if (body.data && body.data.data && typeof body.data.data === "object") {
    return body.data.data;
  }
  if (body.active !== undefined || body.status !== undefined) {
    return body;
  }
  if (body.data && typeof body.data === "object") {
    return body.data;
  }
  return body;
}

function stripTrailingSlash(url) {
  url = makeString(url);
  if (url.length > 0 && url.charAt(url.length - 1) === "/") {
    return url.substring(0, url.length - 1);
  }
  return url;
}

function resolveTwentyConfig() {
  var restUrl = stripTrailingSlash(
    getEventDataWithFallback("twenty_rest_url") || TWENTY_REST_URL,
  );
  var apiKey = makeString(
    getEventDataWithFallback("twenty_api_key") || TWENTY_API_KEY,
  );
  return { restUrl: restUrl, apiKey: apiKey };
}

function fetchPendingCrmTasks(callback) {
  var url = API_BASE + "/" + COLLECTION_TASK_QUEUE + "/documents";
  var requestBody = {
    filter: {},
    pagination: {
      sort: [{ field: "created_at", order: "asc" }],
      limit: 100,
    },
  };

  sendHttpRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }, JSON.stringify(requestBody))
    .then(function (res) {
      var parsed = JSON.parse(res.body || "{}");
      var items = (parsed.data && parsed.data.items) || [];
      var tasks = [];
      var i = 0;
      while (i < items.length) {
        var item = items[i];
        var taskData = item.data || {};
        if (
          taskData.status === "pending" &&
          taskData.job_type === ADAPTER_ID
        ) {
          tasks.push({
            key: item.key,
            data: taskData,
          });
        }
        i = i + 1;
      }
      callback(null, tasks);
    })
    .catch(function (err) {
      callback(err, []);
    });
}

function setPendingWrite(opportunityId, callback) {
  var docKey = PENDING_WRITE_PREFIX + opportunityId;
  var doc = {
    active: true,
    adapter: ADAPTER_ID,
    expires_at: getTimestampMillis() + PENDING_WRITE_TTL_MS,
  };
  var url = API_BASE + "/twenty_state/documents/" + encodeUriComponent(docKey);
  sendHttpRequest(
    url,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify(doc),
  )
    .then(function () {
      logToConsole(ADAPTER_ID, "pending-write SET", docKey);
      callback(null);
    })
    .catch(function (err) {
      callback(err);
    });
}

function patchOpportunityIdOid(opportunityId, idOid, twentyCfg, callback) {
  var url =
    twentyCfg.restUrl +
    "/opportunities/" +
    encodeUriComponent(opportunityId);
  var body = { idOid: idOid };

  sendHttpRequest(
    url,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + twentyCfg.apiKey,
      },
    },
    JSON.stringify(body),
  )
    .then(function (res) {
      logToConsole(
        ADAPTER_ID,
        "PATCH Opportunity idOid",
        opportunityId,
        "status=",
        res.statusCode,
      );
      if (res.statusCode >= 200 && res.statusCode < 300) {
        callback(null, res);
      } else {
        callback("HTTP " + res.statusCode + " " + (res.body || ""), null);
      }
    })
    .catch(function (err) {
      callback(err, null);
    });
}

function updateTaskDone(taskKey, taskData, idOid, callback) {
  var updated = JSON.parse(JSON.stringify(taskData));
  updated.status = "done";
  updated.id_oid = idOid;
  updated.backfill_completed_at = getTimestampMillis();

  var url =
    API_BASE +
    "/" +
    COLLECTION_TASK_QUEUE +
    "/documents/" +
    encodeUriComponent(taskKey);

  sendHttpRequest(
    url,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify(updated),
  )
    .then(function () {
      callback(null);
    })
    .catch(function (err) {
      callback(err);
    });
}

function processOneTask(task, twentyCfg, onComplete) {
  var taskData = task.data || {};
  var opportunityId = taskData.opportunity_id || "";
  var idOid = taskData.id_oid || "";

  if (!opportunityId) {
    logToConsole(ADAPTER_ID, "SKIP — brak opportunity_id", task.key);
    onComplete(null);
    return;
  }

  if (!idOid || idOid === "pending_mint" || idOid === "no_oid") {
    idOid = generateULID();
    logToConsole(ADAPTER_ID, "mint idOid", idOid, "opp=", opportunityId);
  }

  if (!twentyCfg.apiKey) {
    logToConsole(ADAPTER_ID, "ERROR — brak twenty_api_key");
    onComplete("missing twenty_api_key");
    return;
  }

  setPendingWrite(opportunityId, function (pendingErr) {
    if (pendingErr) {
      logToConsole(ADAPTER_ID, "pending-write ERROR", pendingErr);
      onComplete(pendingErr);
      return;
    }

    patchOpportunityIdOid(opportunityId, idOid, twentyCfg, function (patchErr) {
      if (patchErr) {
        logToConsole(ADAPTER_ID, "Twenty PATCH ERROR", patchErr);
        onComplete(patchErr);
        return;
      }

      updateTaskDone(task.key, taskData, idOid, function (storeErr) {
        if (storeErr) {
          logToConsole(ADAPTER_ID, "task_queue update ERROR", storeErr);
          onComplete(storeErr);
          return;
        }
        logToConsole(ADAPTER_ID, "OK backfill", opportunityId, idOid);
        onComplete(null);
      });
    });
  });
}

function processTasksSequential(tasks, twentyCfg, index, stats, onAllDone) {
  if (index >= tasks.length || index >= MAX_TASKS_PER_RUN) {
    onAllDone(null, stats);
    return;
  }

  processOneTask(tasks[index], twentyCfg, function (err) {
    if (err) {
      stats.failed = stats.failed + 1;
    } else {
      stats.processed = stats.processed + 1;
    }
    processTasksSequential(tasks, twentyCfg, index + 1, stats, onAllDone);
  });
}

function processCrmWorkerQueue(onComplete) {
  var twentyCfg = resolveTwentyConfig();
  logToConsole("=== CRM_TWENTY_UPDATE_PERSON worker ===", ADAPTER_ID);

  fetchPendingCrmTasks(function (err, tasks) {
    if (err) {
      logToConsole(ADAPTER_ID, "fetch ERROR", err);
      onComplete(err);
      return;
    }

    logToConsole(ADAPTER_ID, "pending CRM tasks:", tasks.length);

    if (tasks.length === 0) {
      onComplete(null);
      return;
    }

    var stats = { processed: 0, failed: 0 };
    processTasksSequential(tasks, twentyCfg, 0, stats, function (seqErr, finalStats) {
      logToConsole(
        ADAPTER_ID,
        "done processed=",
        finalStats.processed,
        "failed=",
        finalStats.failed,
      );
      onComplete(seqErr);
    });
  });
}

// --- ENTRY POINT ---
processCrmWorkerQueue(function (err) {
  finish(!err);
});
