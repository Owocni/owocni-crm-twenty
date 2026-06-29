/**
 * CRM_TWENTY_CREATE_LEAD.sGTM.js
 * Worker: task_queue (job_type crm:twenty_create_lead) → Person + Opportunity w Twenty.
 *
 * Wklej CAŁOŚĆ do Tag Template w sGTM.
 *
 * Permissions — włącz WSZYSTKIE 3:
 * - Logs to console, Reads event data, Sends HTTP requests
 *
 * Trigger: Custom Event `crm_twenty_create_lead` (z TWENTY_CRM_WORKER_CLIENT po POST /crm/twenty_worker)
 *
 * SSOT: ARCHITECTURE §5.3, DATA_MODEL (idOid, srcSystem, bizSource, bizProduct)
 * Loop-prevention: pending_write_twenty_{opportunityId} (sync z INBOUND + UPDATE_PERSON)
 *
 * Bezpieczeństwo fazy równoległej:
 * - CREATE_LEAD_WRITE_ENABLED = false → log payload + task done (log_only), bez Twenty API
 * - true → zapis do Twenty sandbox (domyślnie w pliku Fazy B)
 * - BB / julia362 bez zmian — ten adapter nie dotyka Supabase
 */

const sendHttpRequest = require("sendHttpRequest");
const JSON = require("JSON");
const logToConsole = require("logToConsole");
const getTimestampMillis = require("getTimestampMillis");
const makeString = require("makeString");
const encodeUriComponent = require("encodeUriComponent");
const getEventData = require("getEventData");

var ADAPTER_ID = "crm:twenty_create_lead";
var COLLECTION_TASK_QUEUE = "task_queue";
var PENDING_WRITE_PREFIX = "pending_write_twenty_";
var STATE_PREFIX = "create_lead_id_oid_";

// Faza B (sandbox): zapis Person+Opp w Twenty. Ustaw false tylko na test kolejki bez API.
var CREATE_LEAD_WRITE_ENABLED = true;
// Marker w Storage/audit — zmień przy publish, żeby potwierdzić wersję w CSV
var CREATE_LEAD_BUILD_ID = "2026-06-29-write-v4-filter-fix";

var PENDING_WRITE_TTL_MS = 45000;
var MAX_TASKS_PER_RUN = 5;

// Store — jawnie (wzorzec jak CRM_TWENTY_UPDATE_PERSON.sGTM.js)
var BASE_URL = "https://uinpcbwf.eug.stape.io";
var API_KEY = "2d389d8d0875343a76c07c6ff388c586bbd9347duinpcbwf";
var API_BASE = BASE_URL + "/stape-api/" + API_KEY + "/v2/store/collections";

// Twenty sandbox — podmień przy prod cutover
var TWENTY_REST_URL = "https://api.twenty.com/rest";
var TWENTY_API_KEY =
  "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjBiZjg2YmY5LTVhNTgtNGRmYi1iMWZhLWVmOWYzYTk2ODRhMCJ9.eyJzdWIiOiIyNTM0YjE5My01NTIzLTRlOWQtYjQ1Yy1hZTczODE4ZGM3MjQiLCJ0eXBlIjoiQVBJX0tFWSIsIndvcmtzcGFjZUlkIjoiMjUzNGIxOTMtNTUyMy00ZTlkLWI0NWMtYWU3MzgxOGRjNzI0IiwiaWF0IjoxNzgwOTE1MDYyLCJleHAiOjQ5MzQ0Mjg2NjEsImp0aSI6ImEzNGQ4NzQzLTJjMjgtNGQ1MS1iMTU5LTQ3NmMyYjZlMzg4MSJ9.WHGh70YFp7J8kARqIdHvNES2DeGchijlj5F32RHdrXBrOSgzTK9prXRkppWATorI9625JWRGCQZwi6keyR_urA";

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

function getEventWriteFlag() {
  return getEventDataWithFallback("twenty_create_lead_write");
}

