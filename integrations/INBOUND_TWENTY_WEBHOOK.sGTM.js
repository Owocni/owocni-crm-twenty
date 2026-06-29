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
const generateRandom = require("generateRandom");

var ADAPTER_ID = "inbound:twenty_webhook";
var IDENTITY_ADAPTER_ID = "identity:twenty_resolver";
var COLLECTION_TASK_QUEUE = "task_queue";
var COLLECTION_IDENTITY_MAP = "identity_map";
var COLLECTION_PERSON_MINT_PREFIX = "twenty_person_";
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

// Twenty — fetch Person gdy webhook update niesie tylko zmienione pola (np. jobTitle)
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
    campaignRejected: record.campaignRejected === true,
    personIdOid: record.idOid || null,
    opportunityIdOid: isPerson ? null : record.idOid || null,
    eventNamePlatform: eventPlatform,
    bizValueWon: record.bizValueWon || null,
    bizProduct: record.bizProduct || null,
    bizEmail:
      emails.primaryEmail ||
      (record.person && record.person.email) ||
      (record.pointOfContact && record.pointOfContact.email) ||
      record.email ||
      null,
    bizPhone: phoneRaw || record.phone || null,
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
  return parsed.opportunityIdOid || parsed.personIdOid || null;
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
          onComplete(null);
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
                onComplete(null);
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
        if (parsed.pointOfContactId) {
          taskPayload.person_id = parsed.pointOfContactId;
        }
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
