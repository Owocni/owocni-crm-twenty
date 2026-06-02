/**
 * CRM_TWENTY_UPDATE_PERSON.stub.js
 * Adapter: backfill Person.idOid w Twenty po manual create / mint.
 *
 * SSOT: EVENT_CONTRACT §6.1 (L-1), ARCHITECTURE §5.5
 *
 * PRZED backfill:
 * 1) Ustaw pending_write:twenty:{opportunityId} (TTL) — loop-prevention
 * 2) Po smoke #4 PASS dopiero rozważ usunięcie srcSystem-SKIP na tej ścieżce
 */

const sendHttpRequest = require("sendHttpRequest");
const JSON = require("JSON");
const logToConsole = require("logToConsole");
const getTimestampMillis = require("getTimestampMillis");
const makeString = require("makeString");
const encodeUriComponent = require("encodeUriComponent");

var ADAPTER_ID = "crm:twenty_update_person";
var PENDING_WRITE_PREFIX = "pending_write:twenty:";

// TODO: API_BASE ze zmiennej Stape (jak Sortownia)
var BASE_URL = "https://uinpcbwf.eug.stape.io";
var API_KEY = "2d389d8d0875343a76c07c6ff388c586bbd9347duinpcbwf";
var API_BASE = BASE_URL + "/stape-api/" + API_KEY + "/v2/store/collections";

var PENDING_WRITE_TTL_MS = 45000; // do kalibracji w preflight

function setPendingWrite(opportunityId, callback) {
  var key = PENDING_WRITE_PREFIX + opportunityId;
  var doc = {
    active: true,
    adapter: ADAPTER_ID,
    expires_at: getTimestampMillis() + PENDING_WRITE_TTL_MS,
  };
  var url = API_BASE + "/twenty_state/documents/" + encodeUriComponent(key);
  sendHttpRequest(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
  }, JSON.stringify(doc))
    .then(function () {
      callback(null);
    })
    .catch(function (err) {
      callback(err);
    });
}

function updatePersonIdOid(personId, idOid, apiUrl, apiToken, callback) {
  var url = apiUrl + "/rest/people/" + encodeUriComponent(personId); // PLACEHOLDER
  var body = { idOid: idOid };
  sendHttpRequest(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiToken,
    },
  }, JSON.stringify(body))
    .then(function (res) {
      logToConsole(ADAPTER_ID, "PATCH Person idOid", res.statusCode);
      callback(null, res);
    })
    .catch(function (err) {
      callback(err, null);
    });
}

function runCrmTwentyUpdatePerson(eventData) {
  var opportunityId = eventData.opportunity_id;
  var personId = eventData.person_id; // TODO: z payloadu / Twenty API
  var idOid = eventData.id_oid;

  if (!opportunityId || !idOid || !personId) {
    logToConsole(ADAPTER_ID, "SKIP — brak opportunity_id / person_id / id_oid");
    return;
  }

  setPendingWrite(opportunityId, function (pendingErr) {
    if (pendingErr) {
      logToConsole(ADAPTER_ID, "pending-write ERROR", pendingErr);
      return;
    }

    var apiUrl = "https://YOUR_TWENTY_INSTANCE";
    var apiToken = "FROM_STAPE_SECRET";

    updatePersonIdOid(personId, idOid, apiUrl, apiToken, function (err) {
      if (err) logToConsole(ADAPTER_ID, "ERROR", err);
      else logToConsole(ADAPTER_ID, "backfill OK", idOid);
    });
  });
}

// runCrmTwentyUpdatePerson(getEventData() || {});

logToConsole(ADAPTER_ID, "stub loaded");
