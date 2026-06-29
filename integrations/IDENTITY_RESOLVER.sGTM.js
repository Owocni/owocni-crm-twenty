/**
 * IDENTITY_RESOLVER.sGTM.js — Twenty Person → T1–T5 → identity_map → backfill idOid
 *
 * ⚠️ BACKUP / OPCJONALNY — od 2026-06-16 logika jest w INBOUND_TWENTY_WEBHOOK.sGTM.js
 * (`processPersonIdentityFromWebhook` dla person.*). Ten plik NIE wymaga republish, jeśli
 * inbound ma inline resolver. W Stape: tag identity_twenty_resolver → PAUZA (uniknij duplikatów).
 *
 * Trigger (gdyby włączony): ten sam Client co inbound, osobny tag AFTER inbound.
 * Obsługuje wyłącznie person.created / person.updated gdy idOid puste.
 *
 * SSOT: owocni-crm/IDENTITY_AND_INBOUND.md §5.2–5.3, §5.8
 * Store: identity_map (multi-key jak Sortownia — email/phone/id_oid)
 *
 * Permissions: Logs to console, Reads event data, Sends HTTP requests
 */

const sendHttpRequest = require("sendHttpRequest");
const JSON = require("JSON");
const logToConsole = require("logToConsole");
const getTimestampMillis = require("getTimestampMillis");
const makeString = require("makeString");
const encodeUriComponent = require("encodeUriComponent");
const getEventData = require("getEventData");
const generateRandom = require("generateRandom");

var ADAPTER_ID = "identity:twenty_resolver";
var COLLECTION_TASK_QUEUE = "task_queue";
var COLLECTION_IDENTITY_MAP = "identity_map";
var COLLECTION_PERSON_MINT_PREFIX = "twenty_person_";

var BASE_URL = "https://uinpcbwf.eug.stape.io";
var API_KEY = "2d389d8d0875343a76c07c6ff388c586bbd9347duinpcbwf";
var API_BASE = BASE_URL + "/stape-api/" + API_KEY + "/v2/store/collections";

var REASON_SKIP_ALREADY_RESOLVED = "SKIP_ALREADY_HAS_IDOID";
var REASON_SKIP_NO_PII = "SKIP_NO_EMAIL_OR_PHONE";
var REASON_SKIP_NOT_PERSON = "SKIP_NOT_PERSON_EVENT";
var REASON_FAIL_CLOSED_STORE = "FAIL_CLOSED_STORE_UNAVAILABLE";
var REASON_T4_NEEDS_REVIEW = "T4_NEEDS_REVIEW";
var REASON_RESOLVED = "RESOLVED";

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

function trimString(s) {
  if (!s || typeof s !== "string") return "";
  var start = 0;
  var end = s.length;
  while (start < end && (s.charAt(start) === " " || s.charAt(start) === "\t")) {
    start = start + 1;
  }
  while (end > start && (s.charAt(end - 1) === " " || s.charAt(end - 1) === "\t")) {
    end = end - 1;
  }
  if (start < end) return s.substring(start, end);
  return "";
}

function normalizeEmail(raw) {
  if (raw === null || raw === undefined) return undefined;
  var str = typeof raw === "string" ? raw : raw + "";
  str = trimString(str).toLowerCase();
  if (!str) return undefined;
  var at = str.indexOf("@");
  if (at < 1 || at !== str.lastIndexOf("@")) return undefined;
  var local = str.substring(0, at);
  var domain = str.substring(at + 1);
  var out = "";
  var i = 0;
  while (i < local.length + domain.length + 1) {
    var ch = i < local.length ? local.charAt(i) : (i === local.length ? "@" : domain.charAt(i - local.length - 1));
    if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r") {
      out = out + ch;
    }
    i = i + 1;
  }
  if (out.indexOf("@") < 1) return undefined;
  return out;
}

