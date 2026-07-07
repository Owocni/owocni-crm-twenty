/**
 * INBOUND_TWENTY_WEBHOOK.sGTM.legacy-full.js
 * Pełna wersja sGTM (prod / rollback). Sekrety jako placeholdery — uzupełnij w Constant Variables.
 * Sandbox: użyj INBOUND_TWENTY_WEBHOOK.gcp-stub.sGTM.js + Cloud Function.
 *
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
const generateRandom = require("generateRandom");

var ADAPTER_ID = "inbound:twenty_webhook";
var IDENTITY_ADAPTER_ID = "identity:twenty_resolver";
var COLLECTION_TASK_QUEUE = "task_queue";
var COLLECTION_IDENTITY_MAP = "identity_map";
var COLLECTION_PERSON_MINT_PREFIX = "twenty_person_";
var COLLECTION_TWENTY_STATE_PREFIX = "twenty_opp_";
var COLLECTION_PENDING_WRITE_PREFIX = "pending_write_twenty_";
var PENDING_WRITE_TTL_MS = 45000;

var REASON_SKIP_DUPLICATE_DELIVERY = "SKIP_DUPLICATE_DELIVERY";
var REASON_SKIP_ECHO_OWN_WRITE = "SKIP_ECHO_OWN_WRITE";
var REASON_SKIP_COLD_START_BASELINE = "SKIP_COLD_START_BASELINE";
var REASON_SKIP_NO_RELEVANT_TRANSITION = "SKIP_NO_RELEVANT_TRANSITION";
var REASON_SKIP_QUALIFIED_WITHOUT_SQL_CONFIRM =
  "SKIP_QUALIFIED_WITHOUT_SQL_CONFIRM";
var REASON_SKIP_DUPLICATE_BUSINESS_EVENT = "SKIP_DUPLICATE_BUSINESS_EVENT";
var REASON_SKIP_UNSUPPORTED_OBJECT = "SKIP_UNSUPPORTED_OBJECT";
var REASON_EMITTED = "EMITTED";

// Store — jawnie (getEventData nie czyta Constant Variables; wzorzec jak SORTOWNIA_V2)
var BASE_URL = "https://uinpcbwf.eug.stape.io";
var API_KEY = ""; // PLACEHOLDER: ustaw w Constant Variable sGTM (stape_api_key) — NIE commituj
var API_BASE = BASE_URL + "/stape-api/" + API_KEY + "/v2/store/collections";

// Twenty — fetch Person gdy webhook update niesie tylko zmienione pola (np. jobTitle)
var TWENTY_REST_URL = "https://api.twenty.com/rest";
var TWENTY_API_KEY = ""; // PLACEHOLDER: ustaw w Constant Variable sGTM (twenty_api_key) — NIE commituj

// Opcja B — leads@ Email Sync → crm:twenty_create_lead (sandbox channel id)
var LEADS_AT_MESSAGE_CHANNEL_ID = "32629e97-6dc2-452f-aa26-38c72eaab3a4";
var LEADS_AT_INTERNAL_DOMAIN = "@owocni.pl";
var COLLECTION_LEADS_AT_PREFIX = "leads_at_enqueue_";
var CREATE_LEAD_ADAPTER = "crm:twenty_create_lead";

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

function mergeWebhookPersonRecord(record, previous) {
  if (!record || typeof record !== "object") {
    return record;
  }
  if (!previous || typeof previous !== "object") {
    return record;
  }
  var merged = JSON.parse(JSON.stringify(record));
  if (!merged.id && previous.id) {
    merged.id = previous.id;
  }
  if (!merged.idOid && previous.idOid) {
    merged.idOid = previous.idOid;
  }
  if (!merged.email && previous.email) {
    merged.email = previous.email;
  }
  if (!merged.phone && previous.phone) {
    merged.phone = previous.phone;
  }
  var prevEmails = previous.emails || {};
  var recEmails = merged.emails || {};
  if (!recEmails.primaryEmail && prevEmails.primaryEmail) {
    merged.emails = merged.emails || {};
    merged.emails.primaryEmail = prevEmails.primaryEmail;
  }
  var prevPhones = previous.phones || {};
  var recPhones = merged.phones || {};
  if (!recPhones.primaryPhoneNumber && prevPhones.primaryPhoneNumber) {
    merged.phones = merged.phones || {};
    merged.phones.primaryPhoneNumber = prevPhones.primaryPhoneNumber;
    merged.phones.primaryPhoneCallingCode =
      prevPhones.primaryPhoneCallingCode || "";
  }
  return merged;
}

function inferObjectTypeFromRecord(record, previous) {
  var r = record || {};
  var p = previous || {};
  if (r.stage !== undefined && r.stage !== null) {
    return "opportunity";
  }
  if (p.stage !== undefined && p.stage !== null) {
    return "opportunity";
  }
  if (r.campaignRejected !== undefined || r.pointOfContactId !== undefined) {
    return "opportunity";
  }
  if (r.bizProduct !== undefined || r.bizValueWon !== undefined) {
    return "opportunity";
  }
  if (r.emails !== undefined || p.emails !== undefined) {
    return "person";
  }
  if (
    r.firstName !== undefined ||
    r.lastName !== undefined ||
    p.firstName !== undefined ||
    p.lastName !== undefined
  ) {
    return "person";
  }
  if (r.name && typeof r.name === "object") {
    return "person";
  }
  if (r.jobTitle !== undefined || p.jobTitle !== undefined) {
    return "person";
  }
  return "";
}

function normalizeWebhookObjectType(raw) {
  var t = makeString(raw).toLowerCase();
  if (t === "people") {
    return "person";
  }
  return t;
}

function parseTwentyPayload(eventData) {
  var payload = eventData || {};
  var record = payload.data || payload.record || payload;
  if (record && record.record && typeof record.record === "object") {
    record = record.record;
  }
  var previous = payload.previousRecord || null;
  var eventPlatform =
    payload.event ||
    payload.operation ||
    payload.type ||
    payload.name ||
    payload.eventName ||
    "";
  var objectType = "";
  if (eventPlatform && eventPlatform.indexOf(".") > -1) {
    objectType = normalizeWebhookObjectType(eventPlatform.split(".")[0]);
  }
  if (!objectType) {
    objectType = inferObjectTypeFromRecord(record, previous);
  }
  if (objectType === "person" && previous) {
    record = mergeWebhookPersonRecord(record, previous);
  }
  var emails = record.emails || {};
  var phones = record.phones || {};
  var phoneRaw = "";
  if (phones.primaryPhoneNumber) {
    phoneRaw =
      (phones.primaryPhoneCallingCode || "") + (phones.primaryPhoneNumber || "");
  }
  var isPerson = objectType === "person";
  return {
    objectType: objectType || "",
    opportunityId: isPerson ? "" : record.id || payload.id || "",
    personId: isPerson ? record.id || "" : record.pointOfContactId || "",
    pointOfContactId: record.pointOfContactId || null,
    stage: record.stage || null,
    bizSqlConfirmed: record.bizSqlConfirmed === true,
    bizLastNonSqlStage: record.bizLastNonSqlStage || null,
    campaignRejected: record.campaignRejected === true,
    personIdOid: sanitizeWebhookField(record.idOid),
    opportunityIdOid: isPerson ? null : sanitizeWebhookField(record.idOid),
    eventNamePlatform: eventPlatform,
    bizValueWon: record.bizValueWon || null,
    bizProduct: sanitizeWebhookField(record.bizProduct) || null,
    bizEmail:
      emails.primaryEmail ||
      (record.person && record.person.email) ||
      (record.pointOfContact && record.pointOfContact.email) ||
      record.email ||
      null,
    bizPhone: phoneRaw || record.phone || null,
    _personRecord: isPerson ? record : null,
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

function sanitizeWebhookField(value) {
  var s = makeString(value).trim();
  if (!s || s === "undefined" || s === "null") {
    return null;
  }
  return s;
}

function resolveIdentityOid(parsed) {
  return (
    sanitizeWebhookField(parsed.opportunityIdOid) ||
    sanitizeWebhookField(parsed.personIdOid) ||
    null
  );
}

function detectBusinessEvent(parsed, prev) {
  if (!resolveIdentityOid(parsed)) {
    return { emit: "generate_lead", manual: true };
  }
  if (prev.last_stage == null && prev.last_campaignRejected == null) {
    if (parsed.stage === "QUALIFIED") {
      if (parsed.bizSqlConfirmed === true) {
        return { emit: "qualify_lead" };
      }
      return { skip: REASON_SKIP_QUALIFIED_WITHOUT_SQL_CONFIRM };
    }
    if (parsed.stage === "WON") {
      return { emit: "purchase" };
    }
    if (parsed.campaignRejected === true) {
      return { emit: "rejected_lead" };
    }
    return { skip: REASON_SKIP_COLD_START_BASELINE };
  }
  if (prev.last_stage !== parsed.stage && parsed.stage === "QUALIFIED") {
    if (parsed.bizSqlConfirmed === true) {
      return { emit: "qualify_lead" };
    }
    return { skip: REASON_SKIP_QUALIFIED_WITHOUT_SQL_CONFIRM };
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

function personMintGuardKey(personId) {
  return COLLECTION_PERSON_MINT_PREFIX + personId;
}

function personIdentityBackfillTaskKey(personId) {
  return personMintGuardKey(personId) + "_identity_backfill";
}

function readPersonMintGuardDoc(personId, callback) {
  var url =
    API_BASE +
    "/" +
    COLLECTION_IDENTITY_MAP +
    "/documents/" +
    encodeUriComponent(personMintGuardKey(personId));
  sendHttpRequest(url, { method: "GET" }, "")
    .then(function (res) {
      if (res.statusCode === 200) {
        var doc = unwrapStoreDocument(JSON.parse(res.body || "{}"));
        callback(null, doc);
      } else if (res.statusCode === 404) {
        callback(null, null);
      } else {
        callback("HTTP " + res.statusCode, null);
      }
    })
    .catch(function (err) {
      callback(err, null);
    });
}

function putPersonMintGuardDoc(personId, idOid, env, callback) {
  var url =
    API_BASE +
    "/" +
    COLLECTION_IDENTITY_MAP +
    "/documents/" +
    encodeUriComponent(personMintGuardKey(personId));
  sendHttpRequest(
    url,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify({
      id_oid: idOid,
      person_id: personId,
      environment: env,
      guard_type: "person_mint",
      updated_at: makeString(getTimestampMillis()),
    }),
  )
    .then(function () {
      callback(null);
    })
    .catch(function (err) {
      callback(err);
    });
}

function acquirePersonMintGuard(personId, env, callback) {
  readPersonMintGuardDoc(personId, function (err, doc) {
    if (err) {
      callback(err, null);
      return;
    }
    if (doc && doc.id_oid) {
      logToConsole("INBOUND_IDENTITY: MINT_GUARD_HIT", doc.id_oid);
      callback(null, doc.id_oid);
      return;
    }
    var candidate = generateResolverULID();
    putPersonMintGuardDoc(personId, candidate, env, function (putErr) {
      if (putErr) {
        callback(putErr, null);
        return;
      }
      readPersonMintGuardDoc(personId, function (reErr, finalDoc) {
        if (reErr || !finalDoc || !finalDoc.id_oid) {
          callback(reErr || "MINT_GUARD_READBACK_FAIL", null);
          return;
        }
        if (finalDoc.id_oid !== candidate) {
          logToConsole(
            "INBOUND_IDENTITY: MINT_GUARD_COLLISION",
            candidate,
            "->",
            finalDoc.id_oid,
          );
        } else {
          logToConsole("INBOUND_IDENTITY: MINT_GUARD_CLAIM", finalDoc.id_oid);
        }
        callback(null, finalDoc.id_oid);
      });
    });
  });
}

function registerPersonMintGuard(personId, idOid, env, callback) {
  readPersonMintGuardDoc(personId, function (err, doc) {
    if (err) {
      callback(err, null);
      return;
    }
    if (doc && doc.id_oid) {
      if (doc.id_oid !== idOid) {
        logToConsole(
          "INBOUND_IDENTITY: MINT_GUARD_EXISTING",
          doc.id_oid,
          "requested",
          idOid,
        );
      }
      callback(null, doc.id_oid);
      return;
    }
    putPersonMintGuardDoc(personId, idOid, env, function (putErr) {
      if (putErr) {
        callback(putErr, null);
        return;
      }
      callback(null, idOid);
    });
  });
}

function resolvePersonIdOidForWrite(personId, decision, env, callback) {
  if (decision.id_oid) {
    registerPersonMintGuard(personId, decision.id_oid, env, function (gErr, guardOid) {
      if (gErr) {
        callback(gErr, null, null);
        return;
      }
      callback(null, guardOid || decision.id_oid, decision.tier);
    });
    return;
  }
  acquirePersonMintGuard(personId, env, function (mErr, mintOid) {
    if (mErr) {
      callback(mErr, null, null);
      return;
    }
    callback(null, mintOid, "T3");
  });
}

function readIdentityMap(key, callback) {
  var url =
    API_BASE +
    "/" +
    COLLECTION_IDENTITY_MAP +
    "/documents/" +
    encodeUriComponent(key);
  sendHttpRequest(url, { method: "GET" }, "")
    .then(function (res) {
      if (res.statusCode === 200) {
        var doc = unwrapStoreDocument(JSON.parse(res.body || "{}"));
        callback(null, doc.id_oid || null);
      } else if (res.statusCode === 404) {
        callback(null, null);
      } else {
        callback("HTTP " + res.statusCode, null);
      }
    })
    .catch(function (err) {
      callback(err, null);
    });
}

function writeIdentityMapKeys(idOid, email, phone, tier, env, callback) {
  var profile = {
    id_oid: idOid,
    biz_email: email || null,
    biz_phone: phone || null,
    identity_status: tier === "T4" ? "needs_review" : "verified",
    vbb_eligible: false,
    identity_tier: tier,
    updated_at: makeString(getTimestampMillis()),
    last_resolver: IDENTITY_ADAPTER_ID,
    environment: env,
  };
  var keys = [idOid];
  if (email) keys.push(email);
  if (phone) keys.push(phone);
  function putKey(i) {
    if (i >= keys.length) {
      callback(null);
      return;
    }
    var url =
      API_BASE +
      "/" +
      COLLECTION_IDENTITY_MAP +
      "/documents/" +
      encodeUriComponent(keys[i]);
    sendHttpRequest(
      url,
      { method: "PUT", headers: { "Content-Type": "application/json" } },
      JSON.stringify(profile),
    )
      .then(function () {
        putKey(i + 1);
      })
      .catch(function (err) {
        callback(err);
      });
  }
  putKey(0);
}

function normalizeResolverEmail(raw) {
  if (!raw) return undefined;
  var str = makeString(raw).toLowerCase();
  var at = str.indexOf("@");
  if (at < 1) return undefined;
  return str;
}

function normalizeResolverPhone(raw) {
  if (!raw) return undefined;
  var digits = "";
  var i = 0;
  var s = makeString(raw);
  while (i < s.length) {
    var c = s.charAt(i);
    if (c >= "0" && c <= "9") digits = digits + c;
    i = i + 1;
  }
  if (digits.length === 9) return "+48" + digits;
  if (digits.length >= 10) return "+" + digits;
  return undefined;
}

function generateResolverULID() {
  var chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  var result = "";
  var i = 0;
  while (i < 26) {
    result = result + chars.charAt(generateRandom(0, 31));
    i = i + 1;
  }
  return result;
}

function resolveIdentityTier(emailOid, phoneOid) {
  var hasE = emailOid !== null && emailOid !== undefined && emailOid !== "";
  var hasP = phoneOid !== null && phoneOid !== undefined && phoneOid !== "";
  if (!hasE && !hasP) return { tier: "T3", id_oid: null };
  if (hasE && !hasP) return { tier: "T1", id_oid: emailOid };
  if (!hasE && hasP) return { tier: "T1", id_oid: phoneOid };
  if (emailOid === phoneOid) return { tier: "T2", id_oid: emailOid };
  return { tier: "T4", id_oid: null };
}

function buildTwentyListPath(collection, filterExpr, limit) {
  var path = "/" + collection + "?filter=" + encodeUriComponent(filterExpr);
  if (limit) {
    path += "&limit=" + limit;
  }
  return path;
}

function parseTwentyListRecords(collection, bodyText) {
  var parsed = JSON.parse(bodyText || "{}");
  var data = parsed.data || {};
  if (data[collection] && data[collection].length) {
    return data[collection];
  }
  return [];
}

function twentyGet(path, callback) {
  sendHttpRequest(
    TWENTY_REST_URL + path,
    {
      method: "GET",
      headers: { Authorization: "Bearer " + TWENTY_API_KEY },
    },
    "",
  )
    .then(function (res) {
      callback(null, res);
    })
    .catch(function (err) {
      callback(err, null);
    });
}

function setPendingWrite(opportunityId, callback) {
  var docKey = storeKeyPendingWrite(opportunityId);
  var doc = {
    active: true,
    adapter: "inbound:sql_guard_revert",
    expires_at: getTimestampMillis() + PENDING_WRITE_TTL_MS,
  };
  writeJsonStore(docKey, doc, callback || function () {});
}

function twentyPatchOpportunity(opportunityId, bodyObj, callback) {
  sendHttpRequest(
    TWENTY_REST_URL + "/opportunities/" + encodeUriComponent(opportunityId),
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer " + TWENTY_API_KEY,
        "Content-Type": "application/json",
      },
    },
    JSON.stringify(bodyObj || {}),
  )
    .then(function (res) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        callback(null, res);
        return;
      }
      callback("HTTP " + res.statusCode + " " + (res.body || ""), null);
    })
    .catch(function (err) {
      callback(err, null);
    });
}

function revertUnconfirmedSqlStage(parsed, prev, onComplete) {
  var revertStage =
    (prev && prev.last_stage) ||
    parsed.bizLastNonSqlStage ||
    "NEW";
  if (!parsed.opportunityId || !revertStage || revertStage === "QUALIFIED") {
    onComplete(null);
    return;
  }
  setPendingWrite(parsed.opportunityId, function () {
    twentyPatchOpportunity(
      parsed.opportunityId,
      { stage: revertStage },
      function (err) {
        if (err) {
          logToConsole("INBOUND_TWENTY: REVERT_UNCONFIRMED_SQL_FAIL", err);
        } else {
          logToConsole(
            "INBOUND_TWENTY: REVERT_UNCONFIRMED_SQL",
            parsed.opportunityId,
            "->",
            revertStage,
          );
        }
        onComplete(err);
      },
    );
  });
}

function isInternalOwocniEmail(email) {
  var normalized = makeString(email).toLowerCase();
  if (!normalized) {
    return false;
  }
  var domainPos = normalized.indexOf(LEADS_AT_INTERNAL_DOMAIN);
  if (domainPos < 0) {
    return false;
  }
  return domainPos === normalized.length - LEADS_AT_INTERNAL_DOMAIN.length;
}

function buildPersonDisplayName(parsed) {
  var record = parsed && parsed._personRecord;
  if (record && record.name && typeof record.name === "object") {
    var first = makeString(record.name.firstName || "").trim();
    var last = makeString(record.name.lastName || "").trim();
    var full = (first + " " + last).trim();
    if (full) {
      return full;
    }
  }
  return "";
}

function leadsAtEnqueueGuardKey(personId) {
  return COLLECTION_LEADS_AT_PREFIX + personId;
}

function readLeadsAtEnqueueGuard(personId, callback) {
  var url =
    API_BASE +
    "/" +
    COLLECTION_IDENTITY_MAP +
    "/documents/" +
    encodeUriComponent(leadsAtEnqueueGuardKey(personId));
  sendHttpRequest(url, { method: "GET" }, "")
    .then(function (res) {
      if (res.statusCode === 200) {
        callback(null, unwrapStoreDocument(JSON.parse(res.body || "{}")));
        return;
      }
      if (res.statusCode === 404) {
        callback(null, null);
        return;
      }
      callback("HTTP " + res.statusCode, null);
    })
    .catch(function (err) {
      callback(err, null);
    });
}

function writeLeadsAtEnqueueGuard(personId, idOid, env, callback) {
  var url =
    API_BASE +
    "/" +
    COLLECTION_IDENTITY_MAP +
    "/documents/" +
    encodeUriComponent(leadsAtEnqueueGuardKey(personId));
  sendHttpRequest(
    url,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify({
      id_oid: idOid,
      person_id: personId,
      enqueued: true,
      environment: env,
      updated_at: makeString(getTimestampMillis()),
    }),
  )
    .then(function () {
      callback(null);
    })
    .catch(function (err) {
      callback(err);
    });
}

function checkParticipantMessagesForLeads(parts, index, callback) {
  if (index >= parts.length || index >= 8) {
    callback(null, false);
    return;
  }
  var part = parts[index] || {};
  if (part.role && part.role !== "FROM") {
    checkParticipantMessagesForLeads(parts, index + 1, callback);
    return;
  }
  var msgId = part.messageId;
  if (!msgId) {
    checkParticipantMessagesForLeads(parts, index + 1, callback);
    return;
  }
  var path = buildTwentyListPath(
    "messageChannelMessageAssociations",
    "messageId[eq]:" + msgId,
    5,
  );
  twentyGet(path, function (err, res) {
    if (err || !res || res.statusCode < 200 || res.statusCode >= 300) {
      callback(err || "assoc HTTP " + (res && res.statusCode), false);
      return;
    }
    var assocs = parseTwentyListRecords(
      "messageChannelMessageAssociations",
      res.body,
    );
    var j = 0;
    while (j < assocs.length) {
      var assoc = assocs[j] || {};
      if (
        assoc.messageChannelId === LEADS_AT_MESSAGE_CHANNEL_ID &&
        assoc.direction === "INCOMING"
      ) {
        callback(null, true);
        return;
      }
      j = j + 1;
    }
    checkParticipantMessagesForLeads(parts, index + 1, callback);
  });
}

function personHasLeadsAtIncoming(personId, email, callback) {
  function finishFromParts(parts, nextStep) {
    if (!parts.length) {
      nextStep();
      return;
    }
    checkParticipantMessagesForLeads(parts, 0, function (matchErr, matched) {
      if (matchErr) {
        callback(matchErr, false);
        return;
      }
      if (matched) {
        callback(null, true);
        return;
      }
      nextStep();
    });
  }

  function lookupByEmail() {
    var normalizedEmail = normalizeResolverEmail(email);
    if (!normalizedEmail) {
      callback(null, false);
      return;
    }
    var emailPath = buildTwentyListPath(
      "messageParticipants",
      "handle[eq]:" + normalizedEmail,
      15,
    );
    twentyGet(emailPath, function (emailErr, emailRes) {
      if (emailErr || !emailRes || emailRes.statusCode < 200 || emailRes.statusCode >= 300) {
        callback(emailErr || "participants email HTTP " + (emailRes && emailRes.statusCode), false);
        return;
      }
      var emailParts = parseTwentyListRecords("messageParticipants", emailRes.body);
      finishFromParts(emailParts, function () {
        callback(null, false);
      });
    });
  }

  if (!personId) {
    lookupByEmail();
    return;
  }

  var path = buildTwentyListPath(
    "messageParticipants",
    "personId[eq]:" + personId,
    15,
  );
  twentyGet(path, function (err, res) {
    if (err || !res || res.statusCode < 200 || res.statusCode >= 300) {
      callback(err || "participants HTTP " + (res && res.statusCode), false);
      return;
    }
    var parts = parseTwentyListRecords("messageParticipants", res.body);
    finishFromParts(parts, lookupByEmail);
  });
}

function enqueueLeadsAtCreateLeadTask(parsed, idOid, env, callback) {
  var timestamp = getTimestampMillis();
  var email = normalizeResolverEmail(parsed.bizEmail);
  var phone = normalizeResolverPhone(parsed.bizPhone);
  var taskId = idOid + "_" + timestamp + "_crm_twenty_create_lead";
  var url =
    API_BASE +
    "/" +
    COLLECTION_TASK_QUEUE +
    "/documents/" +
    encodeUriComponent(taskId);
  var payload = {
    id_oid: idOid,
    id_event: timestamp + "_leads_at_create_lead",
    event_name: "generate_lead",
    job_type: CREATE_LEAD_ADAPTER,
    status: "pending",
    created_at: timestamp,
    environment: env,
    adapter: CREATE_LEAD_ADAPTER,
    inbound_channel: "leads_at",
    src_system: "TWENTY_EMAIL",
    src_action_source: "leads_at_email_sync",
    existing_person_id: parsed.personId,
    person_id: parsed.personId,
    biz_email: email || null,
    biz_phone: phone || null,
    biz_name: buildPersonDisplayName(parsed) || null,
    biz_product: "web",
  };
  sendHttpRequest(
    url,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify(payload),
  )
    .then(function (res) {
      logToConsole("LEADS_AT_CREATE: task saved", taskId, res.statusCode);
      writeLeadsAtEnqueueGuard(parsed.personId, idOid, env, function () {
        callback(null, taskId);
      });
    })
    .catch(function (err) {
      callback(err, null);
    });
}

function maybeEnqueueLeadsAtCreateLead(parsed, idOid, env, onComplete) {
  var email = normalizeResolverEmail(parsed.bizEmail);
  if (email && isInternalOwocniEmail(email)) {
    logToConsole("LEADS_AT_CREATE: SKIP_INTERNAL", email);
    onComplete(null);
    return;
  }
  if (!parsed.personId || !idOid) {
    onComplete(null);
    return;
  }
  personHasLeadsAtIncoming(parsed.personId, email, function (checkErr, hasLeads) {
    if (checkErr) {
      logToConsole("LEADS_AT_CREATE: CHECK_FAIL", checkErr);
      onComplete(null);
      return;
    }
    if (!hasLeads) {
      logToConsole("LEADS_AT_CREATE: SKIP_NO_LEADS_AT");
      onComplete(null);
      return;
    }
    readLeadsAtEnqueueGuard(parsed.personId, function (guardErr, guard) {
      if (guardErr) {
        logToConsole("LEADS_AT_CREATE: GUARD_READ_FAIL", guardErr);
        onComplete(null);
        return;
      }
      if (guard && guard.enqueued === true && guard.id_oid === idOid) {
        logToConsole("LEADS_AT_CREATE: SKIP_ALREADY_ENQUEUED");
        onComplete(null);
        return;
      }
      enqueueLeadsAtCreateLeadTask(parsed, idOid, env, function (qErr) {
        if (qErr) {
          logToConsole("LEADS_AT_CREATE: ENQUEUE_FAIL", qErr);
        }
        onComplete(null);
      });
    });
  });
}

function enqueueIdentityBackfill(idOid, personId, tier, env, email, phone, callback) {
  var timestamp = getTimestampMillis();
  var taskId = personIdentityBackfillTaskKey(personId);
  var url =
    API_BASE +
    "/" +
    COLLECTION_TASK_QUEUE +
    "/documents/" +
    encodeUriComponent(taskId);
  sendHttpRequest(
    url,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify({
      id_oid: idOid,
      id_event: timestamp + "_identity_resolve",
      event_name: "identity_resolve",
      job_type: "crm:twenty_update_person",
      status: "pending",
      created_at: timestamp,
      environment: env,
      biz_email: email,
      biz_phone: phone,
      person_id: personId,
      identity_tier: tier,
      src_system: "TWENTY_EMAIL",
      src_action_source: "identity_resolver",
      adapter: IDENTITY_ADAPTER_ID,
    }),
  )
    .then(function () {
      callback(null, taskId);
    })
    .catch(function (err) {
      callback(err, null);
    });
}

function enrichFromIdentityMap(idOid, enriched, callback) {
  if (!idOid) {
    callback(null, enriched);
    return;
  }
  var url =
    API_BASE +
    "/" +
    COLLECTION_IDENTITY_MAP +
    "/documents/" +
    encodeUriComponent(idOid);
  sendHttpRequest(url, { method: "GET" }, "")
    .then(function (res) {
      if (res.statusCode === 200) {
        var doc = unwrapStoreDocument(JSON.parse(res.body || "{}"));
        var fields = [
          "biz_email",
          "biz_phone",
          "biz_name",
          "biz_product",
          "order_id",
          "attr_gclid",
          "ctx_page_url",
          "ga_client_id",
          "client_id",
          "consent_analytics_storage",
          "consent_ad_storage",
          "ctx_ip_address",
          "ctx_time_on_page_ms",
          "biz_message",
          "owner",
        ];
        var i = 0;
        while (i < fields.length) {
          var fieldName = fields[i];
          var current = enriched[fieldName];
          if (
            (current === null || current === undefined || current === "") &&
            doc[fieldName]
          ) {
            enriched[fieldName] = doc[fieldName];
          }
          i = i + 1;
        }
      }
      callback(null, enriched);
    })
    .catch(function () {
      callback(null, enriched);
    });
}

function enrichInboundTaskFromTwenty(taskPayload, parsed, callback) {
  var enriched = JSON.parse(JSON.stringify(taskPayload));
  if (!parsed.opportunityId) {
    enrichFromIdentityMap(enriched.id_oid, enriched, callback);
    return;
  }
  function finishEnrich(result) {
    enrichFromIdentityMap(result.id_oid || parsed.opportunityIdOid, result, callback);
  }
  twentyGet(
    "/opportunities/" + encodeUriComponent(parsed.opportunityId),
    function (oppErr, oppRes) {
      if (!oppErr && oppRes && oppRes.statusCode >= 200 && oppRes.statusCode < 300) {
        var oppBody = JSON.parse(oppRes.body || "{}");
        var opp = (oppBody.data && oppBody.data.opportunity) || {};
        if (!enriched.id_oid && opp.idOid) {
          enriched.id_oid = sanitizeWebhookField(opp.idOid);
        }
        if (!enriched.biz_email && opp.bizCardEmail) {
          enriched.biz_email = opp.bizCardEmail;
        }
        if (!enriched.biz_phone && opp.bizCardPhone) {
          enriched.biz_phone = opp.bizCardPhone;
        }
        if (!enriched.biz_name && opp.name) {
          enriched.biz_name = opp.name;
        }
        if (!enriched.biz_product && opp.bizProduct) {
          enriched.biz_product = opp.bizProduct;
        }
        if (!parsed.pointOfContactId && opp.pointOfContactId) {
          parsed.pointOfContactId = opp.pointOfContactId;
        }
      }
      var personId = parsed.pointOfContactId;
      if ((!enriched.biz_email || !enriched.biz_phone) && personId) {
        fetchTwentyPersonPii(personId, function (pErr, pii) {
          if (pii) {
            if (!enriched.biz_email && pii.email) {
              enriched.biz_email = pii.email;
            }
            if (!enriched.biz_phone && pii.phone) {
              enriched.biz_phone = pii.phone;
            }
            if (!enriched.biz_name && pii.name) {
              enriched.biz_name = pii.name;
            }
          }
          finishEnrich(enriched);
        });
        return;
      }
      finishEnrich(enriched);
    },
  );
}

function fetchTwentyPersonPii(personId, callback) {
  var url =
    TWENTY_REST_URL + "/people/" + encodeUriComponent(personId);
  sendHttpRequest(
    url,
    {
      method: "GET",
      headers: { Authorization: "Bearer " + TWENTY_API_KEY },
    },
    "",
  )
    .then(function (res) {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        callback("HTTP " + res.statusCode, null);
        return;
      }
      var body = JSON.parse(res.body || "{}");
      var person = (body.data && body.data.person) || {};
      var emails = person.emails || {};
      var phones = person.phones || {};
      var phoneRaw = "";
      if (phones.primaryPhoneNumber) {
        phoneRaw =
          (phones.primaryPhoneCallingCode || "") +
          (phones.primaryPhoneNumber || "");
      }
      callback(null, {
        email: emails.primaryEmail || person.email || null,
        phone: phoneRaw || person.phone || null,
        idOid: person.idOid || null,
        name: person.name || null,
      });
    })
    .catch(function (err) {
      callback(err, null);
    });
}

function processPersonIdentityFromWebhook(parsed, env, onComplete) {
  var isPersonEvent =
    parsed.objectType === "person" ||
    parsed.eventNamePlatform.indexOf("person.") === 0;
  if (!isPersonEvent) {
    onComplete(null);
    return;
  }
  if (!parsed.personId) {
    logToConsole("INBOUND_IDENTITY: SKIP_NO_PERSON_ID");
    onComplete(null);
    return;
  }

  function runResolver() {
    if (parsed.personIdOid) {
      registerPersonMintGuard(
        parsed.personId,
        parsed.personIdOid,
        env,
        function () {
          logToConsole("INBOUND_IDENTITY: SKIP_ALREADY_HAS_IDOID");
          maybeEnqueueLeadsAtCreateLead(
            parsed,
            parsed.personIdOid,
            env,
            onComplete,
          );
        },
      );
      return;
    }
    var email = normalizeResolverEmail(parsed.bizEmail);
    var phone = normalizeResolverPhone(parsed.bizPhone);
    if (!email && !phone) {
      logToConsole("INBOUND_IDENTITY: SKIP_NO_PII");
      onComplete(null);
      return;
    }

    function afterEmailLookup(eErr, emailOid) {
      if (eErr) {
        logToConsole("INBOUND_IDENTITY: FAIL_CLOSED email", eErr);
        onComplete(eErr);
        return;
      }
      if (!phone) {
        finishResolve(emailOid, null);
        return;
      }
      readIdentityMap(phone, function (pErr, phoneOid) {
        if (pErr) {
          logToConsole("INBOUND_IDENTITY: FAIL_CLOSED phone", pErr);
          onComplete(pErr);
          return;
        }
        finishResolve(emailOid, phoneOid);
      });
    }

    function finishResolve(emailOid, phoneOid) {
      var decision = resolveIdentityTier(emailOid, phoneOid);
      logToConsole(
        "INBOUND_IDENTITY:",
        decision.tier,
        "person=",
        parsed.personId,
      );
      if (decision.tier === "T4") {
        logToConsole("INBOUND_IDENTITY: T4_NEEDS_REVIEW");
        onComplete(null);
        return;
      }
      resolvePersonIdOidForWrite(
        parsed.personId,
        decision,
        env,
        function (oidErr, idOid, writeTier) {
          if (oidErr || !idOid) {
            onComplete(oidErr || "MINT_GUARD_FAIL");
            return;
          }
          writeIdentityMapKeys(idOid, email, phone, writeTier, env, function (wErr) {
            if (wErr) {
              onComplete(wErr);
              return;
            }
            enqueueIdentityBackfill(
              idOid,
              parsed.personId,
              writeTier,
              env,
              email,
              phone,
              function (qErr) {
                if (qErr) {
                  onComplete(qErr);
                  return;
                }
                logToConsole("INBOUND_IDENTITY: RESOLVED", idOid);
                maybeEnqueueLeadsAtCreateLead(parsed, idOid, env, onComplete);
              },
            );
          });
        },
      );
    }

    if (email) {
      readIdentityMap(email, afterEmailLookup);
    } else {
      afterEmailLookup(null, null);
    }
  }

  var emailSeed = normalizeResolverEmail(parsed.bizEmail);
  var phoneSeed = normalizeResolverPhone(parsed.bizPhone);
  if (!emailSeed && !phoneSeed) {
    logToConsole("INBOUND_IDENTITY: FETCH_PERSON", parsed.personId);
    fetchTwentyPersonPii(parsed.personId, function (fetchErr, pii) {
      if (fetchErr || !pii) {
        logToConsole("INBOUND_IDENTITY: FETCH_PERSON_FAIL", fetchErr);
        onComplete(null);
        return;
      }
      if (pii.email) {
        parsed.bizEmail = pii.email;
      }
      if (pii.phone) {
        parsed.bizPhone = pii.phone;
      }
      if (pii.idOid) {
        parsed.personIdOid = pii.idOid;
      }
      if (pii.name) {
        parsed._personRecord = { name: pii.name };
      }
      runResolver();
    });
    return;
  }

  runResolver();
}

function processTwentyWebhook(webhookBody, onComplete) {
  var env = getRuntimeEnvironment();
  var parsed = parseTwentyPayload(webhookBody);
  var allowedTypes = ["opportunity", "person"];

  logToConsole("=== INBOUND_TWENTY_WEBHOOK ===", ADAPTER_ID, "env=", env);
  logToConsole(
    "platform event:",
    parsed.eventNamePlatform,
    "objectType:",
    parsed.objectType,
    "oppId:",
    parsed.opportunityId,
    "personId:",
    parsed.personId,
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

  if (parsed.objectType === "person") {
    processPersonIdentityFromWebhook(parsed, env, onComplete);
    return;
  }

  if (!parsed.opportunityId) {
    logToConsole("INBOUND_TWENTY: brak oppId — skip");
    onComplete(null);
    return;
  }

  var stateKey = storeKeyOpportunityState(parsed.opportunityId);
  var pendingKey = storeKeyPendingWrite(parsed.opportunityId);

  readJsonStore(pendingKey, function (pErr, pendingDoc) {
    if (pendingDoc && pendingDoc.active === true) {
      var pendingExpiresAt = pendingDoc.expires_at;
      var pendingStillActive =
        !pendingExpiresAt || pendingExpiresAt > getTimestampMillis();
      if (pendingStillActive) {
        logToConsole("INBOUND_TWENTY:", REASON_SKIP_ECHO_OWN_WRITE);
        onComplete(null);
        return;
      }
      logToConsole(
        "INBOUND_TWENTY: pending_write expired — continue",
        pendingKey,
      );
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

      if (decision.skip === REASON_SKIP_QUALIFIED_WITHOUT_SQL_CONFIRM) {
        logToConsole("INBOUND_TWENTY:", decision.skip);
        revertUnconfirmedSqlStage(parsed, prev, function () {
          writeJsonStore(
            stateKey,
            {
              last_stage:
                (prev && prev.last_stage) ||
                parsed.bizLastNonSqlStage ||
                parsed.stage,
              last_campaignRejected: parsed.campaignRejected,
              last_delivery_fingerprint: fp,
              updated_at: getTimestampMillis(),
            },
            function () {},
          );
          onComplete(null);
        });
        return;
      }

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
        if (parsed.pointOfContactId) {
          taskPayload.person_id = parsed.pointOfContactId;
        }
      }

      enrichInboundTaskFromTwenty(taskPayload, parsed, function (enrichErr, finalPayload) {
        enqueueTaskQueue(finalPayload, function (qErr, taskId) {
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