// Szablon (CREATE_LEAD_WRITE_ENABLED=true) ma pierwszeństwo — zmienna GTM
// twenty_create_lead_write nie może wyłączyć zapisu ustawionego w kodzie tagu.
function isWriteEnabled() {
  if (CREATE_LEAD_WRITE_ENABLED === true) {
    return true;
  }
  var flag = getEventWriteFlag();
  if (flag === true || flag === "true" || flag === "1") {
    return true;
  }
  return false;
}

function getWriteAudit() {
  return {
    buildId: CREATE_LEAD_BUILD_ID,
    templateWrite: CREATE_LEAD_WRITE_ENABLED === true,
    eventWriteFlag: makeString(getEventWriteFlag()),
    writeEnabled: isWriteEnabled(),
  };
}

function normalizeTaskItem(item) {
  var key = item.key || "";
  var raw = item.data || {};
  if (
    raw.data &&
    typeof raw.data === "object" &&
    raw.status === undefined &&
    raw.job_type === undefined
  ) {
    return { key: key, data: raw.data };
  }
  return { key: key, data: raw };
}

function fetchPendingCreateLeadTasks(callback) {
  var url = API_BASE + "/" + COLLECTION_TASK_QUEUE + "/documents";
  var eqOp = "\u0024eq";
  var requestBody = {
    filter: {
      data: {
        status: {},
        job_type: {},
      },
    },
    pagination: {
      sort: [{ field: "created_at", order: "asc" }],
      limit: 50,
    },
  };
  requestBody.filter.data.status[eqOp] = "pending";
  requestBody.filter.data.job_type[eqOp] = ADAPTER_ID;

  sendHttpRequest(
    url,
    { method: "POST", headers: { "Content-Type": "application/json" } },
    JSON.stringify(requestBody),
  )
    .then(function (res) {
      var parsed = JSON.parse(res.body || "{}");
      var items = (parsed.data && parsed.data.items) || [];
      var tasks = [];
      var i = 0;
      while (i < items.length) {
        var normalized = normalizeTaskItem(items[i]);
        var taskData = normalized.data || {};
        if (
          taskData.status === "pending" &&
          taskData.job_type === ADAPTER_ID
        ) {
          tasks.push({ key: normalized.key, data: taskData });
        }
        i = i + 1;
      }
      callback(null, tasks);
    })
    .catch(function (err) {
      callback(err, []);
    });
}

function mapBizProductToTwenty(slug) {
  if (!slug) {
    return "INNE";
  }
  var s = makeString(slug).toLowerCase().trim();
  if (s === "strony" || s === "strona" || s === "web") {
    return "WEB";
  }
  if (s === "logo") {
    return "LOGO";
  }
  if (s === "nazwa" || s === "naming") {
    return "NAME";
  }
  if (s === "copywriting") {
    return "COPYWRITING";
  }
  if (s === "opakowanie" || s === "packaging") {
    return "OPAKOWANIE";
  }
  if (s === "marketing" || s === "strategia" || s === "konsultacje") {
    return "MARKETING";
  }
  var upper = makeString(slug).toUpperCase().trim();
  if (
    upper === "WEB" ||
    upper === "LOGO" ||
    upper === "NAME" ||
    upper === "MARKETING" ||
    upper === "COPYWRITING" ||
    upper === "OPAKOWANIE" ||
    upper === "INNE"
  ) {
    return upper;
  }
  return "INNE";
}

function mapBizSource(taskData) {
  if (taskData.attr_gclid) {
    return "GOOGLE_ADS";
  }
  var src = makeString(taskData.src_action_source || "").toLowerCase();
  if (src === "referral" || src === "polecenie") {
    return "POLECENIE";
  }
  return "FORM";
}

function splitFullName(full) {
  full = makeString(full).trim();
  if (!full) {
    return { firstName: "Lead", lastName: "Formularz" };
  }
  var space = full.indexOf(" ");
  if (space < 0) {
    return { firstName: full, lastName: "" };
  }
  return {
    firstName: full.substring(0, space),
    lastName: full.substring(space + 1),
  };
}