function normalizePhone(raw) {
  if (raw === null || raw === undefined) return undefined;
  var str = typeof raw === "string" ? trimString(raw) : raw + "";
  if (!str) return undefined;
  var digits = "";
  var i = 0;
  var hasPlus = str.charAt(0) === "+";
  while (i < str.length) {
    var c = str.charAt(i);
    if (c >= "0" && c <= "9") digits = digits + c;
    i = i + 1;
  }
  if (digits.length < 9) return undefined;
  if (hasPlus || digits.indexOf("48") === 0 && digits.length >= 11) {
    return "+" + digits;
  }
  if (digits.length === 9) return "+48" + digits;
  if (digits.length === 10 && digits.charAt(0) === "0") {
    return "+48" + digits.substring(1);
  }
  if (digits.length >= 10 && digits.length <= 15) return "+" + digits;
  return undefined;
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
  if (!body || typeof body !== "object") return {};
  if (body.data && body.data.data && typeof body.data.data === "object") {
    return body.data.data;
  }
  if (body.id_oid !== undefined || body.identity_status !== undefined) {
    return body;
  }
  if (body.data && typeof body.data === "object") return body.data;
  return body;
}

function parsePersonWebhook(webhookBody) {
  var payload = webhookBody || {};
  var record = payload.data || payload.record || payload;
  if (record && record.record && typeof record.record === "object") {
    record = record.record;
  }
  var eventName = payload.event || payload.operation || "";
  var emails = record.emails || {};
  var phones = record.phones || {};
  var phoneRaw = "";
  if (phones.primaryPhoneNumber) {
    phoneRaw =
      (phones.primaryPhoneCallingCode || "") + (phones.primaryPhoneNumber || "");
  }
  return {
    eventName: eventName,
    personId: record.id || "",
    existingIdOid: record.idOid || null,
    rawEmail: emails.primaryEmail || record.email || null,
    rawPhone: phoneRaw || record.phone || null,
  };
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
      logToConsole(ADAPTER_ID, "MINT_GUARD_HIT", doc.id_oid);
      callback(null, doc.id_oid);
      return;
    }
    var candidate = generateULID();
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
            ADAPTER_ID,
            "MINT_GUARD_COLLISION",
            candidate,
            "->",
            finalDoc.id_oid,
          );
        } else {
          logToConsole(ADAPTER_ID, "MINT_GUARD_CLAIM", finalDoc.id_oid);
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

function lookupIdentityMap(key, callback) {
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
        callback(null, doc.id_oid || null, doc);
      } else if (res.statusCode === 404) {
        callback(null, null, null);
      } else {
        callback("HTTP " + res.statusCode, null, null);
      }
    })
    .catch(function (err) {
      callback(err, null, null);
    });
}

function resolveTier(emailOid, phoneOid) {
  var hasEmail = emailOid !== null && emailOid !== undefined && emailOid !== "";
  var hasPhone = phoneOid !== null && phoneOid !== undefined && phoneOid !== "";
  if (!hasEmail && !hasPhone) {
    return { tier: "T3", code: "auto_mint" };
  }
  if (hasEmail && !hasPhone) {
    return { tier: "T1", code: "auto_link", id_oid: emailOid };
  }
  if (!hasEmail && hasPhone) {
    return { tier: "T1", code: "auto_link", id_oid: phoneOid };
  }
  if (emailOid === phoneOid) {
    return { tier: "T2", code: "auto_link_strong", id_oid: emailOid };
  }
  return { tier: "T4", code: "needs_review" };
}

function writeIdentityProfile(idOid, email, phone, tier, env, callback) {
  var timestamp = makeString(getTimestampMillis());
  var profile = {
    id_oid: idOid,
    biz_email: email || null,
    biz_phone: phone || null,
    identity_status: tier === "T4" ? "needs_review" : "verified",
    vbb_eligible: false,
    identity_tier: tier,
    updated_at: timestamp,
    last_resolver: ADAPTER_ID,
    environment: env,
  };

  var keys = [idOid];
  if (email) keys.push(email);
  if (phone) keys.push(phone);

  function putKey(index) {
    if (index >= keys.length) {
      callback(null);
      return;
    }
    var k = keys[index];
    var url =
      API_BASE +
      "/" +
      COLLECTION_IDENTITY_MAP +
      "/documents/" +
      encodeUriComponent(k);
    sendHttpRequest(
      url,
      { method: "PUT", headers: { "Content-Type": "application/json" } },
      JSON.stringify(profile),
    )
      .then(function () {
        putKey(index + 1);
      })
      .catch(function (err) {
        callback(err);
      });
  }

  putKey(0);
}

