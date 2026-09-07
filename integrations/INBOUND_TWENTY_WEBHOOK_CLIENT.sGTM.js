/**
 * INBOUND_TWENTY_WEBHOOK_CLIENT.sGTM.js
 * Client Template — POST /inbound/twenty_webhook (Twenty native webhook OUT).
 *
 * URL: POST https://uinpcbwf.eug.stape.io/inbound/twenty_webhook
 *
 * Permissions: claimRequest, getRequestBody, getRequestHeader, getRequestMethod,
 * getRequestPath, runContainer, returnResponse, setResponseHeader, setResponseStatus, logToConsole
 */

const claimRequest = require("claimRequest");
const getRequestBody = require("getRequestBody");
const getRequestHeader = require("getRequestHeader");
const getRequestMethod = require("getRequestMethod");
const getRequestPath = require("getRequestPath");
const returnResponse = require("returnResponse");
const runContainer = require("runContainer");
const setResponseHeader = require("setResponseHeader");
const setResponseStatus = require("setResponseStatus");
const logToConsole = require("logToConsole");

var PATH_PRIMARY = "/inbound/twenty_webhook";

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

var requestPath = getRequestPath();
var requestMethod = getRequestMethod();
var normalized = normalizePath(requestPath);

logToConsole("=== INBOUND TWENTY WEBHOOK CLIENT START ===");
logToConsole("path:", requestPath, "method:", requestMethod);

if (normalized !== PATH_PRIMARY) {
  logToConsole("skip: path mismatch, want", PATH_PRIMARY);
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
var sig =
  getRequestHeader("x-twenty-webhook-signature") ||
  getRequestHeader("X-Twenty-Webhook-Signature") ||
  "";
var ts =
  getRequestHeader("x-twenty-webhook-timestamp") ||
  getRequestHeader("X-Twenty-Webhook-Timestamp") ||
  "";

logToConsole("body length:", rawBody ? rawBody.length : 0);

runContainer(
  {
    twenty_webhook_raw_body: rawBody || "",
    twenty_webhook_signature: sig,
    twenty_webhook_timestamp: ts,
    runtime_environment: "sandbox",
    adapter_id: "inbound:twenty_webhook",
    event_name: "inbound_twenty_webhook",
  },
  function () {
    logToConsole("inbound container done");
    setResponseStatus(200);
    setResponseHeader("Content-Type", "application/json");
    returnResponse('{"status":"ok"}');
  },
);