function buildOpportunityName(taskData) {
  var name = makeString(taskData.biz_name || "").trim();
  var product = mapBizProductToTwenty(taskData.biz_product);
  if (name) {
    return name + " — " + product;
  }
  var email = makeString(taskData.biz_email || "").trim();
  if (email) {
    return email + " — " + product;
  }
  return "Lead formularz — " + product;
}

function twentyRequest(method, path, body, twentyCfg, callback) {
  var url = twentyCfg.restUrl + path;
  sendHttpRequest(
    url,
    {
      method: method,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + twentyCfg.apiKey,
      },
    },
    body ? JSON.stringify(body) : undefined,
  )
    .then(function (res) {
      callback(null, res);
    })
    .catch(function (err) {
      callback(err, null);
    });
}

function parseTwentyListRecords(collection, bodyText) {
  var parsed = JSON.parse(bodyText || "{}");
  var data = parsed.data || {};
  if (data[collection] && data[collection].length) {
    return data[collection];
  }
  return [];
}

function extractCreatedId(collection, bodyText) {
  var parsed = JSON.parse(bodyText || "{}");
  var data = parsed.data || {};
  var createKey = "create" + collection.charAt(0).toUpperCase() + collection.slice(1, -1);
  if (collection === "people") {
    createKey = "createPerson";
  }
  if (collection === "opportunities") {
    createKey = "createOpportunity";
  }
  var record = data[createKey] || data[collection.slice(0, -1)] || data.person || data.opportunity || {};
  return record.id || null;
}

function buildTwentyListPath(collection, filterExpr, limit) {
  var path = "/" + collection + "?filter=" + encodeUriComponent(filterExpr);
  if (limit) {
    path += "&limit=" + limit;
  }
  return path;
}

function normalizeEmail(email) {
  return makeString(email).trim().toLowerCase();
}

function personPrimaryEmail(person) {
  if (!person || !person.emails) {
    return "";
  }
  return normalizeEmail(person.emails.primaryEmail);
}

function findPersonByEmail(email, twentyCfg, callback) {
  if (!email) {
    callback(null, null);
    return;
  }
  // Twenty REST: filter=field[eq]:value (nie filter[field][eq]= — ten format jest ignorowany)
  var path = buildTwentyListPath("people", "emails.primaryEmail[eq]:" + email, 1);
  twentyRequest("GET", path, null, twentyCfg, function (err, res) {
    if (err || !res || res.statusCode < 200 || res.statusCode >= 300) {
      callback(err || "find person HTTP " + (res && res.statusCode), null);
      return;
    }
    var people = parseTwentyListRecords("people", res.body);
    var person = people.length ? people[0] : null;
    if (person && personPrimaryEmail(person) !== normalizeEmail(email)) {
      person = null;
    }
    callback(null, person);
  });
}

function findOpportunityByIdOid(idOid, twentyCfg, callback) {
  var path = buildTwentyListPath("opportunities", "idOid[eq]:" + idOid, 1);
  twentyRequest("GET", path, null, twentyCfg, function (err, res) {
    if (err || !res || res.statusCode < 200 || res.statusCode >= 300) {
      callback(err || "find opp HTTP " + (res && res.statusCode), null);
      return;
    }
    var opps = parseTwentyListRecords("opportunities", res.body);
    var opp = opps.length ? opps[0] : null;
    if (opp && makeString(opp.idOid).trim() !== makeString(idOid).trim()) {
      opp = null;
    }
    callback(null, opp);
  });
}

function putTaskDocument(taskKey, taskData, callback) {
  var url =
    API_BASE +
    "/" +
    COLLECTION_TASK_QUEUE +
    "/documents/" +
    encodeUriComponent(taskKey);

  sendHttpRequest(
    url,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify(taskData),
  )
    .then(function () {
      callback(null);
    })
    .catch(function (err) {
      callback(err);
    });
}