function enqueueBackfillTask(idOid, personId, tier, env, email, phone, callback) {
  var timestamp = getTimestampMillis();
  var taskId = personIdentityBackfillTaskKey(personId);
  var url =
    API_BASE +
    "/" +
    COLLECTION_TASK_QUEUE +
    "/documents/" +
    encodeUriComponent(taskId);
  var taskPayload = {
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
    adapter: ADAPTER_ID,
  };

  sendHttpRequest(
    url,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify(taskPayload),
  )
    .then(function (res) {
      logToConsole(ADAPTER_ID, "task_queue saved", taskId, res.statusCode);
      callback(null, taskId);
    })
    .catch(function (err) {
      callback(err, null);
    });
}

function processPersonIdentity(webhookBody, onComplete) {
  var env = getRuntimeEnvironment();
  var parsed = parsePersonWebhook(webhookBody);

  logToConsole("=== IDENTITY_RESOLVER ===", parsed.eventName, "person=", parsed.personId);

  if (parsed.eventName.indexOf("person.") !== 0) {
    logToConsole(ADAPTER_ID, REASON_SKIP_NOT_PERSON, parsed.eventName);
    onComplete(null);
    return;
  }

  if (parsed.existingIdOid) {
    registerPersonMintGuard(
      parsed.personId,
      parsed.existingIdOid,
      env,
      function () {
        logToConsole(ADAPTER_ID, REASON_SKIP_ALREADY_RESOLVED, parsed.existingIdOid);
        onComplete(null);
      },
    );
    return;
  }

  var email = normalizeEmail(parsed.rawEmail);
  var phone = normalizePhone(parsed.rawPhone);

  if (!email && !phone) {
    logToConsole(ADAPTER_ID, REASON_SKIP_NO_PII);
    onComplete(null);
    return;
  }

  if (!parsed.personId) {
    logToConsole(ADAPTER_ID, "SKIP — brak personId");
    onComplete(null);
    return;
  }

  lookupBoth(email, phone, function (lookupErr, emailOid, phoneOid) {
    if (lookupErr) {
      logToConsole(ADAPTER_ID, REASON_FAIL_CLOSED_STORE, lookupErr);
      onComplete(lookupErr);
      return;
    }

    var decision = resolveTier(emailOid, phoneOid);
    logToConsole(
      ADAPTER_ID,
      "tier=",
      decision.tier,
      decision.code,
      "emailHit=",
      emailOid,
      "phoneHit=",
      phoneOid,
    );

    if (decision.tier === "T4") {
      logToConsole(ADAPTER_ID, REASON_T4_NEEDS_REVIEW, parsed.personId);
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
        if (writeTier === "T3") {
          logToConsole(ADAPTER_ID, "mint idOid", idOid);
        }

        writeIdentityProfile(idOid, email, phone, writeTier, env, function (writeErr) {
          if (writeErr) {
            logToConsole(ADAPTER_ID, REASON_FAIL_CLOSED_STORE, "write", writeErr);
            onComplete(writeErr);
            return;
          }

          enqueueBackfillTask(
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
              logToConsole(ADAPTER_ID, REASON_RESOLVED, idOid, parsed.personId);
              onComplete(null);
            },
          );
        });
      },
    );
  });
}

function lookupBoth(email, phone, callback) {
  if (!email && !phone) {
    callback(null, null, null);
    return;
  }

  if (!email) {
    lookupIdentityMap(phone, function (err, phoneOid) {
      if (err) {
        callback(err);
        return;
      }
      callback(null, null, phoneOid);
    });
    return;
  }

  lookupIdentityMap(email, function (emailErr, emailOid) {
    if (emailErr) {
      callback(emailErr);
      return;
    }
    if (!phone) {
      callback(null, emailOid, null);
      return;
    }
    lookupIdentityMap(phone, function (phoneErr, phoneOid) {
      if (phoneErr) {
        callback(phoneErr);
        return;
      }
      callback(null, emailOid, phoneOid);
    });
  });
}

function getRuntimeEnvironment() {
  var raw = getEventDataWithFallback("runtime_environment") || "sandbox";
  var n = makeString(raw).toLowerCase();
  return n === "sandbox" ? "sandbox" : "prod";
}

// --- ENTRY POINT ---
var rawBody = getEventDataWithFallback("twenty_webhook_raw_body");

if (!rawBody) {
  logToConsole(ADAPTER_ID, "brak raw body — skip");
  finish(true);
} else {
  var webhookBody = JSON.parse(rawBody);
  if (!webhookBody || typeof webhookBody !== "object") {
    logToConsole(ADAPTER_ID, "invalid JSON");
    finish(false);
  } else {
    processPersonIdentity(webhookBody, function (err) {
      finish(!err);
    });
  }
}
