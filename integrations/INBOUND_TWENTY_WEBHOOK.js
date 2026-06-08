/**
 * INBOUND_TWENTY_WEBHOOK.js
 * Adapter Sortowni: Twenty native webhook OUT → business event → task_queue.
 *
 * Deploy: osobny tag HTTP w Stape (ścieżka /inbound/twenty_webhook).
 * SSOT: EVENT_CONTRACT §5.4–5.6, ARCHITECTURE §5.4
 *
 * PRZED PROD: uzupełnij parseTwentyPayload() po preflight (webhook-captures).
 * Sekrety: zmienne Stape (TWENTY_WEBHOOK_SECRET, API_BASE) — nie commituj.
 */

const sendHttpRequest = require("sendHttpRequest");
const JSON = require("JSON");
const logToConsole = require("logToConsole");
const getTimestampMillis = require("getTimestampMillis");
const makeString = require("makeString");
const encodeUriComponent = require("encodeUriComponent");

// --- Stałe (zsynchronizuj z shared/ssotPaths.js / TWENTY_PATHS.md) ---
var ADAPTER_ID = "inbound:twenty_webhook";
var COLLECTION_TASK_QUEUE = "task_queue";
var COLLECTION_TWENTY_STATE_PREFIX = "twenty:opp:";
var COLLECTION_PENDING_WRITE_PREFIX = "pending_write:twenty:";

var REASON_SKIP_DUPLICATE_DELIVERY = "SKIP_DUPLICATE_DELIVERY";
var REASON_SKIP_ECHO_OWN_WRITE = "SKIP_ECHO_OWN_WRITE";
var REASON_SKIP_COLD_START_BASELINE = "SKIP_COLD_START_BASELINE";
var REASON_SKIP_NO_RELEVANT_TRANSITION = "SKIP_NO_RELEVANT_TRANSITION";
var REASON_SKIP_DUPLICATE_BUSINESS_EVENT = "SKIP_DUPLICATE_BUSINESS_EVENT";
var REASON_SKIP_UNSUPPORTED_OBJECT = "SKIP_UNSUPPORTED_OBJECT";
var REASON_EMITTED = "EMITTED";

// Zmienne kontenera Stape (Settings → Variables) — NIE commituj wartości
var BASE_URL = getEventDataWithFallback("stape_base_url") || "";
var API_KEY = getEventDataWithFallback("stape_store_api_key") || "";
var API_BASE = BASE_URL && API_KEY
  ? BASE_URL + "/stape-api/" + API_KEY + "/v2/store/collections"
  : "";

function normalizeSsoEventName(name) {
  if (!name) return name;
  if (name === "lead_won" || name === "closed_won") return "purchase";
  if (name === "lead_rejected") return "rejected_lead";
  return name;
}

function getRuntimeEnvironment(eventData) {
  var raw = (eventData && eventData.environment) || "prod";
  var n = makeString(raw).toLowerCase();
  return n === "sandbox" ? "sandbox" : "prod";
}

function shouldRouteToProdPlatforms(env) {
  if (env === "sandbox") {
    logToConsole("INBOUND_TWENTY: sandbox — task_queue z environment=sandbox (Robot SKIP prod API)");
    return false;
  }
  return true;
}

/**
 * TODO po preflight: mapowanie rzeczywistego body webhooka Twenty.
 * eventData = obiekt z parsowanego JSON (HTTP tag).
 */
function parseTwentyPayload(eventData) {
  var payload = eventData || {};
  var data = payload.data || payload.record || payload;
  return {
    objectType: data.objectMetadata || data.__typename || payload.object || "",
    opportunityId: data.id || payload.id || "",
    stage: data.stage || null,
    campaignRejected: data.campaignRejected === true,
    personIdOid: (data.person && data.person.idOid) || data.idOid || null,
    eventNamePlatform: payload.event || payload.type || "",
    bizValueWon: data.bizValueWon || null,
    bizProduct: data.bizProduct || null,
    bizEmail: (data.person && data.person.email) || data.email || null,
    bizPhone: (data.person && data.person.phone) || data.phone || null,
  };
}

function storeKeyOpportunityState(opportunityId) {
  return COLLECTION_TWENTY_STATE_PREFIX + opportunityId;
}

function storeKeyPendingWrite(opportunityId) {
  return COLLECTION_PENDING_WRITE_PREFIX + opportunityId;
}

function readJsonStore(documentKey, callback) {
  var url = API_BASE + "/twenty_state/documents/" + encodeUriComponent(documentKey);
  sendHttpRequest(url, { method: "GET" }, "")
    .then(function (res) {
      var body = {};
      try {
        body = JSON.parse(res.body || "{}");
      } catch (e) {
        body = {};
      }
      callback(null, body);
    })
    .catch(function (err) {
      callback(err, null);
    });
}

