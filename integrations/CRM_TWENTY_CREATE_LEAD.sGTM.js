const sendHttpRequest = require("sendHttpRequest");
const JSON = require("JSON");
const logToConsole = require("logToConsole");
const getTimestampMillis = require("getTimestampMillis");
const makeString = require("makeString");
const encodeUriComponent = require("encodeUriComponent");
const getEventData = require("getEventData");
var ADAPTER_ID = "crm:twenty_create_lead";
var COLLECTION_TASK_QUEUE = "task_queue";
var PENDING_WRITE_PREFIX = "pending_write_twenty_";
var STATE_PREFIX = "create_lead_id_oid_";
var CREATE_LEAD_WRITE_ENABLED = true;
var CREATE_LEAD_BUILD_ID="2026-07-07-v17";
var OWNER_MACIEJ = "7fddba1d-e443-47d4-97b7-a3a829efd8c1";
var OWNER_MARTA = "4704e0c0-8d77-4640-ad1e-1875294294df";
var OWNER_GOSIA = "ccac533d-a34b-4cfc-a036-9e75ee3f8910";
var PENDING_WRITE_TTL_MS = 45000;
var MAX_TASKS_PER_RUN = 5;
var BASE_URL = "https://uinpcbwf.eug.stape.io";
var API_KEY = "2d389d8d0875343a76c07c6ff388c586bbd9347duinpcbwf";
var API_BASE = BASE_URL + "/stape-api/" + API_KEY + "/v2/store/collections";
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
function stripTrailingSlash(url) {
  url = makeString(url);
  if (url.length > 0 && url.charAt(url.length - 1) === "/") {
    return url.substring(0, url.length - 1);
  }
  return url;
}
function resolveTwentyConfig() {
  var restUrl = stripTrailingSlash(
    getEventDataWithFallback("twenty_rest_url") || TWENTY_REST_URL,
  );
  var apiKey = makeString(
    getEventDataWithFallback("twenty_api_key") || TWENTY_API_KEY,
  );
  return { restUrl: restUrl, apiKey: apiKey };
}
function getEventWriteFlag() {
  return getEventDataWithFallback("twenty_create_lead_write");
}
function isWriteEnabled() {
  if (CREATE_LEAD_WRITE_ENABLED === true) {
    return true;
  }
  var flag = getEventWriteFlag();
  if (flag === true || flag === "true" || flag === "1") {
    return true;
  }
  return false;
}
function getWriteAudit() {
  return {
    buildId: CREATE_LEAD_BUILD_ID,
    templateWrite: CREATE_LEAD_WRITE_ENABLED === true,
    eventWriteFlag: makeString(getEventWriteFlag()),
    writeEnabled: isWriteEnabled(),
  };
}
function normalizeTaskItem(item) {
  var key = item.key || "";
  var raw = item.data || {};
  if (
    raw.data &&
    typeof raw.data === "object" &&
    raw.status === undefined &&
    raw.job_type === undefined
  ) {
    return { key: key, data: raw.data };
  }
  return { key: key, data: raw };
}
function fetchPendingCreateLeadTasks(callback) {
  var url = API_BASE + "/" + COLLECTION_TASK_QUEUE + "/documents";
  var eqOp = "\u0024eq";
  var requestBody = {
    filter: {
      data: {
        status: {},
        job_type: {},
      },
    },
    pagination: {
      sort: [{ field: "created_at", order: "asc" }],
      limit: 50,
    },
  };
  requestBody.filter.data.status[eqOp] = "pending";
  requestBody.filter.data.job_type[eqOp] = ADAPTER_ID;
  sendHttpRequest(
    url,
    { method: "POST", headers: { "Content-Type": "application/json" } },
    JSON.stringify(requestBody),
  )
    .then(function (res) {
      var parsed = JSON.parse(res.body || "{}");
      var items = (parsed.data && parsed.data.items) || [];
      var tasks = [];
      var i = 0;
      while (i < items.length) {
        var normalized = normalizeTaskItem(items[i]);
        var taskData = normalized.data || {};
        if (
          taskData.status === "pending" &&
          taskData.job_type === ADAPTER_ID
        ) {
          tasks.push({ key: normalized.key, data: taskData });
        }
        i = i + 1;
      }
      callback(null, tasks);
    })
    .catch(function (err) {
      callback(err, []);
    });
}
function mapBizProductToTwenty(slug) {
  if (!slug) {
    return "INNE";
  }
  var s = makeString(slug).toLowerCase().trim();
  if (s === "strony" || s === "strona" || s === "web") {
    return "WEB";
  }
  if (s === "logo") {
    return "LOGO";
  }
  if (s === "nazwa" || s === "naming" || s === "nazwy") {
    return "NAME";
  }
  if (
    s === "copywriting" ||
    s === "nazwa/teksty" ||
    s === "nazwa/tekst" ||
    s === "teksty"
  ) {
    return "COPYWRITING";
  }
  if (s.indexOf("nazwa") >= 0 && s.indexOf("tekst") >= 0) {
    return "COPYWRITING";
  }
  if (s === "opakowanie" || s === "packaging") {
    return "OPAKOWANIE";
  }
  if (s === "marketing" || s === "strategia" || s === "konsultacje") {
    return "MARKETING";
  }
  var upper = makeString(slug).toUpperCase().trim();
  if (
    upper === "WEB" ||
    upper === "LOGO" ||
    upper === "NAME" ||
    upper === "MARKETING" ||
    upper === "COPYWRITING" ||
    upper === "OPAKOWANIE" ||
    upper === "INNE"
  ) {
    return upper;
  }
  return "INNE";
}
function normalizeBizProductSlug(product) {
  var s = makeString(product).toLowerCase().trim();
  if (!s || s === "kontakt" || s === "main") {
    return "";
  }
  if (s === "strona") {
    return "strony";
  }
  if (s === "nazwa/teksty" || s === "nazwa/tekst" || s === "teksty") {
    return "copywriting";
  }
  return s;
}
function inferBizProductFromUrl(url) {
  url = makeString(url).toLowerCase();
  if (!url) {
    return "";
  }
  if (url.indexOf("projektowanie-logo") >= 0 || url.indexOf("/logo") >= 0) {
    return "logo";
  }
  if (
    url.indexOf("tworzenie-stron") >= 0 ||
    url.indexOf("strony.owocni") >= 0 ||
    url.indexOf("/strony") >= 0
  ) {
    return "strony";
  }
  if (url.indexOf("copywriting") >= 0) {
    return "copywriting";
  }
  if (url.indexOf("nazwa") >= 0 || url.indexOf("naming") >= 0) {
    return "copywriting";
  }
  if (url.indexOf("strategia") >= 0 || url.indexOf("konsultacje") >= 0) {
    return "marketing";
  }
  return "";
}
function stripHtmlTags(text) {
  var out = "";
  var inTag = false;
  var i = 0;
  while (i < text.length) {
    var ch = text.charAt(i);
    if (ch === "<") {
      inTag = true;
    } else if (ch === ">") {
      inTag = false;
    } else if (!inTag) {
      out = out + ch;
    }
    i = i + 1;
  }
  return out;
}
function collapseWhitespace(text) {
  var out = "";
  var prevSpace = false;
  var i = 0;
  while (i < text.length) {
    var ch = text.charAt(i);
    var isSpace =
      ch === " " || ch === "\n" || ch === "\r" || ch === "\t";
    if (isSpace) {
      if (!prevSpace) {
        out = out + " ";
        prevSpace = true;
      }
    } else {
      out = out + ch;
      prevSpace = false;
    }
    i = i + 1;
  }
  return out;
}
function legacyMailBlob(taskData) {
  var s = makeString(taskData.biz_message || taskData.description || "");
  s = s.split("<br>").join("\n");
  s = s.split("<br/>").join("\n");
  s = s.split("<br />").join("\n");
  s = s.split("<BR>").join("\n");
  s = s.split("&nbsp;").join(" ");
  s = stripHtmlTags(s);
  s = collapseWhitespace(s);
  return s.toLowerCase().trim();
}
function enrichAnswersFromLegacyContent(taskData, answers) {
  var blob = legacyMailBlob(taskData);
  if (!blob) {
    return answers;
  }
  if (blob.indexOf("zapytanie dla strony") >= 0) {
    answers._legacy_product = "strony";
  } else if (blob.indexOf("zapytanie dla nazwa") >= 0) {
    answers._legacy_product = "copywriting";
  } else if (blob.indexOf("zapytanie dla logo") >= 0) {
    answers._legacy_product = "logo";
  } else if (blob.indexOf("zapytanie dla marketingu") >= 0) {
    answers._legacy_product = "marketing";
  }
  if (
    blob.indexOf("nowa strona dla nowej firmy") >= 0 ||
    blob.indexOf("nowa marka") >= 0 ||
    blob.indexOf("pierwsza działalność") >= 0 ||
    blob.indexOf("pierwsza dzialalnosc") >= 0
  ) {
    answers.strona_ma = answers.strona_ma || "new";
    answers.logo_ma = answers.logo_ma || "new";
    answers.nazwa_ma = answers.nazwa_ma || "new";
  }
  if (blob.indexOf("istniej") >= 0 && blob.indexOf("stron") >= 0) {
    answers.strona_ma = "existing";
  }
  if (blob.indexOf("ekspert") >= 0 || blob.indexOf("chce eksperta") >= 0) {
    answers.strona_jaka = answers.strona_jaka || "premium";
    answers.nazwa_jaka = answers.nazwa_jaka || "premium";
  } else if (
    blob.indexOf("najtańsza") >= 0 ||
    blob.indexOf("najtansza") >= 0 ||
    blob.indexOf("szuka czegoś taniego") >= 0 ||
    blob.indexOf("szuka czegos taniego") >= 0
  ) {
    answers.strona_jaka = answers.strona_jaka || "basic";
    answers.nazwa_jaka = answers.nazwa_jaka || "basic";
  }
  var specIdx = blob.indexOf("specjalizacja:");
  if (specIdx >= 0) {
    var spec = blob.substring(specIdx, specIdx + 48);
    if (spec.indexOf("online") >= 0) {
      answers.strona_model = answers.strona_model || "online";
    } else if (spec.indexOf("b2b") >= 0) {
      answers.strona_model = answers.strona_model || "b2b";
    } else if (spec.indexOf("local") >= 0 || spec.indexOf("lokal") >= 0) {
      answers.strona_model = answers.strona_model || "local";
    } else if (spec.indexOf("ecommerce") >= 0 || spec.indexOf("sklep") >= 0) {
      answers.strona_model = answers.strona_model || "ecommerce";
    }
  }
  if (!answers.recipient) {
    var roleIdx = blob.indexOf("role:");
    if (roleIdx >= 0) {
      answers.recipient = blob.substring(roleIdx + 5, roleIdx + 120);
    }
  }
  return answers;
}
function resolveEffectiveBizProductSlug(taskData, answers) {
  var slug = normalizeBizProductSlug(
    taskData.biz_form_product ||
      taskData.biz_product ||
      answers._legacy_product ||
      "",
  );
  if (slug) {
    return slug;
  }
  slug =
    inferBizProductFromUrl(taskData.ctx_landing_page_url) ||
    inferBizProductFromUrl(taskData.ctx_page_url);
  return slug || normalizeBizProductSlug(taskData.biz_product);
}
function resolveTwentyBizProduct(taskData, answers) {
  return mapBizProductToTwenty(resolveEffectiveBizProductSlug(taskData, answers));
}
function resolveOpportunityOwnerId(bizProductTwenty, idOid) {
  if (bizProductTwenty === "COPYWRITING") {
    return OWNER_MACIEJ;
  }
  var hash = 0;
  var s = makeString(idOid);
  var i = 0;
  while (i < s.length) {
    hash = hash + s.charCodeAt(i);
    i = i + 1;
  }
  return hash % 2 === 0 ? OWNER_GOSIA : OWNER_MARTA;
}
function mapBizSource(taskData) {
  if (taskData.attr_gclid) {
    return "GOOGLE_ADS";
  }
  var src = makeString(taskData.src_action_source || "").toLowerCase();
  if (src === "referral" || src === "polecenie") {
    return "POLECENIE";
  }
  return "FORM";
}
function splitFullName(full) {
  full = makeString(full).trim();
  if (!full) {
    return { firstName: "Lead", lastName: "Formularz" };
  }
  var space = full.indexOf(" ");
  if (space < 0) {
    return { firstName: full, lastName: "" };
  }
  return {
    firstName: full.substring(0, space),
    lastName: full.substring(space + 1),
  };
}
function resolveInboundChannel(taskData) {
  var channel = makeString(taskData.inbound_channel || "").trim();
  if (channel) {
    return channel;
  }
  if (makeString(taskData.src_system || "").trim() === "TWENTY_EMAIL") {
    return "leads_at";
  }
  return "";
}
function hasFormKanbanContext(taskData) {
  var answers = parseFormAnswers(taskData);
  if (
    answers.strona_jaka ||
    answers.logo_jakie ||
    answers.strona_ma ||
    answers.logo_ma ||
    answers.strona_cena
  ) {
    return true;
  }
  if (makeString(taskData.biz_form_answers || "").trim()) {
    return true;
  }
  if (makeString(taskData.biz_form_product || "").trim()) {
    return true;
  }
  return false;
}
function resolveSrcSystem(taskData) {
  if (hasFormKanbanContext(taskData)) {
    return "OWOCNI_SORTOWNIA";
  }
  if (resolveInboundChannel(taskData) === "leads_at") {
    return "TWENTY_EMAIL";
  }
  return "OWOCNI_SORTOWNIA";
}
function resolveBizSourceForTask(taskData) {
  if (resolveSrcSystem(taskData) === "TWENTY_EMAIL") {
    return "INNE";
  }
  return mapBizSource(taskData);
}
function parseFormAnswers(taskData) {
  var answers = {};
  var raw =
    taskData.biz_form_answers ||
    taskData.form_answers ||
    taskData.answers ||
    null;
  if (raw) {
    if (typeof raw === "object") {
      answers = raw;
    } else {
      var s = makeString(raw).trim();
      if (s.length >= 2) {
        if (s.charAt(0) === '"') {
          s = JSON.parse(s);
        }
        if (typeof s === "string" && s.charAt(0) === "{") {
          var parsed = JSON.parse(s);
          if (parsed && typeof parsed === "object") {
            answers = parsed;
          }
        } else if (typeof s === "object" && s) {
          answers = s;
        }
      }
    }
  }
  if (!answers.recipient) {
    var topRecipient = makeString(taskData.recipient || "").trim();
    if (topRecipient) {
      answers.recipient = topRecipient;
    }
  }
  return enrichAnswersFromLegacyContent(taskData, answers);
}
function productLabelForName(taskData) {
  var answers = parseFormAnswers(taskData);
  var slug = resolveEffectiveBizProductSlug(taskData, answers);
  if (slug === "strony" || slug === "strona" || slug === "web") {
    return "Strona";
  }
  if (slug === "logo") {
    return "Logo";
  }
  if (slug === "nazwy" || slug === "nazwa" || slug === "naming") {
    return "Naming";
  }
  if (slug === "marketing") {
    return "Marketing";
  }
  if (slug === "copywriting") {
    return "Copywriting";
  }
  var mapped = mapBizProductToTwenty(slug || taskData.biz_product);
  if (mapped === "WEB") {
    return "Strona";
  }
  if (mapped === "LOGO") {
    return "Logo";
  }
  if (mapped === "NAME") {
    return "Naming";
  }
  if (mapped === "MARKETING") {
    return "Marketing";
  }
  if (mapped === "COPYWRITING") {
    return "Copywriting";
  }
  return "";
}
function deriveProjectType(answers) {
  var hasExisting =
    answers.strona_ma === "existing" ||
    answers.logo_ma === "existing" ||
    answers.nazwa_ma === "existing";
  var isNew =
    answers.strona_ma === "new" ||
    answers.logo_ma === "new" ||
    answers.nazwa_ma === "new";
  if (hasExisting) {
    return { api: "REDESIGN", label: "Redesign" };
  }
  if (isNew) {
    return { api: "NEW", label: "Nowe" };
  }
  return null;
}
function deriveIntent(answers) {
  var quality =
    answers.strona_jaka ||
    answers.logo_jakie ||
    answers.nazwa_jaka ||
    answers.marketing_jaka ||
    null;
  if (quality === "basic") {
    return { api: "CENNIK", label: "Cennik" };
  }
  if (quality === "premium") {
    return { api: "EKSPERT", label: "Ekspert" };
  }
  return null;
}
function pad2(n) {
  if (n < 10) {
    return "0" + n;
  }
  return n + "";
}
function pad3(n) {
  if (n < 10) {
    return "00" + n;
  }
  if (n < 100) {
    return "0" + n;
  }
  return n + "";
}
function civilFromDays(z) {
  z = z + 719468;
  var era = floorDiv(z, 146097);
  var doe = z - era * 146097;
  var yoe = floorDiv(
    doe - floorDiv(doe, 1460) + floorDiv(doe, 36524) - floorDiv(doe, 146096),
    365,
  );
  var y = yoe + era * 400;
  var doy =
    doe -
    (365 * yoe +
      floorDiv(yoe, 4) -
      floorDiv(yoe, 100) +
      floorDiv(yoe, 400));
  var mp = floorDiv(5 * doy + 2, 153);
  var d = doy - floorDiv(153 * mp + 2, 5) + 1;
  var m = mp + (mp < 10 ? 3 : -9);
  y = y + (m <= 2 ? 1 : 0);
  return { y: y, m: m, d: d };
}
function millisToIsoUtc(ms) {
  ms = toNumber(ms);
  if (ms <= 0) {
    return "";
  }
  var msRem = ms % 1000;
  var totalSec = floorDiv(ms - msRem, 1000);
  var sec = totalSec % 60;
  var totalMin = floorDiv(totalSec - sec, 60);
  var min = totalMin % 60;
  var totalHour = floorDiv(totalMin - min, 60);
  var hour = totalHour % 24;
  var z = floorDiv(totalHour - hour, 24);
  var parts = civilFromDays(z);
  return (
    parts.y +
    "-" +
    pad2(parts.m) +
    "-" +
    pad2(parts.d) +
    "T" +
    pad2(hour) +
    ":" +
    pad2(min) +
    ":" +
    pad2(sec) +
    "." +
    pad3(msRem) +
    "Z"
  );
}
function resolveTaskContactFields(taskData) {
  var answers = parseFormAnswers(taskData);
  var phone = makeString(
    taskData.biz_phone ||
      answers.phone ||
"",
  ).trim();
  return {
    email: makeString(taskData.biz_email || answers.email || "").trim(),
    phone: phone,
    name: makeString(
      taskData.biz_name || answers.name || answers.first_name || "",
    ).trim(),
  };
}
function formatPhoneForTwenty(raw) {
  var s = makeString(raw).trim();
  if (!s) {
    return null;
  }
  var digits = "";
  var hadPlus = s.charAt(0) === "+";
  var i = 0;
  while (i < s.length) {
    var c = s.charAt(i);
    if (c >= "0" && c <= "9") {
      digits = digits + c;
    }
    i = i + 1;
  }
  if (digits.length < 7) {
    return null;
  }
  if (digits.length === 11 && digits.substring(0, 2) === "48") {
    return {
      primaryPhoneCallingCode: "+48",
      primaryPhoneNumber: digits.substring(2),
    };
  }
  if (digits.length === 9) {
    return {
      primaryPhoneCallingCode: "+48",
      primaryPhoneNumber: digits,
    };
  }
  if (hadPlus && digits.length >= 10 && digits.substring(0, 2) === "48") {
    return {
      primaryPhoneCallingCode: "+48",
      primaryPhoneNumber: digits.substring(2),
    };
  }
  if (digits.length >= 7 && digits.length <= 15) {
    return {
      primaryPhoneCallingCode: "+48",
      primaryPhoneNumber: digits,
    };
  }
  return null;
}
function resolveContactLabel(taskData, answers) {
  var name = makeString(
    answers.name || taskData.biz_name || answers.first_name || "",
  ).trim();
  if (name) {
    return name;
  }
  var email = makeString(taskData.biz_email || answers.email || "").trim();
  if (email) {
    var at = email.indexOf("@");
    if (at > 0) {
      return email.substring(0, at);
    }
    return email;
  }
  var phone = makeString(taskData.biz_phone || answers.phone || "").trim();
  if (phone) {
    return phone;
  }
  return "Lead";
}
function digitValue(ch) {
  if (ch === "0") {
    return 0;
  }
  if (ch === "1") {
    return 1;
  }
  if (ch === "2") {
    return 2;
  }
  if (ch === "3") {
    return 3;
  }
  if (ch === "4") {
    return 4;
  }
  if (ch === "5") {
    return 5;
  }
  if (ch === "6") {
    return 6;
  }
  if (ch === "7") {
    return 7;
  }
  if (ch === "8") {
    return 8;
  }
  if (ch === "9") {
    return 9;
  }
  return -1;
}
function parseIntegerString(s) {
  if (!s) {
    return 0;
  }
  var i = 0;
  var neg = false;
  if (s.charAt(0) === "-") {
    neg = true;
    i = 1;
  }
  var out = 0;
  while (i < s.length) {
    var d = digitValue(s.charAt(i));
    if (d < 0) {
      break;
    }
    out = out * 10 + d;
    i = i + 1;
  }
  if (neg) {
    out = 0 - out;
  }
  return out;
}
function toNumber(value) {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "number") {
    if (value !== value) {
      return 0;
    }
    return value;
  }
  return parseIntegerString(makeString(value).trim());
}
function floorDiv(a, b) {
  a = toNumber(a);
  b = toNumber(b);
  if (b <= 0 || a < 0) {
    return 0;
  }
  var raw = makeString(a / b);
  var dot = raw.indexOf(".");
  if (dot >= 0) {
    raw = raw.substring(0, dot);
  }
  return parseIntegerString(raw);
}
function roundNumber(value) {
  var n = toNumber(value);
  if (n < 0) {
    return 0;
  }
  return n;
}
function floorNumber(value) {
  return floorDiv(value, 1);
}
function formatPlnAmount(value) {
  var n = roundNumber(value);
  if (n <= 0) {
    return "";
  }
  var digits = makeString(n);
  var out = "";
  var i = 0;
  while (i < digits.length) {
    if (i > 0 && (digits.length - i) % 3 === 0) {
      out = out + " ";
    }
    out = out + digits.charAt(i);
    i = i + 1;
  }
  return out + " PLN";
}
function deriveValueRange(answers, taskData) {
  var budgetKey = answers.strona_cena || answers.marketing_budzet || null;
  if (budgetKey === "4-10k") {
    return { min: 4000, max: 10000 };
  }
  if (budgetKey === "10-25k") {
    return { min: 10000, max: 25000 };
  }
  if (budgetKey === "25k+") {
    return { min: 25000, max: null };
  }
  if (budgetKey === "unknown") {
    return { min: null, max: null, unknown: true };
  }
  var explicitMin = taskData.biz_value_min || taskData.biz_valueMin;
  var explicitMax = taskData.biz_value_max || taskData.biz_valueMax;
  if (explicitMin || explicitMax) {
    return {
      min: explicitMin ? toNumber(explicitMin) : null,
      max: explicitMax ? toNumber(explicitMax) : null,
    };
  }
  var single = taskData.biz_value;
  if (single) {
    var v = toNumber(single);
    if (v > 0) {
      return { min: v, max: v };
    }
  }
  return { min: null, max: null };
}
function buildValueDisplay(range, fixedAmountMicros) {
  if (fixedAmountMicros && fixedAmountMicros > 0) {
    return formatPlnAmount(floorDiv(fixedAmountMicros, 1000000));
  }
  if (!range) {
    return "0 PLN";
  }
  if (range.unknown) {
    return "Do ustalenia";
  }
  if (range.min && range.max && range.min !== range.max) {
    return formatPlnAmount(range.min) + " – " + formatPlnAmount(range.max);
  }
  if (range.min && !range.max) {
    return "od " + formatPlnAmount(range.min);
  }
  if (range.min) {
    return formatPlnAmount(range.min);
  }
  return "0 PLN";
}
function buildTwentyCurrency(amountPln) {
  var n = toNumber(amountPln);
  if (n < 0) {
    n = 0;
  }
  return {
    amountMicros: roundNumber(n * 1000000),
    currencyCode: "PLN",
  };
}
function formatTimeOnPageDisplay(taskData) {
  var ms = toNumber(
    taskData.ctx_time_on_page_ms || taskData.ctxTimeOnPageMs || 0,
  );
  if (ms <= 0) {
    return null;
  }
  var totalSec = floorDiv(ms, 1000);
  var min = floorDiv(totalSec, 60);
  var sec = totalSec % 60;
  if (min > 0 && sec > 0) {
    return min + " min " + sec + " s";
  }
  if (min > 0) {
    return min + " min";
  }
  return sec + " s";
}
function deriveDeviceType(taskData) {
  var ua = makeString(taskData.ctx_user_agent || "").toLowerCase();
  if (!ua) {
    return null;
  }
  if (ua.indexOf("ipad") >= 0) {
    return "TABLET";
  }
  if (ua.indexOf("tablet") >= 0 && ua.indexOf("mobile") < 0) {
    return "TABLET";
  }
  if (
    ua.indexOf("mobile") >= 0 ||
    ua.indexOf("iphone") >= 0 ||
    ua.indexOf("android") >= 0
  ) {
    return "MOBILE";
  }
  if (
    ua.indexOf("windows") >= 0 ||
    ua.indexOf("macintosh") >= 0 ||
    ua.indexOf("linux") >= 0 ||
    ua.indexOf("cros") >= 0
  ) {
    return "DESKTOP";
  }
  return "OTHER";
}
function normalizeRecipientToken(value) {
  var token = makeString(value || "")
    .toLowerCase()
    .trim();
  if (!token) {
    return "";
  }
  if (
    token === "board" ||
    token.indexOf("przeloz") >= 0 ||
    token.indexOf("przełoż") >= 0 ||
    token.indexOf("decyzj") >= 0
  ) {
    return "board";
  }
  if (
    token === "me" ||
    token.indexOf("wlasciciel") >= 0 ||
    token.indexOf("właściciel") >= 0 ||
    token.indexOf("budzet") >= 0 ||
    token.indexOf("budżet") >= 0 ||
    token.indexOf("dla mnie") >= 0
  ) {
    return "me";
  }
  return "";
}
function deriveContactRole(answers) {
  var recipient = normalizeRecipientToken(answers.recipient);
  if (recipient === "board") {
    return "BOARD";
  }
  if (recipient === "me") {
    return "OWNER";
  }
  return null;
}
function deriveBusinessModel(answers) {
  var model = makeString(answers.strona_model || "").toLowerCase();
  if (model === "b2b") {
    return "B2B";
  }
  if (model === "local") {
    return "LOCAL";
  }
  if (model === "ecommerce") {
    return "ECOMMERCE";
  }
  if (model === "online") {
    return "ONLINE";
  }
  return null;
}
function deriveMailingOptInInitial(taskData) {
  var product = makeString(
    taskData.biz_form_product || taskData.biz_product || "",
  ).toLowerCase();
  if (
    product === "strony" ||
    product === "strona" ||
    product === "web" ||
    product === "strony_owocni"
  ) {
    return "PENDING";
  }
  return "NA";
}
function resolveLastContactIso(taskData) {
  var iso = makeString(taskData.time_occurred_iso_utc || "").trim();
  if (iso.indexOf("T") !== -1) {
    return iso;
  }
  var runMs = toNumber(taskData.create_lead_run_started_at);
  var createdMs = toNumber(taskData.created_at);
  var useMs = createdMs;
  if (runMs > 0 && createdMs > 0 && runMs - createdMs > 3600000) {
    useMs = runMs;
  } else if (runMs > 0 && createdMs <= 0) {
    useMs = runMs;
  } else if (useMs <= 0) {
    useMs = getTimestampMillis();
  }
  return millisToIsoUtc(useMs);
}
function buildBizLastContactLabelAtCreate() {
  return "Godzin: 0";
}
function buildOpportunityName(taskData) {
  if (resolveSrcSystem(taskData) === "TWENTY_EMAIL") {
    var subject = makeString(
      taskData.biz_subject || taskData.inbound_subject || "",
    ).trim();
    var mailName = makeString(taskData.biz_name || "").trim();
    var mailEmail = makeString(taskData.biz_email || "").trim();
    if (subject) {
      return subject + " — mail leads@";
    }
    if (mailName) {
      return mailName + " — mail leads@";
    }
    if (mailEmail) {
      return mailEmail + " — mail leads@";
    }
    return "Lead mail leads@";
  }
  var answers = parseFormAnswers(taskData);
  var segments = [];
  var productLabel = productLabelForName(taskData);
  if (productLabel) {
    segments.push(productLabel);
  }
  var projectType = deriveProjectType(answers);
  if (projectType && projectType.label) {
    segments.push(projectType.label);
  }
  var intent = deriveIntent(answers);
  if (intent && intent.label) {
    segments.push(intent.label);
  }
  segments.push(resolveContactLabel(taskData, answers));
  if (segments.length === 1 && segments[0] === "Lead") {
    return "Lead formularz";
  }
  return segments.join(" · ");
}
function buildOpportunityKanbanFields(taskData) {
  var answers = parseFormAnswers(taskData);
  var lastContactIso = resolveLastContactIso(taskData);
  var projectType = deriveProjectType(answers);
  var intent = deriveIntent(answers);
  var valueRange = deriveValueRange(answers, taskData);
  var contact = resolveTaskContactFields(taskData);
  var phoneFields = formatPhoneForTwenty(contact.phone);
  var phoneDisplay = contact.phone;
  if (phoneFields && phoneFields.primaryPhoneNumber) {
    phoneDisplay =
      (phoneFields.primaryPhoneCallingCode || "") +
      phoneFields.primaryPhoneNumber;
  }
  var fields = {
    lastContactAt: lastContactIso,
    bizLastContactLabel: buildBizLastContactLabelAtCreate(),
    bizValueDisplay: buildValueDisplay(valueRange, 0),
    amount: buildTwentyCurrency(0),
    bizCardEmail: contact.email || null,
    bizCardPhone: phoneDisplay || null,
  };
  if (projectType && projectType.api) {
    fields.bizProjectType = projectType.api;
  }
  if (intent && intent.api) {
    fields.bizIntent = intent.api;
  }
  if (valueRange && valueRange.min) {
    fields.bizValueMin = buildTwentyCurrency(valueRange.min);
  }
  if (valueRange && valueRange.max) {
    fields.bizValueMax = buildTwentyCurrency(valueRange.max);
  }
  var timeOnPage = formatTimeOnPageDisplay(taskData);
  if (timeOnPage) {
    fields.bizTimeOnPageDisplay = timeOnPage;
  }
  var deviceType = deriveDeviceType(taskData);
  if (deviceType) {
    fields.bizDeviceType = deviceType;
  }
  var contactRole = deriveContactRole(answers);
  if (contactRole) {
    fields.bizContactRole = contactRole;
  }
  var businessModel = deriveBusinessModel(answers);
  if (businessModel) {
    fields.bizBusinessModel = businessModel;
  }
  fields.bizMailingOptIn = deriveMailingOptInInitial(taskData);
  return fields;
}
function twentyRequest(method, path, body, twentyCfg, callback) {
  var url = twentyCfg.restUrl + path;
  sendHttpRequest(
    url,
    {
      method: method,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + twentyCfg.apiKey,
      },
    },
    body ? JSON.stringify(body) : undefined,
  )
    .then(function (res) {
      callback(null, res);
    })
    .catch(function (err) {
      callback(err, null);
    });
}
function parseTwentyListRecords(collection, bodyText) {
  var parsed = JSON.parse(bodyText || "{}");
  var data = parsed.data || {};
  if (data[collection] && data[collection].length) {
    return data[collection];
  }
  return [];
}
function extractCreatedId(collection, bodyText) {
  var parsed = JSON.parse(bodyText || "{}");
  var data = parsed.data || {};
  var createKey = "create" + collection.charAt(0).toUpperCase() + collection.slice(1, -1);
  if (collection === "people") {
    createKey = "createPerson";
  }
  if (collection === "opportunities") {
    createKey = "createOpportunity";
  }
  var record = data[createKey] || data[collection.slice(0, -1)] || data.person || data.opportunity || {};
  return record.id || null;
}
function buildTwentyListPath(collection, filterExpr, limit) {
  var path = "/" + collection + "?filter=" + encodeUriComponent(filterExpr);
  if (limit) {
    path += "&limit=" + limit;
  }
  return path;
}
function normalizeEmail(email) {
  return makeString(email).trim().toLowerCase();
}
function personPrimaryEmail(person) {
  if (!person || !person.emails) {
    return "";
  }
  return normalizeEmail(person.emails.primaryEmail);
}
function findPersonByEmail(email, twentyCfg, callback) {
  if (!email) {
    callback(null, null);
    return;
  }
  var path = buildTwentyListPath("people", "emails.primaryEmail[eq]:" + email, 1);
  twentyRequest("GET", path, null, twentyCfg, function (err, res) {
    if (err || !res || res.statusCode < 200 || res.statusCode >= 300) {
      callback(err || "find person HTTP " + (res && res.statusCode), null);
      return;
    }
    var people = parseTwentyListRecords("people", res.body);
    var person = people.length ? people[0] : null;
    if (person && personPrimaryEmail(person) !== normalizeEmail(email)) {
      person = null;
    }
    callback(null, person);
  });
}
function findOpportunityByIdOid(idOid, twentyCfg, callback) {
  var path = buildTwentyListPath("opportunities", "idOid[eq]:" + idOid, 1);
  twentyRequest("GET", path, null, twentyCfg, function (err, res) {
    if (err || !res || res.statusCode < 200 || res.statusCode >= 300) {
      callback(err || "find opp HTTP " + (res && res.statusCode), null);
      return;
    }
    var opps = parseTwentyListRecords("opportunities", res.body);
    var opp = opps.length ? opps[0] : null;
    if (opp && makeString(opp.idOid).trim() !== makeString(idOid).trim()) {
      opp = null;
    }
    callback(null, opp);
  });
}
function putTaskDocument(taskKey, taskData, callback) {
  var url =
    API_BASE +
    "/" +
    COLLECTION_TASK_QUEUE +
    "/documents/" +
    encodeUriComponent(taskKey);
  sendHttpRequest(
    url,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify(taskData),
  )
    .then(function () {
      callback(null);
    })
    .catch(function (err) {
      callback(err);
    });
}
function stampTaskRunMeta(taskKey, taskData, audit, callback) {
  var updated = JSON.parse(JSON.stringify(taskData));
  updated.create_lead_build_id = audit.buildId;
  updated.create_lead_template_write = audit.templateWrite;
  updated.create_lead_event_write_flag = audit.eventWriteFlag;
  updated.create_lead_write_enabled = audit.writeEnabled;
  updated.create_lead_run_started_at = getTimestampMillis();
  putTaskDocument(taskKey, updated, callback);
}
function writeWorkerHeartbeat(audit, callback) {
  var doc = {
    build_id: audit.buildId,
    template_write: audit.templateWrite,
    event_write_flag: audit.eventWriteFlag,
    write_enabled: audit.writeEnabled,
    at: getTimestampMillis(),
  };
  var url = API_BASE + "/twenty_state/documents/create_lead_worker_heartbeat";
  sendHttpRequest(
    url,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify(doc),
  )
    .then(function () {
      callback(null);
    })
    .catch(function (err) {
      callback(err);
    });
}
function writeRunAuditDoc(taskKey, audit, result, errorMsg, callback) {
  var docKey = "create_lead_audit_" + encodeUriComponent(makeString(taskKey));
  if (docKey.length > 180) {
    docKey = docKey.substring(0, 180);
  }
  var doc = {
    task_key: taskKey,
    build_id: audit.buildId,
    template_write: audit.templateWrite,
    event_write_flag: audit.eventWriteFlag,
    write_enabled: audit.writeEnabled,
    result: makeString(result),
    error: makeString(errorMsg),
    at: getTimestampMillis(),
  };
  var url = API_BASE + "/twenty_state/documents/" + docKey;
  sendHttpRequest(
    url,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify(doc),
  )
    .then(function () {
      callback(null);
    })
    .catch(function (err) {
      callback(err);
    });
}
function patchPersonContactFields(personId, taskData, twentyCfg, callback) {
  var contact = resolveTaskContactFields(taskData);
  var patch = {};
  var phoneFields = formatPhoneForTwenty(contact.phone);
  if (phoneFields) {
    patch.phones = phoneFields;
  }
  if (contact.email) {
    patch.emails = { primaryEmail: contact.email };
  }
  if (!patch.phones && !patch.emails) {
    callback(null);
    return;
  }
  twentyRequest(
    "PATCH",
    "/people/" + encodeUriComponent(personId),
    patch,
    twentyCfg,
    function (err, res) {
      if (err) {
        callback(err);
        return;
      }
      if (!res || res.statusCode < 200 || res.statusCode >= 300) {
        callback(
          "PATCH person contact HTTP " +
            (res && res.statusCode) +
            " " +
            (res && res.body),
        );
        return;
      }
      logToConsole("PATCH person contact", personId);
      callback(null);
    },
  );
}
function finishResolvedPerson(personId, taskData, twentyCfg, callback) {
  patchPersonContactFields(personId, taskData, twentyCfg, function (patchErr) {
    if (patchErr) {
      logToConsole("patch contact warn", patchErr);
    }
    callback(null, personId);
  });
}
function patchPersonIdOid(personId, idOid, twentyCfg, callback) {
  twentyRequest(
    "PATCH",
    "/people/" + encodeUriComponent(personId),
    { idOid: idOid },
    twentyCfg,
    function (err, res) {
      if (err) {
        callback(err);
        return;
      }
      if (!res || res.statusCode < 200 || res.statusCode >= 300) {
        callback(
          "PATCH person idOid HTTP " + (res && res.statusCode) + " " + (res && res.body),
        );
        return;
      }
      logToConsole("PATCH person idOid", personId, idOid);
      callback(null);
    },
  );
}
function setPendingWrite(opportunityId, callback) {
  var docKey = PENDING_WRITE_PREFIX + opportunityId;
  var doc = {
    active: true,
    adapter: ADAPTER_ID,
    expires_at: getTimestampMillis() + PENDING_WRITE_TTL_MS,
  };
  var url = API_BASE + "/twenty_state/documents/" + encodeUriComponent(docKey);
  sendHttpRequest(
    url,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify(doc),
  )
    .then(function () {
      logToConsole("pending-write SET", docKey);
      callback(null);
    })
    .catch(function (err) {
      callback(err);
    });
}
function clearPendingWrite(opportunityId, callback) {
  var docKey = PENDING_WRITE_PREFIX + opportunityId;
  var doc = {
    active: false,
    adapter: ADAPTER_ID,
    cleared_at: getTimestampMillis(),
  };
  var url = API_BASE + "/twenty_state/documents/" + encodeUriComponent(docKey);
  sendHttpRequest(
    url,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify(doc),
  )
    .then(function () {
      logToConsole("pending-write CLEAR", docKey);
      callback(null);
    })
    .catch(function (err) {
      callback(err);
    });
}
function updateTaskFailed(taskKey, taskData, errorMsg, audit, callback) {
  var updated = JSON.parse(JSON.stringify(taskData));
  updated.status = "pending";
  updated.create_lead_last_error = makeString(errorMsg);
  updated.create_lead_last_attempt_at = getTimestampMillis();
  updated.create_lead_build_id = audit.buildId;
  updated.create_lead_template_write = audit.templateWrite;
  updated.create_lead_event_write_flag = audit.eventWriteFlag;
  updated.create_lead_write_enabled = audit.writeEnabled;
  putTaskDocument(taskKey, updated, function (storeErr) {
    if (storeErr) {
      callback(storeErr);
      return;
    }
    writeRunAuditDoc(taskKey, audit, "failed", errorMsg, function () {
      logToConsole("FAIL persisted", taskKey, errorMsg);
      callback(null);
    });
  });
}
function updateTaskDone(taskKey, taskData, result, audit, callback) {
  var updated = JSON.parse(JSON.stringify(taskData));
  updated.status = "done";
  updated.create_lead_result = result;
  updated.create_lead_completed_at = getTimestampMillis();
  updated.create_lead_last_error = "";
  updated.create_lead_build_id = audit.buildId;
  updated.create_lead_template_write = audit.templateWrite;
  updated.create_lead_event_write_flag = audit.eventWriteFlag;
  updated.create_lead_write_enabled = audit.writeEnabled;
  putTaskDocument(taskKey, updated, function (storeErr) {
    if (storeErr) {
      callback(storeErr);
      return;
    }
    writeRunAuditDoc(taskKey, audit, result, "", function () {
      callback(null);
    });
  });
}
function createPersonRecord(taskData, idOid, twentyCfg, callback) {
  var contact = resolveTaskContactFields(taskData);
  var nameParts = splitFullName(contact.name);
  var phoneFields = formatPhoneForTwenty(contact.phone);
  var body = {
    name: nameParts,
    idOid: idOid,
  };
  if (contact.email) {
    body.emails = { primaryEmail: contact.email };
  }
  if (phoneFields) {
    body.phones = phoneFields;
  }
  twentyRequest("POST", "/people", body, twentyCfg, function (err, res) {
    if (err) {
      callback(err, null);
      return;
    }
    logToConsole("POST people status=", res.statusCode);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      callback("POST people HTTP " + res.statusCode + " " + (res.body || ""), null);
      return;
    }
    var personId = extractCreatedId("people", res.body);
    if (!personId) {
      callback("POST people — brak id w odpowiedzi", null);
      return;
    }
    callback(null, personId);
  });
}
function createOpportunityRecord(taskData, idOid, personId, twentyCfg, callback) {
  var answers = parseFormAnswers(taskData);
  var bizProductTwenty = resolveTwentyBizProduct(taskData, answers);
  var kanbanFields = buildOpportunityKanbanFields(taskData);
  var body = {
    name: buildOpportunityName(taskData),
    stage: "NEW",
    idOid: idOid,
    srcSystem: resolveSrcSystem(taskData),
    bizSource: resolveBizSourceForTask(taskData),
    bizProduct: bizProductTwenty,
    ownerId: resolveOpportunityOwnerId(bizProductTwenty, idOid),
    pointOfContactId: personId,
    lastContactAt: kanbanFields.lastContactAt,
    bizLastContactLabel: kanbanFields.bizLastContactLabel,
    bizValueDisplay: kanbanFields.bizValueDisplay,
    amount: kanbanFields.amount,
    bizCardEmail: kanbanFields.bizCardEmail,
    bizCardPhone: kanbanFields.bizCardPhone,
  };
  if (kanbanFields.bizProjectType) {
    body.bizProjectType = kanbanFields.bizProjectType;
  }
  if (kanbanFields.bizIntent) {
    body.bizIntent = kanbanFields.bizIntent;
  }
  if (kanbanFields.bizValueMin) {
    body.bizValueMin = kanbanFields.bizValueMin;
  }
  if (kanbanFields.bizValueMax) {
    body.bizValueMax = kanbanFields.bizValueMax;
  }
  if (kanbanFields.bizTimeOnPageDisplay) {
    body.bizTimeOnPageDisplay = kanbanFields.bizTimeOnPageDisplay;
  }
  if (kanbanFields.bizDeviceType) {
    body.bizDeviceType = kanbanFields.bizDeviceType;
  }
  if (kanbanFields.bizContactRole) {
    body.bizContactRole = kanbanFields.bizContactRole;
  }
  if (kanbanFields.bizBusinessModel) {
    body.bizBusinessModel = kanbanFields.bizBusinessModel;
  }
  if (kanbanFields.bizMailingOptIn) {
    body.bizMailingOptIn = kanbanFields.bizMailingOptIn;
  }
  twentyRequest("POST", "/opportunities", body, twentyCfg, function (err, res) {
    if (err) {
      callback(err, null);
      return;
    }
    logToConsole("POST opportunities status=", res.statusCode);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      callback(
        "POST opportunities HTTP " + res.statusCode + " " + (res.body || ""),
        null,
      );
      return;
    }
    var oppId = extractCreatedId("opportunities", res.body);
    if (!oppId) {
      callback("POST opportunities — brak id w odpowiedzi", null);
      return;
    }
    callback(null, oppId);
  });
}
function resolveExistingPersonId(taskData, idOid, twentyCfg, callback) {
  var existingPersonId = makeString(
    taskData.existing_person_id || taskData.person_id || "",
  ).trim();
  if (!existingPersonId) {
    callback(null, null);
    return;
  }
  twentyRequest(
    "GET",
    "/people/" + encodeUriComponent(existingPersonId),
    null,
    twentyCfg,
    function (err, res) {
      if (err || !res || res.statusCode < 200 || res.statusCode >= 300) {
        callback(err || "GET person HTTP " + (res && res.statusCode), null);
        return;
      }
      var body = JSON.parse(res.body || "{}");
      var person = (body.data && body.data.person) || {};
      if (!person.id) {
        callback("existing person not found", null);
        return;
      }
      var existingOid = makeString(person.idOid || "").trim();
      if (existingOid && existingOid !== idOid) {
        callback(
          "Person idOid conflict existing=" + existingOid + " new=" + idOid,
          null,
        );
        return;
      }
      if (!existingOid) {
        patchPersonIdOid(person.id, idOid, twentyCfg, function (patchErr) {
          if (patchErr) {
            callback(patchErr, null);
            return;
          }
          logToConsole("reuse Person (email sync)", person.id);
          finishResolvedPerson(person.id, taskData, twentyCfg, callback);
        });
        return;
      }
      logToConsole("reuse Person (email sync)", person.id);
      finishResolvedPerson(person.id, taskData, twentyCfg, callback);
    },
  );
}
function resolveOrCreatePerson(taskData, idOid, twentyCfg, callback) {
  resolveExistingPersonId(taskData, idOid, twentyCfg, function (existingErr, existingId) {
    if (existingErr) {
      callback(existingErr, null);
      return;
    }
    if (existingId) {
      finishResolvedPerson(existingId, taskData, twentyCfg, callback);
      return;
    }
    var email = makeString(taskData.biz_email || "").trim();
    findPersonByEmail(email, twentyCfg, function (findErr, existingPerson) {
    if (findErr) {
      callback(findErr, null);
      return;
    }
    if (existingPerson && existingPerson.id) {
      var existingOid = existingPerson.idOid || "";
      if (existingOid && existingOid !== idOid) {
        callback(
          "Person email conflict idOid existing=" + existingOid + " new=" + idOid,
          null,
        );
        return;
      }
      logToConsole("reuse Person", existingPerson.id);
      if (!existingOid) {
        patchPersonIdOid(existingPerson.id, idOid, twentyCfg, function (patchErr) {
          if (patchErr) {
            callback(patchErr, null);
            return;
          }
          finishResolvedPerson(existingPerson.id, taskData, twentyCfg, callback);
        });
        return;
      }
      finishResolvedPerson(existingPerson.id, taskData, twentyCfg, callback);
      return;
    }
    createPersonRecord(taskData, idOid, twentyCfg, callback);
    });
  });
}
function processOneTask(task, twentyCfg, audit, onComplete) {
  var taskData = task.data || {};
  var idOid = makeString(taskData.id_oid || "").trim();
  var writeEnabled = audit.writeEnabled;
  if (!idOid) {
    logToConsole("FAIL — brak id_oid", task.key);
    onComplete("missing id_oid");
    return;
  }
  logToConsole(
    ADAPTER_ID,
    "task",
    task.key,
    "id_oid=",
    idOid,
    "write=",
    writeEnabled,
    "build=",
    audit.buildId,
  );
  stampTaskRunMeta(task.key, taskData, audit, function (stampErr) {
    if (stampErr) {
      logToConsole("stamp meta ERROR", stampErr);
    }
    if (!writeEnabled) {
      logToConsole("log_only payload", JSON.stringify(taskData));
      updateTaskDone(task.key, taskData, "log_only", audit, function (storeErr) {
        onComplete(storeErr);
      });
      return;
    }
    if (!twentyCfg.apiKey) {
      onComplete("missing twenty_api_key");
      return;
    }
    findOpportunityByIdOid(idOid, twentyCfg, function (dupErr, existingOpp) {
      if (dupErr) {
        onComplete(dupErr);
        return;
      }
      if (existingOpp && existingOpp.id) {
        logToConsole("SKIP — Opportunity exists", existingOpp.id);
        updateTaskDone(task.key, taskData, "already_exists", audit, function (storeErr) {
          onComplete(storeErr);
        });
        return;
      }
      resolveOrCreatePerson(taskData, idOid, twentyCfg, function (personErr, personId) {
        if (personErr || !personId) {
          onComplete(personErr || "no personId");
          return;
        }
        createOpportunityRecord(taskData, idOid, personId, twentyCfg, function (oppErr, oppId) {
          if (oppErr || !oppId) {
            onComplete(oppErr || "no oppId");
            return;
          }
          setPendingWrite(oppId, function (pendingErr) {
            if (pendingErr) {
              onComplete(pendingErr);
              return;
            }
            updateTaskDone(
              task.key,
              taskData,
              "created person=" + personId + " opp=" + oppId,
              audit,
              function (storeErr) {
                if (storeErr) {
                  onComplete(storeErr);
                  return;
                }
                clearPendingWrite(oppId, function (clearErr) {
                  if (clearErr) {
                    logToConsole("pending-write CLEAR ERROR", clearErr);
                  }
                  logToConsole("OK", idOid, personId, oppId);
                  onComplete(null);
                });
              },
            );
          });
        });
      });
    });
  });
}
function processTasksSequential(tasks, twentyCfg, audit, index, stats, onAllDone) {
  if (index >= tasks.length || index >= MAX_TASKS_PER_RUN) {
    onAllDone(null, stats);
    return;
  }
  processOneTask(tasks[index], twentyCfg, audit, function (err) {
    if (err) {
      stats.failed = stats.failed + 1;
      updateTaskFailed(tasks[index].key, tasks[index].data || {}, err, audit, function () {
        processTasksSequential(tasks, twentyCfg, audit, index + 1, stats, onAllDone);
      });
      return;
    }
    stats.processed = stats.processed + 1;
    processTasksSequential(tasks, twentyCfg, audit, index + 1, stats, onAllDone);
  });
}
function processCreateLeadQueue(onComplete) {
  var twentyCfg = resolveTwentyConfig();
  var audit = getWriteAudit();
  logToConsole("=== CRM_TWENTY_CREATE_LEAD worker ===", ADAPTER_ID);
  logToConsole("build=", audit.buildId);
  logToConsole("templateWrite=", audit.templateWrite);
  logToConsole("eventWriteFlag=", audit.eventWriteFlag);
  logToConsole("writeEnabled=", audit.writeEnabled);
  writeWorkerHeartbeat(audit, function (hbErr) {
    if (hbErr) {
      logToConsole("heartbeat ERROR", hbErr);
    }
    fetchPendingCreateLeadTasks(function (err, tasks) {
    if (err) {
      logToConsole("fetch ERROR", err);
      onComplete(err);
      return;
    }
    logToConsole("pending create_lead tasks:", tasks.length);
    if (tasks.length === 0) {
      onComplete(null);
      return;
    }
    var stats = { processed: 0, failed: 0 };
    processTasksSequential(tasks, twentyCfg, audit, 0, stats, function (seqErr, finalStats) {
      logToConsole(
        ADAPTER_ID,
        "done processed=",
        finalStats.processed,
        "failed=",
        finalStats.failed,
      );
      onComplete(seqErr);
    });
    });
  });
}
processCreateLeadQueue(function (err) {
  finish(!err);
});
