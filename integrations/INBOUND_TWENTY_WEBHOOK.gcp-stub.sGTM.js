/**
 * INBOUND_TWENTY_WEBHOOK.gcp-stub.sGTM.js
 * STUB po migracji sandbox → GCP — wklej ZAMIAST pełnego INBOUND_TWENTY_WEBHOOK.sGTM.js
 *
 * Wymaga Client: INBOUND_TWENTY_WEBHOOK_CLIENT.sGTM.js (POST /inbound/twenty_webhook)
 * Logika: integrations/cloud-functions/twenty-inbound-webhook/
 * Legacy (prod): integrations/INBOUND_TWENTY_WEBHOOK.sGTM.legacy-full.js
 *
 * Permissions (Tag Template): Logs to console, Reads event data, Sends HTTP requests
 */

const sendHttpRequest = require("sendHttpRequest");
const logToConsole = require("logToConsole");
const getEventData = require("getEventData");
const makeString = require("makeString");

var GCP_INBOUND_WEBHOOK_URL =
  "https://twenty-inbound-webhook-sandbox-hsxlhvflrq-lm.a.run.app";

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

function getRuntimeEnvironment() {
  var raw =
    getEventDataWithFallback("runtime_environment") ||
    getEventDataWithFallback("environment") ||
    "sandbox";
  var n = makeString(raw).toLowerCase();
  return n === "sandbox" ? "sandbox" : "prod";
}

function finish(ok) {
  if (ok) {
    data.gtmOnSuccess();
  } else {
    data.gtmOnFailure();
  }
}

var rawBody = makeString(getEventDataWithFallback("twenty_webhook_raw_body") || "");
var sig = makeString(getEventDataWithFallback("twenty_webhook_signature") || "");
var ts = makeString(getEventDataWithFallback("twenty_webhook_timestamp") || "");
var env = getRuntimeEnvironment();

if (!rawBody) {
  logToConsole("INBOUND_TWENTY_STUB: brak raw body (sprawdź Client INBOUND_TWENTY_WEBHOOK_CLIENT)");
  finish(false);
} else if (env === "prod") {
  logToConsole(
    "INBOUND_TWENTY_STUB: prod — przywróć INBOUND_TWENTY_WEBHOOK.sGTM.legacy-full.js lub skonfiguruj prod GCP",
  );
  finish(true);
} else {
  var headers = {
    "Content-Type": "application/json",
    "X-Owocni-Runtime": "sandbox",
  };
  if (sig) {
    headers["twenty-webhook-signature"] = sig;
  }
  if (ts) {
    headers["twenty-webhook-timestamp"] = ts;
  }

  logToConsole(
    "INBOUND_TWENTY_STUB: forward GCP",
    GCP_INBOUND_WEBHOOK_URL,
    "bytes=",
    rawBody.length,
  );

  sendHttpRequest(
    GCP_INBOUND_WEBHOOK_URL,
    { method: "POST", headers: headers },
    rawBody,
  )
    .then(function (res) {
      logToConsole(
        "INBOUND_TWENTY_STUB: GCP",
        res.statusCode,
        (res.body || "").slice(0, 300),
      );
      finish(res.statusCode >= 200 && res.statusCode < 300);
    })
    .catch(function (err) {
      logToConsole("INBOUND_TWENTY_STUB: GCP ERROR", err);
      finish(false);
    });
}
