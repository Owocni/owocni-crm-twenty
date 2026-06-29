/**
 * TWENTY_CRM_WORKER_CLIENT.sGTM.js
 * Client Template — POST /crm/twenty_worker (Scheduler / curl).
 *
 * Kanoniczny URL (działa na produkcji):
 *   POST https://uinpcbwf.eug.stape.io/crm/twenty_worker
 *
 * /inbound/twenty_worker — opcjonalny alias w kodzie; na Stape może dawać 400.
 */

const claimRequest = require("claimRequest");
const getRequestBody = require("getRequestBody");
const getRequestMethod = require("getRequestMethod");
const getRequestPath = require("getRequestPath");
const returnResponse = require("returnResponse");
const runContainer = require("runContainer");
const setResponseHeader = require("setResponseHeader");
const setResponseStatus = require("setResponseStatus");
const logToConsole = require("logToConsole");

var PATH_PRIMARY = "/crm/twenty_worker";
var PATH_ALIAS = "/inbound/twenty_worker";
var EVENT_UPDATE_PERSON = "crm_twenty_update_person";
var EVENT_CREATE_LEAD = "crm_twenty_create_lead";

function normalizePath(requestPath) {
  var normalized = requestPath || "";
  if (normalized.charAt(0) !== "/") {
    normalized = "/" + normalized;
  }
  if (normalized.length > 1 && normalized.charAt(normalized.length - 1) === "/") {
    normalized = normalized.substring(0, normalized.length - 1);
  }
  return normalized;
}

function isWorkerPath(normalized) {
  return normalized === PATH_PRIMARY || normalized === PATH_ALIAS;
}

var requestPath = getRequestPath();
var requestMethod = getRequestMethod();
var normalized = normalizePath(requestPath);

logToConsole("=== TWENTY CRM WORKER CLIENT START ===");
logToConsole("path:", requestPath);
logToConsole("normalized:", normalized);
logToConsole("method:", requestMethod);

if (!isWorkerPath(normalized)) {
  logToConsole("skip: path mismatch, want", PATH_PRIMARY, "or", PATH_ALIAS);
  return;
}

if (requestMethod !== "POST") {
  logToConsole("reject: not POST");
  setResponseStatus(405);
  returnResponse("Method not allowed");
  return;
}

claimRequest();
logToConsole("claimed OK");

var rawBody = getRequestBody();
logToConsole("body length:", rawBody ? rawBody.length : 0);

function runWorkerEvent(eventName, adapterId, onDone) {
  var eventData = {
    adapter_id: adapterId,
    event_name: eventName,
    "x-ga-mp2-event_name": eventName,
    crm_worker_raw_body: rawBody || "",
  };

  runContainer(eventData, function () {
    logToConsole("container done:", eventName);
    onDone();
  });
}

runWorkerEvent(EVENT_UPDATE_PERSON, "crm:twenty_update_person", function () {
  runWorkerEvent(EVENT_CREATE_LEAD, "crm:twenty_create_lead", function () {
    setResponseStatus(200);
    setResponseHeader("Content-Type", "application/json");
    returnResponse('{"status":"ok"}');
  });
});
