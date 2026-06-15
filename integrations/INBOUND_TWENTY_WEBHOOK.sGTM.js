/**
 * INBOUND_TWENTY_WEBHOOK.sGTM.js
 * Wklej CAŁOŚĆ do Tag Template w sGTM (nie INBOUND_TWENTY_WEBHOOK.js — to moduł bez entry point).
 *
 * Permissions (Tag Template) — w Stape UI tylko 3 checkboxy; włącz WSZYSTKIE:
 * - Logs to console, Reads event data, Sends HTTP requests
 *
 * Store API: getEventData("stape_*") NIE widzi zmiennych Constant sGTM — jak w SORTOWNIA_V2
 * Klucze dokumentów Store: bez ":" (regex Stape) → twenty_opp_{uuid}
 */

const sendHttpRequest = require("sendHttpRequest");
const JSON = require("JSON");
const logToConsole = require("logToConsole");
const getTimestampMillis = require("getTimestampMillis");
const makeString = require("makeString");
const encodeUriComponent = require("encodeUriComponent");
const getEventData = require("getEventData");

var ADAPTER_ID = "inbound:twenty_webhook";
var COLLECTION_TASK_QUEUE = "task_queue";
var COLLECTION_TWENTY_STATE_PREFIX = "twenty_opp_";
var COLLECTION_PENDING_WRITE_PREFIX = "pending_write_twenty_";

var REASON_SKIP_DUPLICATE_DELIVERY = "SKIP_DUPLICATE_DELIVERY";
var REASON_SKIP_ECHO_OWN_WRITE = "SKIP_ECHO_OWN_WRITE";
var REASON_SKIP_COLD_START_BASELINE = "SKIP_COLD_START_BASELINE";
var REASON_SKIP_NO_RELEVANT_TRANSITION = "SKIP_NO_RELEVANT_TRANSITION";
var REASON_SKIP_DUPLICATE_BUSINESS_EVENT = "SKIP_DUPLICATE_BUSINESS_EVENT";
var REASON_SKIP_UNSUPPORTED_OBJECT = "SKIP_UNSUPPORTED_OBJECT";
var REASON_EMITTED = "EMITTED";

// Store — jawnie (getEventData nie czyta Constant Variables; wzorzec jak SORTOWNIA_V2)
var BASE_URL = "https://uinpcbwf.eug.stape.io";
var API_KEY = "2d389d8d0875343a76c07c6ff388c586bbd9347duinpcbwf";
var API_BASE = BASE_URL + "/stape-api/" + API_KEY + "/v2/store/collections";

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

function normalizeSsoEventName(name) {
  if (!name) return name;
  if (name === "lead_won" || name === "closed_won") return "purchase";
  if (name === "lead_rejected") return "rejected_lead";
  return name;
}

function getRuntimeEnvironment() {
  var raw = getEventDataWithFallback("runtime_environment") || "sandbox";
  var n = makeString(raw).toLowerCase();
  return n === "sandbox" ? "sandbox" : "prod";
}

function parseTwentyPayload(eventData) {
  var payload = eventData || {};
  var record = payload.data || payload.record || payload;
  if (record && record.record && typeof record.record === "object") {
    record = record.record;
  }
  var eventPlatform =
    payload.event || payload.operation || payload.type || "";
  var objectType = "";
  if (eventPlatform && eventPlatform.indexOf(".") > -1) {
    objectType = eventPlatform.split(".")[0];
  }
  return {
    objectType: objectType || "",
    opportunityId: record.id || payload.id || "",
    stage: record.stage || null,
    campaignRejected: record.campaignRejected === true,
    personIdOid:
      (record.person && record.person.idOid) ||
      (record.pointOfContact && record.pointOfContact.idOid) ||
      null,
    opportunityIdOid: record.idOid || null,
    eventNamePlatform: eventPlatform,
    bizValueWon: record.bizValueWon || null,
    bizProduct: record.bizProduct || null,
    bizEmail:
      (record.person && record.person.email) ||
      (record.pointOfContact && record.pointOfContact.email) ||
      record.email ||
      null,
    bizPhone:
      (record.person && record.person.phone) ||
      (record.pointOfContact && record.pointOfContact.phone) ||
      record.phone ||
      null,
  };
}