function writeJsonStore(documentKey, obj, callback) {
  var url = API_BASE + "/twenty_state/documents/" + encodeUriComponent(documentKey);
  sendHttpRequest(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
  }, JSON.stringify(obj))
    .then(function () {
      callback(null);
    })
    .catch(function (err) {
      callback(err);
    });
}

function detectBusinessEvent(parsed, prev) {
  if (!parsed.personIdOid) {
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
  if (prev.last_campaignRejected === false && parsed.campaignRejected === true) {
    return { emit: "rejected_lead" };
  }
  if (prev.last_campaignRejected === true && parsed.campaignRejected === true) {
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
  sendHttpRequest(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
  }, JSON.stringify(taskPayload))
    .then(function (res) {
      logToConsole("INBOUND_TWENTY: task_queue saved", taskId, res.statusCode);
      callback(null, taskId);
    })
    .catch(function (err) {
      callback(err, null);
    });
}

/**
 * Główny handler — wywołaj z tagu HTTP po verify HMAC (osobny krok / zmienna).
 * @param {object} webhookBody — sparsowany JSON z Twenty
 * @param {string} environment — "sandbox" | "prod"
 */
function processTwentyWebhook(webhookBody, environment) {
  var env = environment || getRuntimeEnvironment(webhookBody);
  var parsed = parseTwentyPayload(webhookBody);
  var allowedTypes = ["Opportunity", "opportunity", "Person", "person"];

  logToConsole("=== INBOUND_TWENTY_WEBHOOK ===", ADAPTER_ID, "env=", env);

  if (allowedTypes.indexOf(parsed.objectType) === -1 && parsed.objectType) {
    logToConsole("INBOUND_TWENTY: SKIP", REASON_SKIP_UNSUPPORTED_OBJECT, parsed.objectType);
    return { ok: true, reason: REASON_SKIP_UNSUPPORTED_OBJECT };
  }

  if (!parsed.opportunityId) {
    logToConsole("INBOUND_TWENTY: ERROR missing opportunityId");
    return { ok: false, error: "missing opportunityId" };
  }

  var stateKey = storeKeyOpportunityState(parsed.opportunityId);

  readJsonStore(stateKey, function (err, prev) {
    if (err) prev = { last_stage: null, last_campaignRejected: null };
    if (!prev) prev = { last_stage: null, last_campaignRejected: null };

    // TODO: pending-write echo — readJsonStore(storeKeyPendingWrite(...))
  var pendingKey = storeKeyPendingWrite(parsed.opportunityId);
  readJsonStore(pendingKey, function (pendingErr, pendingDoc) {
    if (pendingDoc && pendingDoc.active === true) {
      logToConsole("INBOUND_TWENTY: SKIP", REASON_SKIP_ECHO_OWN_WRITE);
      return;
    }

    var decision = detectBusinessEvent(parsed, prev);

    writeJsonStore(stateKey, {
      last_stage: parsed.stage,
      last_campaignRejected: parsed.campaignRejected,
      updated_at: getTimestampMillis(),
    }, function () {});

    if (decision.skip) {
      logToConsole("INBOUND_TWENTY:", decision.skip);
      return;
    }

    var eventName = normalizeSsoEventName(decision.emit);
    var timestamp = getTimestampMillis();
    var idOid = parsed.personIdOid || "pending_mint";

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
      src_action_source: "crm_webhook",
      adapter: ADAPTER_ID,
      opportunity_id: parsed.opportunityId,
      stage: parsed.stage,
      campaign_rejected: parsed.campaignRejected,
    };

    if (decision.manual) {
      taskPayload.src_action_source = "manual_create";
      taskPayload.job_type = "crm:twenty_update_person"; // kolejka: mint + backfill — osobny tag
    }

    enqueueTaskQueue(taskPayload, function (qErr, taskId) {
      if (qErr) {
        logToConsole("INBOUND_TWENTY: task_queue ERROR", qErr);
        return;
      }
      logToConsole("INBOUND_TWENTY:", REASON_EMITTED, eventName, "taskId=", taskId);
      if (!shouldRouteToProdPlatforms(env)) {
        logToConsole("INBOUND_TWENTY: safe-sink mode — Robot nie wyśle prod API");
      }
    });
  });
  });
}

// --- Entry (tag HTTP): podłącz body z requestu Twenty ---
// var body = ...; // JSON.parse z raw body po HMAC
// var env = "sandbox"; // lub z nagłówka / query / Twenty instancji
// processTwentyWebhook(body, env);

logToConsole("INBOUND_TWENTY_WEBHOOK.js loaded — call processTwentyWebhook(body, environment)");