function stampTaskRunMeta(taskKey, taskData, audit, callback) {
  var updated = JSON.parse(JSON.stringify(taskData));
  updated.create_lead_build_id = audit.buildId;
  updated.create_lead_template_write = audit.templateWrite;
  updated.create_lead_event_write_flag = audit.eventWriteFlag;
  updated.create_lead_write_enabled = audit.writeEnabled;
  updated.create_lead_run_started_at = getTimestampMillis();

  putTaskDocument(taskKey, updated, callback);
}

function writeWorkerHeartbeat(audit, callback) {
  var doc = {
    build_id: audit.buildId,
    template_write: audit.templateWrite,
    event_write_flag: audit.eventWriteFlag,
    write_enabled: audit.writeEnabled,
    at: getTimestampMillis(),
  };
  var url = API_BASE + "/twenty_state/documents/create_lead_worker_heartbeat";

  sendHttpRequest(
    url,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify(doc),
  )
    .then(function () {
      callback(null);
    })
    .catch(function (err) {
      callback(err);
    });
}

function writeRunAuditDoc(taskKey, audit, result, errorMsg, callback) {
  // sGTM sandbox: bez regex — encodeUriComponent wystarczy na klucz Storage
  var docKey = "create_lead_audit_" + encodeUriComponent(makeString(taskKey));
  if (docKey.length > 180) {
    docKey = docKey.substring(0, 180);
  }
  var doc = {
    task_key: taskKey,
    build_id: audit.buildId,
    template_write: audit.templateWrite,
    event_write_flag: audit.eventWriteFlag,
    write_enabled: audit.writeEnabled,
    result: makeString(result),
    error: makeString(errorMsg),
    at: getTimestampMillis(),
  };
  var url = API_BASE + "/twenty_state/documents/" + docKey;

  sendHttpRequest(
    url,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify(doc),
  )
    .then(function () {
      callback(null);
    })
    .catch(function (err) {
      callback(err);
    });
}

function patchPersonIdOid(personId, idOid, twentyCfg, callback) {
  twentyRequest(
    "PATCH",
    "/people/" + encodeUriComponent(personId),
    { idOid: idOid },
    twentyCfg,
    function (err, res) {
      if (err) {
        callback(err);
        return;
      }
      if (!res || res.statusCode < 200 || res.statusCode >= 300) {
        callback(
          "PATCH person idOid HTTP " + (res && res.statusCode) + " " + (res && res.body),
        );
        return;
      }
      logToConsole(ADAPTER_ID, "PATCH person idOid", personId, idOid);
      callback(null);
    },
  );
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

function updateTaskFailed(taskKey, taskData, errorMsg, audit, callback) {
  var updated = JSON.parse(JSON.stringify(taskData));
  updated.status = "pending";
  updated.create_lead_last_error = makeString(errorMsg);
  updated.create_lead_last_attempt_at = getTimestampMillis();
  updated.create_lead_build_id = audit.buildId;
  updated.create_lead_template_write = audit.templateWrite;
  updated.create_lead_event_write_flag = audit.eventWriteFlag;
  updated.create_lead_write_enabled = audit.writeEnabled;

  putTaskDocument(taskKey, updated, function (storeErr) {
    if (storeErr) {
      callback(storeErr);
      return;
    }
    writeRunAuditDoc(taskKey, audit, "failed", errorMsg, function () {
      logToConsole(ADAPTER_ID, "FAIL persisted", taskKey, errorMsg);
      callback(null);
    });
  });
}

function updateTaskDone(taskKey, taskData, result, audit, callback) {
  var updated = JSON.parse(JSON.stringify(taskData));
  updated.status = "done";
  updated.create_lead_result = result;
  updated.create_lead_completed_at = getTimestampMillis();
  updated.create_lead_last_error = "";
  updated.create_lead_build_id = audit.buildId;
  updated.create_lead_template_write = audit.templateWrite;
  updated.create_lead_event_write_flag = audit.eventWriteFlag;
  updated.create_lead_write_enabled = audit.writeEnabled;

  putTaskDocument(taskKey, updated, function (storeErr) {
    if (storeErr) {
      callback(storeErr);
      return;
    }
    writeRunAuditDoc(taskKey, audit, result, "", function () {
      callback(null);
    });
  });
}

function createPersonRecord(taskData, idOid, twentyCfg, callback) {
  var email = makeString(taskData.biz_email || "").trim();
  var phone = makeString(taskData.biz_phone || "").trim();
  var nameParts = splitFullName(taskData.biz_name);
  var body = {
    name: nameParts,
    idOid: idOid,
  };
  if (email) {
    body.emails = { primaryEmail: email };
  }
  if (phone) {
    body.phones = { primaryPhoneNumber: phone };
  }

  twentyRequest("POST", "/people", body, twentyCfg, function (err, res) {
    if (err) {
      callback(err, null);
      return;
    }
    logToConsole(ADAPTER_ID, "POST people status=", res.statusCode);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      callback("POST people HTTP " + res.statusCode + " " + (res.body || ""), null);
      return;
    }
    var personId = extractCreatedId("people", res.body);
    if (!personId) {
      callback("POST people — brak id w odpowiedzi", null);
      return;
    }
    callback(null, personId);
  });
}