function storeKeyOpportunityState(opportunityId) {
  return COLLECTION_TWENTY_STATE_PREFIX + opportunityId;
}

function storeKeyPendingWrite(opportunityId) {
  return COLLECTION_PENDING_WRITE_PREFIX + opportunityId;
}

function unwrapStoreDocument(body) {
  if (!body || typeof body !== "object") {
    return {};
  }
  if (body.data && body.data.data && typeof body.data.data === "object") {
    return body.data.data;
  }
  if (
    body.last_stage !== undefined ||
    body.last_campaignRejected !== undefined ||
    body.active !== undefined
  ) {
    return body;
  }
  if (body.data && typeof body.data === "object") {
    return body.data;
  }
  return body;
}

function deliveryFingerprint(webhookBody) {
  var payload = webhookBody || {};
  var record = payload.data || {};
  var oppId = record.id || payload.id || "";
  var ts = payload.timestamp || "";
  var ev = payload.event || "";
  return ev + "|" + oppId + "|" + ts;
}

function readJsonStore(documentKey, callback) {
  var url =
    API_BASE + "/twenty_state/documents/" + encodeUriComponent(documentKey);
  sendHttpRequest(url, { method: "GET" }, "")
    .then(function (res) {
      var bodyText = res.body || "{}";
      var body = unwrapStoreDocument(JSON.parse(bodyText));
      callback(null, body);
    })
    .catch(function () {
      callback(null, {});
    });
}

function writeJsonStore(documentKey, obj, callback) {
  var url =
    API_BASE + "/twenty_state/documents/" + encodeUriComponent(documentKey);
  sendHttpRequest(
    url,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify(obj),
  )
    .then(function () {
      callback(null);
    })
    .catch(function (err) {
      callback(err);
    });
}

function resolveIdentityOid(parsed) {
  return parsed.personIdOid || parsed.opportunityIdOid || null;
}

function detectBusinessEvent(parsed, prev) {
  if (!resolveIdentityOid(parsed)) {
    return { emit: "generate_lead", manual: true };
  }
  if (prev.last_stage == null && prev.last_campaignRejected == null) {
    return { skip: REASON_SKIP_COLD_START_BASELINE };
  }
  if (prev.last_stage !== parsed.stage && parsed.stage === "QUALIFIED") {
    return { emit: "qualify_lead" };
  }
  if (prev.last_stage !== parsed.stage && parsed.stage === "WON") {
    return { emit: "purchase" };
  }
  if (
    prev.last_campaignRejected === false &&
    parsed.campaignRejected === true
  ) {
    return { emit: "rejected_lead" };
  }
  if (
    prev.last_campaignRejected === true &&
    parsed.campaignRejected === true
  ) {
    return { skip: REASON_SKIP_DUPLICATE_BUSINESS_EVENT };
  }
  return { skip: REASON_SKIP_NO_RELEVANT_TRANSITION };
}

function enqueueTaskQueue(taskPayload, callback) {
  var taskId =
    (taskPayload.id_oid || "no_oid") +
    "_" +
    taskPayload.created_at +
    "_" +
    taskPayload.event_name;
  var url =
    API_BASE +
    "/" +
    COLLECTION_TASK_QUEUE +
    "/documents/" +
    encodeUriComponent(taskId);
  sendHttpRequest(
    url,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify(taskPayload),
  )
    .then(function (res) {
      logToConsole("INBOUND_TWENTY: task_queue saved", taskId, res.statusCode);
      callback(null, taskId);
    })
    .catch(function (err) {
      callback(err, null);
    });
}

