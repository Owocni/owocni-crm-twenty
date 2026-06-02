/**
 * CRM_TWENTY_CREATE_LEAD.stub.js
 * Adapter: Sortownia → Twenty REST/GraphQL (upsert lead po idOid).
 *
 * Trigger: po udanym paid `generate_lead` (mint idOid) lub z Inteligentnego Routingu.
 * SSOT: ARCHITECTURE §5.3, IDENTITY §5.5, DATA_MODEL (idOid unique)
 *
 * PRZED PROD:
 * - TWENTY_API_URL + TWENTY_API_TOKEN w zmiennych Stape
 * - Potwierdź shape Person + Opportunity z preflight
 */

const sendHttpRequest = require("sendHttpRequest");
const JSON = require("JSON");
const logToConsole = require("logToConsole");
const getTimestampMillis = require("getTimestampMillis");
const makeString = require("makeString");

var ADAPTER_ID = "crm:twenty_create_lead";

function buildTwentyCreateLeadPayload(taskLike) {
  return {
    idOid: taskLike.id_oid || taskLike.idOid,
    person: {
      email: taskLike.biz_email,
      phone: taskLike.biz_phone,
      name: taskLike.biz_name,
    },
    opportunity: {
      stage: "NEW",
      bizProduct: taskLike.biz_product,
      bizSource: taskLike.biz_source || taskLike.src_action_source,
      srcSystem: "OWOCNI_SORTOWNIA",
    },
  };
}

/**
 * TODO: zamień endpoint i nagłówki po dokumentacji Twenty z instancji.
 */
function createLeadInTwenty(payload, apiUrl, apiToken, callback) {
  var url = apiUrl + "/rest/opportunities"; // PLACEHOLDER — preflight
  sendHttpRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiToken,
    },
  }, JSON.stringify(payload))
    .then(function (res) {
      logToConsole(ADAPTER_ID, "HTTP", res.statusCode);
      callback(null, res);
    })
    .catch(function (err) {
      callback(err, null);
    });
}

function runCrmTwentyCreateLead(eventData) {
  var env = makeString(eventData.environment || "prod").toLowerCase();
  if (env === "sandbox") {
    logToConsole(ADAPTER_ID, "sandbox — log only, no Twenty API call");
    return;
  }

  var idOid = eventData.id_oid;
  if (!idOid) {
    logToConsole(ADAPTER_ID, "SKIP — brak id_oid");
    return;
  }

  var payload = buildTwentyCreateLeadPayload(eventData);
  var apiUrl = "https://YOUR_TWENTY_INSTANCE"; // zmienna Stape
  var apiToken = "FROM_STAPE_SECRET";

  createLeadInTwenty(payload, apiUrl, apiToken, function (err) {
    if (err) logToConsole(ADAPTER_ID, "ERROR", err);
    else logToConsole(ADAPTER_ID, "OK idOid=", idOid);
  });
}

// runCrmTwentyCreateLead(getEventData() || {});

logToConsole(ADAPTER_ID, "stub loaded");