function createOpportunityRecord(taskData, idOid, personId, twentyCfg, callback) {
  var body = {
    name: buildOpportunityName(taskData),
    stage: "NEW",
    idOid: idOid,
    srcSystem: "OWOCNI_SORTOWNIA",
    bizSource: mapBizSource(taskData),
    bizProduct: mapBizProductToTwenty(taskData.biz_product),
    pointOfContactId: personId,
  };

  twentyRequest("POST", "/opportunities", body, twentyCfg, function (err, res) {
    if (err) {
      callback(err, null);
      return;
    }
    logToConsole(ADAPTER_ID, "POST opportunities status=", res.statusCode);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      callback(
        "POST opportunities HTTP " + res.statusCode + " " + (res.body || ""),
        null,
      );
      return;
    }
    var oppId = extractCreatedId("opportunities", res.body);
    if (!oppId) {
      callback("POST opportunities — brak id w odpowiedzi", null);
      return;
    }
    callback(null, oppId);
  });
}

function resolveOrCreatePerson(taskData, idOid, twentyCfg, callback) {
  var email = makeString(taskData.biz_email || "").trim();

  findPersonByEmail(email, twentyCfg, function (findErr, existingPerson) {
    if (findErr) {
      callback(findErr, null);
      return;
    }
    if (existingPerson && existingPerson.id) {
      var existingOid = existingPerson.idOid || "";
      if (existingOid && existingOid !== idOid) {
        callback(
          "Person email conflict idOid existing=" + existingOid + " new=" + idOid,
          null,
        );
        return;
      }
      logToConsole(ADAPTER_ID, "reuse Person", existingPerson.id);
      if (!existingOid) {
        patchPersonIdOid(existingPerson.id, idOid, twentyCfg, function (patchErr) {
          if (patchErr) {
            callback(patchErr, null);
            return;
          }
          callback(null, existingPerson.id);
        });
        return;
      }
      callback(null, existingPerson.id);
      return;
    }
    createPersonRecord(taskData, idOid, twentyCfg, callback);
  });
}