function processTwentyWebhook(webhookBody, onComplete) {
  var env = getRuntimeEnvironment();
  var parsed = parseTwentyPayload(webhookBody);
  var allowedTypes = ["opportunity", "person"];

  logToConsole("=== INBOUND_TWENTY_WEBHOOK ===", ADAPTER_ID, "env=", env);
  logToConsole(
    "platform event:",
    parsed.eventNamePlatform,
    "oppId:",
    parsed.opportunityId,
    "stage:",
    parsed.stage,
  );

  if (
    parsed.objectType &&
    allowedTypes.indexOf(parsed.objectType.toLowerCase()) === -1
  ) {
    logToConsole("INBOUND_TWENTY:", REASON_SKIP_UNSUPPORTED_OBJECT, parsed.objectType);
    onComplete(null);
    return;
  }

  if (parsed.objectType === "person" || !parsed.opportunityId) {
    logToConsole("INBOUND_TWENTY: person-only or brak oppId — skip store");
    onComplete(null);
    return;
  }

  var stateKey = storeKeyOpportunityState(parsed.opportunityId);
  var pendingKey = storeKeyPendingWrite(parsed.opportunityId);

  readJsonStore(pendingKey, function (pErr, pendingDoc) {
    if (pendingDoc && pendingDoc.active === true) {
      logToConsole("INBOUND_TWENTY:", REASON_SKIP_ECHO_OWN_WRITE);
      onComplete(null);
      return;
    }

    readJsonStore(stateKey, function (err, prev) {
      if (!prev) prev = { last_stage: null, last_campaignRejected: null };

      var fp = deliveryFingerprint(webhookBody);
      if (prev.last_delivery_fingerprint && prev.last_delivery_fingerprint === fp) {
        logToConsole("INBOUND_TWENTY:", REASON_SKIP_DUPLICATE_DELIVERY);
        onComplete(null);
        return;
      }

      var decision = detectBusinessEvent(parsed, prev);

      writeJsonStore(
        stateKey,
        {
          last_stage: parsed.stage,
          last_campaignRejected: parsed.campaignRejected,
          last_delivery_fingerprint: fp,
          updated_at: getTimestampMillis(),
        },
        function () {},
      );

      if (decision.skip) {
        logToConsole("INBOUND_TWENTY:", decision.skip);
        onComplete(null);
        return;
      }

      var eventName = normalizeSsoEventName(decision.emit);
      var timestamp = getTimestampMillis();
      var idOid = resolveIdentityOid(parsed) || "pending_mint";

      var taskPayload = {
        id_oid: idOid,
        id_event: timestamp + "_" + eventName,
        event_name: eventName,
        job_type: "analytics:ga4_mp",
        status: "pending",
        created_at: timestamp,
        environment: env,
        biz_email: parsed.bizEmail,
        biz_phone: parsed.bizPhone,
        biz_product: parsed.bizProduct,
        biz_value: parsed.bizValueWon,
        src_system: "TWENTY_UI",
        src_action_source: decision.manual ? "manual_create" : "crm_webhook",
        adapter: ADAPTER_ID,
        opportunity_id: parsed.opportunityId,
        stage: parsed.stage,
        campaign_rejected: parsed.campaignRejected,
      };

      if (decision.manual) {
        taskPayload.job_type = "crm:twenty_update_person";
      }

      enqueueTaskQueue(taskPayload, function (qErr, taskId) {
        if (qErr) {
          logToConsole("INBOUND_TWENTY: task_queue ERROR", qErr);
          onComplete(qErr);
          return;
        }
        logToConsole("INBOUND_TWENTY:", REASON_EMITTED, eventName, "taskId=", taskId);
        onComplete(null);
      });
    });
  });
}

// --- ENTRY POINT (Tag Template) ---
var rawBody = getEventDataWithFallback("twenty_webhook_raw_body");
var sig = getEventDataWithFallback("twenty_webhook_signature");
var ts = getEventDataWithFallback("twenty_webhook_timestamp");

if (!rawBody) {
  logToConsole("INBOUND_TWENTY: brak raw body");
  finish(false);
} else {
  if (sig && ts) {
    logToConsole("INBOUND_TWENTY: HMAC headers present — full verify w kolejnym kroku");
  } else {
    logToConsole("INBOUND_TWENTY: SKIP_HMAC_NO_HEADERS (curl / brak nagłówków Twenty)");
  }

  var webhookBody = JSON.parse(rawBody);
  if (!webhookBody || typeof webhookBody !== "object") {
    logToConsole("INBOUND_TWENTY: JSON parse error or empty body");
    finish(false);
  } else {
    processTwentyWebhook(webhookBody, function (err) {
      finish(!err);
    });
  }
}