function processOneTask(task, twentyCfg, audit, onComplete) {
  var taskData = task.data || {};
  var idOid = makeString(taskData.id_oid || "").trim();
  var writeEnabled = audit.writeEnabled;

  if (!idOid) {
    logToConsole(ADAPTER_ID, "FAIL — brak id_oid", task.key);
    onComplete("missing id_oid");
    return;
  }

  logToConsole(
    ADAPTER_ID,
    "task",
    task.key,
    "id_oid=",
    idOid,
    "write=",
    writeEnabled,
    "build=",
    audit.buildId,
  );

  stampTaskRunMeta(task.key, taskData, audit, function (stampErr) {
    if (stampErr) {
      logToConsole(ADAPTER_ID, "stamp meta ERROR", stampErr);
    }

    if (!writeEnabled) {
      logToConsole(ADAPTER_ID, "log_only payload", JSON.stringify(taskData));
      updateTaskDone(task.key, taskData, "log_only", audit, function (storeErr) {
        onComplete(storeErr);
      });
      return;
    }

    if (!twentyCfg.apiKey) {
      onComplete("missing twenty_api_key");
      return;
    }

    findOpportunityByIdOid(idOid, twentyCfg, function (dupErr, existingOpp) {
      if (dupErr) {
        onComplete(dupErr);
        return;
      }
      if (existingOpp && existingOpp.id) {
        logToConsole(ADAPTER_ID, "SKIP — Opportunity exists", existingOpp.id);
        updateTaskDone(task.key, taskData, "already_exists", audit, function (storeErr) {
          onComplete(storeErr);
        });
        return;
      }

      resolveOrCreatePerson(taskData, idOid, twentyCfg, function (personErr, personId) {
        if (personErr || !personId) {
          onComplete(personErr || "no personId");
          return;
        }

        createOpportunityRecord(taskData, idOid, personId, twentyCfg, function (oppErr, oppId) {
          if (oppErr || !oppId) {
            onComplete(oppErr || "no oppId");
            return;
          }

          setPendingWrite(oppId, function (pendingErr) {
            if (pendingErr) {
              onComplete(pendingErr);
              return;
            }

            updateTaskDone(
              task.key,
              taskData,
              "created person=" + personId + " opp=" + oppId,
              audit,
              function (storeErr) {
                if (storeErr) {
                  onComplete(storeErr);
                  return;
                }
                logToConsole(ADAPTER_ID, "OK", idOid, personId, oppId);
                onComplete(null);
              },
            );
          });
        });
      });
    });
  });
}

function processTasksSequential(tasks, twentyCfg, audit, index, stats, onAllDone) {
  if (index >= tasks.length || index >= MAX_TASKS_PER_RUN) {
    onAllDone(null, stats);
    return;
  }

  processOneTask(tasks[index], twentyCfg, audit, function (err) {
    if (err) {
      stats.failed = stats.failed + 1;
      updateTaskFailed(tasks[index].key, tasks[index].data || {}, err, audit, function () {
        processTasksSequential(tasks, twentyCfg, audit, index + 1, stats, onAllDone);
      });
      return;
    }
    stats.processed = stats.processed + 1;
    processTasksSequential(tasks, twentyCfg, audit, index + 1, stats, onAllDone);
  });
}

function processCreateLeadQueue(onComplete) {
  var twentyCfg = resolveTwentyConfig();
  var audit = getWriteAudit();
  logToConsole("=== CRM_TWENTY_CREATE_LEAD worker ===", ADAPTER_ID);
  logToConsole(ADAPTER_ID, "build=", audit.buildId);
  logToConsole(ADAPTER_ID, "templateWrite=", audit.templateWrite);
  logToConsole(ADAPTER_ID, "eventWriteFlag=", audit.eventWriteFlag);
  logToConsole(ADAPTER_ID, "writeEnabled=", audit.writeEnabled);

  writeWorkerHeartbeat(audit, function (hbErr) {
    if (hbErr) {
      logToConsole(ADAPTER_ID, "heartbeat ERROR", hbErr);
    }

    fetchPendingCreateLeadTasks(function (err, tasks) {
    if (err) {
      logToConsole(ADAPTER_ID, "fetch ERROR", err);
      onComplete(err);
      return;
    }

    logToConsole(ADAPTER_ID, "pending create_lead tasks:", tasks.length);

    if (tasks.length === 0) {
      onComplete(null);
      return;
    }

    var stats = { processed: 0, failed: 0 };
    processTasksSequential(tasks, twentyCfg, audit, 0, stats, function (seqErr, finalStats) {
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
  });
}

// --- ENTRY POINT ---
processCreateLeadQueue(function (err) {
  finish(!err);
});
