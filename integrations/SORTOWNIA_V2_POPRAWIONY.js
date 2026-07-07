// SORTOWNIA V2 — Stape (slim: bez komentarzy/DEBUG, limit 200KB). Pełna wersja w git history.
const sendHttpRequest = require("sendHttpRequest");
const JSON = require("JSON");
const generateRandom = require("generateRandom");
const logToConsole = require("logToConsole");
const getTimestampMillis = require("getTimestampMillis");
const makeString = require("makeString");
const getEventData = require("getEventData");
const encodeUriComponent = require("encodeUriComponent");
const setCookie = require("setCookie");
const getCookieValues = require("getCookieValues");

function extractEventParamValue(v) {
  if (!v || typeof v !== "object") return undefined;
  if (v.stringValue !== undefined && v.stringValue !== null)
    return v.stringValue;
  if (v.string_value !== undefined && v.string_value !== null)
    return v.string_value;
  if (v.intValue !== undefined && v.intValue !== null)
    return makeString(v.intValue);
  if (v.int_value !== undefined && v.int_value !== null)
    return makeString(v.int_value);
  if (v.doubleValue !== undefined && v.doubleValue !== null)
    return makeString(v.doubleValue);
  if (v.double_value !== undefined && v.double_value !== null)
    return makeString(v.double_value);
  return undefined;
}

function getEventParamFromEventParams(key) {
  var eventParams = getEventData("event_params");
  if (!eventParams) return undefined;
  if (typeof eventParams === "object" && eventParams[key] !== undefined) {
    var direct = eventParams[key];
    if (direct && typeof direct === "object") {
      return extractEventParamValue(direct);
    }
    return direct;
  }
  if (typeof eventParams.length === "number") {
    var i = 0;
    while (i < eventParams.length) {
      var item = eventParams[i];
      if (item && item.key === key && item.value) {
        return extractEventParamValue(item.value);
      }
      i = i + 1;
    }
  }
  return undefined;
}

function normalizeEmailForEnv(email) {
  if (!email) return "";
  return makeString(email).toLowerCase().trim();
}

function isSandboxTestEmail(email) {
  var normalized = normalizeEmailForEnv(email);
  if (!normalized) return false;
  var suffixes = ["@fastman.eu", "@example.com"];
  var i = 0;
  while (i < suffixes.length) {
    var sfx = suffixes[i];
    if (normalized.indexOf(sfx) === normalized.length - sfx.length) {
      return true;
    }
    i = i + 1;
  }
  return false;
}

function resolveTaskEnvironment(bizEmail) {
  var raw =
    getEventDataWithFallback("environment") ||
    getEventDataWithFallback("runtime_environment");
  if (!raw && data && data.runtimeEnvironment) {
    raw = data.runtimeEnvironment;
  }
  if (raw) {
    var norm = makeString(raw).toLowerCase().trim();
    return norm === "sandbox" ? "sandbox" : "prod";
  }
  if (isSandboxTestEmail(bizEmail)) {
    logToConsole(
      "SORTOWNIA: environment=sandbox (test email domain):",
      bizEmail,
    );
    return "sandbox";
  }
  return "prod";
}

function resolveCtxIpAddress(fallbackFromProfile) {
  var ip =
    getEventDataWithFallback("ctx_ip_address") ||
    getEventDataWithFallback("ip_address") ||
    getEventDataWithFallback("client_ip") ||
    getEventDataWithFallback("ip_override");
  if (!ip && data && data.clientIp) {
    ip = data.clientIp;
  }
  if (!ip && fallbackFromProfile) {
    ip = fallbackFromProfile;
  }
  return ip || null;
}

function getUserDataParam(key) {
  var ud = getEventData("user_data");
  if (!ud || typeof ud !== "object") return undefined;
  var v = ud[key];
  if (v === null || v === undefined) return undefined;
  return v;
}

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
  if (result === null || result === undefined) {
    result = getEventParamFromEventParams(key);
    if (result !== undefined) {
    }
  }
  return result;
}

function getEventDataNonempty(key) {
  var result = getEventDataWithFallback(key);
  if (result === null || result === undefined) return null;
  if (typeof result === "string" && !makeString(result).trim()) return null;
  return result;
}

data.gtmOnSuccess();

function parseUrlParams(url) {
  if (!url) return {};
  const params = {};
  const queryIndex = url.indexOf("?");
  if (queryIndex === -1) return params;

  const queryString = url.substring(queryIndex + 1);
  const pairs = queryString.split("&");

  let i = 0;
  while (i < pairs.length) {
    const pair = pairs[i];
    const equalIndex = pair.indexOf("=");
    if (equalIndex !== -1) {
      const key = pair.substring(0, equalIndex);
      const value = pair.substring(equalIndex + 1);
      params[key] = value;
    }
    i = i + 1;
  }

  return params;
}

function getCharAt(s, idx) {
  if (!s || typeof s !== "string" || idx < 0 || idx >= s.length) return "";
  return s.substring(idx, idx + 1);
}

function normalizeEmail(raw) {
  if (raw === null || raw === undefined) return undefined;

  var str = typeof raw === "string" ? raw : raw + "";
  if (typeof str !== "string") {
    return undefined;
  }

  function trimString(s) {
    if (!s || typeof s !== "string") return "";
    var start = 0;
    var end = s.length;
    while (
      start < end &&
      (getCharAt(s, start) === " " ||
        getCharAt(s, start) === "\t" ||
        getCharAt(s, start) === "\n" ||
        getCharAt(s, start) === "\r")
    ) {
      start = start + 1;
    }
    while (
      end > start &&
      (getCharAt(s, end - 1) === " " ||
        getCharAt(s, end - 1) === "\t" ||
        getCharAt(s, end - 1) === "\n" ||
        getCharAt(s, end - 1) === "\r")
    ) {
      end = end - 1;
    }
    if (start < end) {
      return s.substring(start, end);
    }
    return "";
  }

  var trimmed = trimString(str);
  if (!trimmed || trimmed.length === 0) {
    return undefined;
  }

  var extractFirstEmail = function (s) {
    if (!s || typeof s !== "string") return "";
    var separators = [";", ",", "|"];
    var result = s;
    var i = 0;
    while (i < separators.length) {
      var sepIndex = result.indexOf(separators[i]);
      if (sepIndex !== -1) {
        var afterSep = result.substring(sepIndex + 1);
        afterSep = trimString(afterSep);
        if (afterSep.indexOf("@") !== -1) {
          result = result.substring(0, sepIndex);
        }
      }
      i = i + 1;
    }
    return trimString(result);
  };

  var unwrapEmail = function (s) {
    if (!s || typeof s !== "string") return "";
    var e = trimString(s);
    if (e.length < 7) return e;
    if (e.substring(0, 7).toLowerCase() === "mailto:") {
      e = e.substring(7);
    }
    var ltIndex = e.indexOf("<");
    var gtIndex = e.indexOf(">");
    if (ltIndex !== -1 && gtIndex > ltIndex) {
      e = e.substring(ltIndex + 1, gtIndex);
    }
    return trimString(e);
  };

  var stripTrailingPunctuation = function (s) {
    if (!s || typeof s !== "string") return s;
    var punctuation = ".,;:!?)]}>\"'`";
    var result = s;
    var keepGoing = true;
    while (keepGoing && result.length > 0) {
      var lastChar = getCharAt(result, result.length - 1);
      var foundPunct = false;
      var punctIdx = 0;
      while (punctIdx < punctuation.length && !foundPunct) {
        if (lastChar === getCharAt(punctuation, punctIdx)) {
          foundPunct = true;
        }
        punctIdx = punctIdx + 1;
      }
      if (foundPunct) {
        result = result.substring(0, result.length - 1);
      } else {
        keepGoing = false;
      }
    }
    return result;
  };

  var stripAllWhitespace = function (s) {
    if (s === null || s === undefined) return "";
    if (typeof s !== "string") {
      s = s + "";
    }
    if (typeof s !== "string") return "";
    if (s.length === undefined || s.length === null) return "";
    var result = "";
    var len = s.length;
    var i = 0;
    while (i < len) {
      var ch = getCharAt(s, i);
      var isWhitespace = false;
      if (ch === " ") isWhitespace = true;
      if (ch === "\t") isWhitespace = true;
      if (ch === "\n") isWhitespace = true;
      if (ch === "\r") isWhitespace = true;
      if (!isWhitespace) {
        result = result + ch;
      }
      i = i + 1;
    }
    return result;
  };

  var fixCommas = function (s) {
    if (!s || typeof s !== "string") return "";
    var result = "";
    var i = 0;
    while (i < s.length) {
      var c = getCharAt(s, i);
      result = result + (c === "," ? "." : c);
      i = i + 1;
    }
    return result;
  };

  var compressDoubleDots = function (s) {
    if (!s || typeof s !== "string") return "";
    var result = s;
    while (result.indexOf("..") !== -1) {
      var newResult = "";
      var prevDot = false;
      var i = 0;
      while (i < result.length) {
        var c = getCharAt(result, i);
        if (c === ".") {
          if (!prevDot) newResult = newResult + c;
          prevDot = true;
        } else {
          newResult = newResult + c;
          prevDot = false;
        }
        i = i + 1;
      }
      result = newResult;
    }
    return result;
  };

  var validateDomain = function (domain) {
    if (domain.length < 4) return false;

    var first = getCharAt(domain, 0);
    var last = getCharAt(domain, domain.length - 1);
    if (first === "." || first === "-") return false;
    if (last === "." || last === "-") return false;
    if (domain.indexOf(".") === -1) return false;

    var prevWasDot = false;
    var prevWasDash = false;

    var i = 0;
    while (i < domain.length) {
      var c = getCharAt(domain, i);
      var validChar =
        (c >= "a" && c <= "z") ||
        (c >= "0" && c <= "9") ||
        c === "-" ||
        c === ".";
      if (!validChar) return false;
      if (c === "." && prevWasDot) return false;
      if (c === "." && prevWasDash) return false;
      if (c === "-" && prevWasDot) return false;
      prevWasDot = c === ".";
      prevWasDash = c === "-";
      i = i + 1;
    }

    var lastDotIndex = domain.lastIndexOf(".");
    var tld = domain.substring(lastDotIndex + 1);
    if (tld.length < 2) return false;

    var j = 0;
    while (j < tld.length) {
      var tc = getCharAt(tld, j);
      if (
        !((tc >= "a" && tc <= "z") || (tc >= "0" && tc <= "9") || tc === "-")
      ) {
        return false;
      }
      j = j + 1;
    }

    return true;
  };

  var email = extractFirstEmail(trimmed);
  if (!email || typeof email !== "string" || email.length === 0) {
    return undefined;
  }

  email = unwrapEmail(email);
  if (!email || typeof email !== "string") {
    return undefined;
  }

  email = email.toLowerCase();
  if (typeof email !== "string") {
    return undefined;
  }

  email = stripTrailingPunctuation(email);
  if (typeof email !== "string") return undefined;
  if (email.length === 0) {
    return undefined;
  }

  email = stripAllWhitespace(email);
  if (typeof email !== "string") return undefined;
  if (email.length === 0) {
    return undefined;
  }

  email = fixCommas(email);
  if (typeof email !== "string") return undefined;
  if (email.length === 0) {
    return undefined;
  }

  email = compressDoubleDots(email);
  if (typeof email !== "string") return undefined;
  if (email.length === 0) {
    return undefined;
  }

  if (email.length < 6 || email.length > 254) {
    return undefined;
  }

  var atIndex = email.indexOf("@");
  if (atIndex === -1) return undefined;
  if (email.indexOf("@", atIndex + 1) !== -1) return undefined;

  var localPart = email.substring(0, atIndex);
  var domain = email.substring(atIndex + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    domain = "gmail.com";

    var plusIdx = localPart.indexOf("+");
    if (plusIdx !== -1) {
      localPart = localPart.substring(0, plusIdx);
    }

    var lp2 = "";
    var g = 0;
    while (g < localPart.length) {
      var ch2 = getCharAt(localPart, g);
      if (ch2 !== ".") lp2 = lp2 + ch2;
      g = g + 1;
    }
    localPart = lp2;
    if (localPart.length === 0) {
      return undefined;
    }
  }

  if (localPart.length === 0 || localPart.length > 64) {
    return undefined;
  }
  if (getCharAt(localPart, 0) === ".") {
    return undefined;
  }
  if (getCharAt(localPart, localPart.length - 1) === ".") {
    return undefined;
  }

  var hasAlphaNum = false;
  var k = 0;
  while (k < localPart.length && !hasAlphaNum) {
    var lc = getCharAt(localPart, k);
    if ((lc >= "a" && lc <= "z") || (lc >= "0" && lc <= "9")) {
      hasAlphaNum = true;
    }
    k = k + 1;
  }
  if (!hasAlphaNum) {
    return undefined;
  }

  var domainValid = validateDomain(domain);
  if (!domainValid) {
    return undefined;
  }

  var finalEmail = localPart + "@" + domain;
  return finalEmail;
}

function decodeLoosePercentEncoding(s) {
  var out = makeString(s);
  out = out.split("%253A").join(":");
  out = out.split("%253a").join(":");
  out = out.split("%3A").join(":");
  out = out.split("%3a").join(":");
  out = out.split("%2520").join(" ");
  out = out.split("%20").join(" ");
  out = out.split("<br>").join("\n");
  out = out.split("<BR>").join("\n");
  out = out.split("<br/>").join("\n");
  out = out.split("<BR/>").join("\n");
  return out;
}

function extractDigitsFromFragment(fragment) {
  var digits = "";
  var i = 0;
  while (i < fragment.length) {
    var c = getCharAt(fragment, i);
    if (c >= "0" && c <= "9") {
      digits = digits + c;
    }
    i = i + 1;
  }
  if (digits.length < 7 || digits.length > 15) {
    return undefined;
  }
  return digits;
}

function extractPhoneFromBizMessage(raw) {
  var s = decodeLoosePercentEncoding(raw);
  if (!s) {
    return undefined;
  }
  var lower = s.toLowerCase();
  var marker = "telefon:";
  var idx = lower.indexOf(marker);
  if (idx < 0) {
    idx = lower.indexOf("telefon");
    if (idx < 0) {
      return undefined;
    }
    return extractDigitsFromFragment(s.substring(idx));
  }
  return extractDigitsFromFragment(s.substring(idx + marker.length));
}

function normalizePhone(raw) {
  if (raw === null || raw === undefined) return undefined;

  function trimString(s) {
    if (!s || typeof s !== "string") return "";
    var start = 0;
    var end = s.length;
    while (
      start < end &&
      (getCharAt(s, start) === " " ||
        getCharAt(s, start) === "\t" ||
        getCharAt(s, start) === "\n" ||
        getCharAt(s, start) === "\r")
    ) {
      start = start + 1;
    }
    while (
      end > start &&
      (getCharAt(s, end - 1) === " " ||
        getCharAt(s, end - 1) === "\t" ||
        getCharAt(s, end - 1) === "\n" ||
        getCharAt(s, end - 1) === "\r")
    ) {
      end = end - 1;
    }
    if (start < end) {
      return s.substring(start, end);
    }
    return "";
  }

  var DEFAULT_COUNTRY_CODE = "48";

  var str;
  if (typeof raw === "string") {
    str = trimString(raw);
  } else if (typeof raw === "number") {
    if (raw !== raw || raw <= 0 || raw % 1 !== 0) return undefined;
    if (raw > 9007199254740991) return undefined;
    str = raw + "";
    if (str.indexOf("e") !== -1 || str.indexOf("E") !== -1) return undefined;
  } else {
    return undefined;
  }

  if (str.length === 0) return undefined;

  var stripExtension = function (ph) {
    var p = ph.toLowerCase();
    var markers = ["wew.", "wew ", "ext.", "ext ", " x ", " x", "#"];
    var m = 0;
    while (m < markers.length) {
      var idx = p.indexOf(markers[m]);
      if (idx !== -1) {
        return trimString(ph.substring(0, idx));
      }
      m = m + 1;
    }
    return ph;
  };

  var extractFirstPhone = function (s) {
    var separators = ["/", ";", "|"];
    var result = s;
    var i = 0;
    while (i < separators.length) {
      var sepIndex = result.indexOf(separators[i]);
      if (sepIndex !== -1) {
        result = result.substring(0, sepIndex);
      }
      i = i + 1;
    }
    return trimString(result);
  };

  var phone = extractFirstPhone(str);
  phone = stripExtension(phone);

  var hadPlusPrefix = getCharAt(phone, 0) === "+";
  var hadDoubleZeroPrefix =
    phone.length >= 2 &&
    getCharAt(phone, 0) === "0" &&
    getCharAt(phone, 1) === "0";

  var digits = "";
  var i = 0;
  while (i < phone.length) {
    var c = getCharAt(phone, i);
    if (c >= "0" && c <= "9") {
      digits = digits + c;
    }
    i = i + 1;
  }

  if (digits.length === 0) return undefined;

  if (hadPlusPrefix) {
    if (digits.length >= 7 && digits.length <= 15) {
      return "+" + digits;
    }
  }

  if (hadDoubleZeroPrefix) {
    var digitsWithout00 = digits.substring(2);
    if (digitsWithout00.length >= 7 && digitsWithout00.length <= 15) {
      return "+" + digitsWithout00;
    }
  }

  if (digits.length === 9) {
    return "+" + DEFAULT_COUNTRY_CODE + digits;
  }

  if (digits.length === 10 && getCharAt(digits, 0) === "0") {
    return "+" + DEFAULT_COUNTRY_CODE + digits.substring(1);
  }

  if (
    digits.substring(0, 2) === "48" &&
    digits.length >= 10 &&
    digits.length <= 12
  ) {
    return "+" + digits;
  }

  if (
    digits.length >= 10 &&
    digits.length <= 15 &&
    getCharAt(digits, 0) !== "0"
  ) {
    return "+" + digits;
  }

  return undefined;
}

function normalizeSsoEventName(name) {
  if (!name) return name;
  if (name === "lead_won" || name === "closed_won") return "purchase";
  if (name === "lead_rejected") return "rejected_lead";
  return name;
}

const eventName = normalizeSsoEventName(
  getEventDataWithFallback("event_name") ||
    getEventDataWithFallback("event") ||
    "generate_lead",
);

logToConsole("=== SORTOWNIA V2 START === event_name =", eventName);

const BASE_URL = "https://uinpcbwf.eug.stape.io";
const API_KEY = "2d389d8d0875343a76c07c6ff388c586bbd9347duinpcbwf";
const API_BASE = BASE_URL + "/stape-api/" + API_KEY + "/v2/store/collections";

function generateULID() {
  const chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const charsArray = chars.split("");
  let result = "";
  let i = 0;
  while (i < 26) {
    const randomIndex = generateRandom(0, 31);
    result = result + charsArray[randomIndex];
    i = i + 1;
  }
  return result;
}

function getFirstCookie(name) {
  const vals = getCookieValues(name);
  return vals && vals.length ? vals[0] : null;
}

function extractGaClientIdFromGaCookie() {
  const gaRaw = getFirstCookie("_ga");
  if (!gaRaw) return null;
  var parts = makeString(gaRaw).split(".");
  if (parts.length >= 4) {
    var p2 = parts[2];
    var p3 = parts[3];
    if (p2 && p3) return p2 + "." + p3;
  }
  return null;
}

if (eventName === "oid_init") {
  logToConsole("=== OID_INIT START ===");

  const gaClientId =
    getEventDataWithFallback("ga_client_id") ||
    extractGaClientIdFromGaCookie() ||
    getEventDataWithFallback("client_id") ||
    getEventDataWithFallback("cid");
  const attrFbp = getEventDataWithFallback("attr_fbp");
  const ctxPageUrl =
    getEventDataWithFallback("ctx_page_url") ||
    getEventDataWithFallback("page_location");
  const ctxUserAgent =
    getEventDataWithFallback("ctx_user_agent") ||
    getEventDataWithFallback("user_agent");
  const ctxReferrer =
    getEventDataWithFallback("ctx_referrer") ||
    getEventDataWithFallback("page_referrer") ||
    getEventDataWithFallback("referrer");

  const urlParams = parseUrlParams(ctxPageUrl);
  const attrGclid =
    getEventDataWithFallback("attr_gclid") ||
    getEventDataWithFallback("gclid") ||
    urlParams.gclid ||
    "";
  const attrGbraid =
    getEventDataWithFallback("attr_gbraid") || urlParams.gbraid || "";
  const attrWbraid =
    getEventDataWithFallback("attr_wbraid") || urlParams.wbraid || "";
  const attrFbc =
    getEventDataWithFallback("attr_fbc") || urlParams.fbclid || "";
  const attrUtmSource = getEventDataWithFallback("attr_utm_source");
  const attrUtmMedium = getEventDataWithFallback("attr_utm_medium");
  const attrUtmCampaign = getEventDataWithFallback("attr_utm_campaign");

  logToConsole("OID_INIT: ctx_page_url =", ctxPageUrl);
  logToConsole("OID_INIT: attr_gclid (z Event Data lub URL) =", attrGclid);
  logToConsole("OID_INIT: attr_fbc (z Event Data lub URL) =", attrFbc);

  logToConsole("OID_INIT: ga_client_id =", gaClientId);
  logToConsole("OID_INIT: attr_gclid =", attrGclid);

  if (!gaClientId) {
    logToConsole("OID_INIT: ❌ Brak ga_client_id - SKIP");
    return;
  }

  if (!attrGclid && !attrFbc && !attrGbraid && !attrWbraid) {
    logToConsole("OID_INIT: ❌ Brak click-ID - SKIP");
    return;
  }

  const timestamp = makeString(getTimestampMillis());
  const encodedGaClientId = encodeUriComponent(gaClientId);
  const lookupUrl = API_BASE + "/identity_map/documents/" + encodedGaClientId;

  sendHttpRequest(lookupUrl, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })
    .then(function (lookupResponse) {
      let idOid;
      let existingData = {};

      if (lookupResponse.statusCode === 200) {
        const profileBody = JSON.parse(lookupResponse.body);
        existingData =
          profileBody.data && profileBody.data.data
            ? profileBody.data.data
            : {};
        idOid = existingData.id_oid || generateULID();
        logToConsole("OID_INIT: ✅ Update profilu, id_oid =", idOid);
      } else {
        idOid = generateULID();
        logToConsole("OID_INIT: ✨ Nowy profil, id_oid =", idOid);
      }

      const updatedData = {
        id_oid: idOid,
        ga_client_id: gaClientId,
        attr_gclid: attrGclid || existingData.attr_gclid,
        attr_fbc: attrFbc || existingData.attr_fbc,
        attr_fbp: attrFbp || existingData.attr_fbp,
        attr_gbraid: attrGbraid || existingData.attr_gbraid,
        attr_wbraid: attrWbraid || existingData.attr_wbraid,
        attr_utm_source: attrUtmSource || existingData.attr_utm_source,
        attr_utm_medium: attrUtmMedium || existingData.attr_utm_medium,
        attr_utm_campaign: attrUtmCampaign || existingData.attr_utm_campaign,
        oid_init_page_url: ctxPageUrl,
        ctx_user_agent: ctxUserAgent || existingData.ctx_user_agent || null, // ✅ DODANO: dla Meta CAPI EMQ
        ctx_ip_address:
          resolveCtxIpAddress(existingData.ctx_ip_address) || null,
        ctx_referrer: ctxReferrer || existingData.ctx_referrer || null, // ✅ DODANO: dla analizy
        oid_init_timestamp: timestamp,
        updated_at: timestamp,
      };

      if (existingData.biz_email)
        updatedData.biz_email = existingData.biz_email;
      if (existingData.biz_phone)
        updatedData.biz_phone = existingData.biz_phone;
      if (existingData.biz_name) updatedData.biz_name = existingData.biz_name;
      if (existingData.owner) updatedData.owner = existingData.owner;
      if (existingData.assist !== undefined)
        updatedData.assist = existingData.assist;
      if (existingData.order_id) updatedData.order_id = existingData.order_id;
      if (existingData.AktTimestamp)
        updatedData.AktTimestamp = existingData.AktTimestamp;

      logToConsole("OID_INIT: Zapisuję...");

      const saveUrl = API_BASE + "/identity_map/documents/" + encodedGaClientId;
      sendHttpRequest(
        saveUrl,
        { method: "PUT", headers: { "Content-Type": "application/json" } },
        JSON.stringify(updatedData),
      )
        .then(function () {
          logToConsole("OID_INIT: ✅ Zapisano - gclid zachowany!");

          setCookie("_oid", idOid, {
            "max-age": 7776000, // 90 dni w sekundach (90 * 24 * 60 * 60)
            path: "/",
            secure: true,
            httponly: true, // UWAGA: małe litery 'httponly', nie 'httpOnly'!
            samesite: "Lax", // UWAGA: małe litery 'samesite', nie 'sameSite'!
          });

          logToConsole("OID_INIT: ✅ Cookie _oid ustawione:", idOid);
          logToConsole("=== OID_INIT SUKCES ===");
        })
        .catch(function (err) {
          logToConsole("OID_INIT: ❌ Błąd:", err);
        });
    })
    .catch(function (lookupError) {
      logToConsole("OID_INIT: Lookup error - tworzę nowy");

      const fallbackIdOid = generateULID();
      const fallbackData = {
        id_oid: fallbackIdOid,
        ga_client_id: gaClientId,
        attr_gclid: attrGclid,
        attr_fbc: attrFbc,
        attr_fbp: attrFbp,
        attr_gbraid: attrGbraid,
        attr_wbraid: attrWbraid,
        oid_init_page_url: ctxPageUrl,
        ctx_user_agent: ctxUserAgent || null, // ✅ DODANO: dla Meta CAPI EMQ
        ctx_referrer: ctxReferrer || null, // ✅ DODANO: dla analizy
        oid_init_timestamp: timestamp,
        updated_at: timestamp,
      };

      const fallbackUrl =
        API_BASE + "/identity_map/documents/" + encodedGaClientId;
      sendHttpRequest(
        fallbackUrl,
        { method: "PUT", headers: { "Content-Type": "application/json" } },
        JSON.stringify(fallbackData),
      ).then(function () {
        logToConsole("OID_INIT: ✅ Fallback - nowy profil");

        setCookie("_oid", fallbackIdOid, {
          "max-age": 7776000, // 90 dni w sekundach (90 * 24 * 60 * 60)
          path: "/",
          secure: true,
          httponly: true, // UWAGA: małe litery 'httponly', nie 'httpOnly'!
          samesite: "Lax", // UWAGA: małe litery 'samesite', nie 'sameSite'!
        });

        logToConsole(
          "OID_INIT: ✅ Cookie _oid ustawione (fallback):",
          fallbackIdOid,
        );
        logToConsole("=== OID_INIT SUKCES ===");
      });
    });

  return; // oid_init kończy się tutaj!
}

function getProfileByKey(key, cbOk, cbFail) {
  const encoded = encodeUriComponent(key);
  const url = API_BASE + "/identity_map/documents/" + encoded;

  sendHttpRequest(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })
    .then(function (res) {
      if (res.statusCode === 200) cbOk(res);
      else cbFail(res);
    })
    .catch(function (err) {
      cbFail({ statusCode: 0, error: err });
    });
}

logToConsole("=== SORTOWNIA + AKT START ===");

const rawEmail =
  getEventDataWithFallback("biz_email") ||
  getEventDataWithFallback("email") ||
  getUserDataParam("email") ||
  getUserDataParam("email_address");
var earlyBizMessage =
  getEventDataWithFallback("biz_message") ||
  getEventDataWithFallback("message") ||
  null;
function pickPhoneFromAnswers(obj) {
  if (!obj || typeof obj !== "object") {
    return null;
  }
  var keys = ["phone", "tel", "telefon", "phone_number", "mobile", "numer_telefonu"];
  var i = 0;
  while (i < keys.length) {
    var v = obj[keys[i]];
    if (v !== null && v !== undefined && makeString(v).trim()) {
      return makeString(v).trim();
    }
    i = i + 1;
  }
  return null;
}

function parseAnswersContactObject(raw) {
  if (!raw) {
    return null;
  }
  if (typeof raw === "object") {
    return raw;
  }
  var s = makeString(raw).trim();
  if (s.length < 2) {
    return null;
  }
  if (s.charAt(0) === '"') {
    s = JSON.parse(s);
  }
  if (typeof s === "string" && s.charAt(0) === "{") {
    var parsed = JSON.parse(s);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  }
  if (typeof s === "object" && s) {
    return s;
  }
  return null;
}

var answersForContact =
  getEventDataWithFallback("answers") ||
  getEventDataWithFallback("biz_form_answers") ||
  null;
var answersContactObj = parseAnswersContactObject(answersForContact);
var phoneFromAnswers = pickPhoneFromAnswers(answersContactObj);
const rawPhone =
  getEventDataNonempty("biz_phone") ||
  getEventDataNonempty("phone") ||
  getEventDataNonempty("telefon") ||
  getEventDataNonempty("tel") ||
  getEventDataNonempty("phone_number") ||
  getUserDataParam("phone_number") ||
  getUserDataParam("phone") ||
  phoneFromAnswers ||
  extractPhoneFromBizMessage(earlyBizMessage);

logToConsole("SORTOWNIA: rawEmail (przed normalizeEmail) =", rawEmail);
logToConsole("SORTOWNIA: rawPhone (przed normalizePhone) =", rawPhone);

const email = normalizeEmail(rawEmail);
logToConsole("SORTOWNIA: email (po normalizeEmail) =", email);
var phone = normalizePhone(rawPhone);
logToConsole("SORTOWNIA: phone (po normalizePhone) =", phone);
if (phone && !getEventDataWithFallback("biz_phone") && earlyBizMessage) {
  logToConsole(
    "SORTOWNIA: phone wyciągnięty z biz_message (brak ep.biz_phone w evencie)",
    phone,
  );
}

const name =
  getEventDataWithFallback("biz_name") ||
  getEventDataWithFallback("name") ||
  getUserDataParam("first_name") ||
  (answersForContact && typeof answersForContact === "object"
    ? answersForContact.name
    : null);
const gaClientId =
  getEventDataWithFallback("ga_client_id") ||
  extractGaClientIdFromGaCookie() ||
  getEventDataWithFallback("client_id") ||
  getEventDataWithFallback("cid");
const rawBizProduct =
  getEventDataWithFallback("biz_product") ||
  getEventDataWithFallback("form_type");
const rawBizPricingKey = getEventDataWithFallback("biz_pricing_key");
function pricingKeyToProduct(pricingKey) {
  if (!pricingKey) return null;
  if (pricingKey.indexOf("lead_") === 0) return pricingKey.slice(5);
  if (pricingKey.indexOf("sql_") === 0) return pricingKey.slice(4);
  if (pricingKey.indexOf("rejected_") === 0) return pricingKey.slice(9);
  if (pricingKey.indexOf("won_") === 0) return pricingKey.slice(4);
  return pricingKey;
}

function normalizeBizProductSlug(product) {
  if (!product) return null;
  var s = makeString(product).toLowerCase().trim();
  if (s === "strona") return "strony";
  if (s === "kontakt" || s === "main") return null;
  return s;
}

function inferBizProductFromUrl(url) {
  if (!url) return null;
  var u = makeString(url).toLowerCase();
  if (u.indexOf("projektowanie-logo") >= 0 || u.indexOf("/logo") >= 0)
    return "logo";
  if (
    u.indexOf("tworzenie-stron") >= 0 ||
    u.indexOf("strony.owocni") >= 0 ||
    u.indexOf("/strony") >= 0
  )
    return "strony";
  if (u.indexOf("nazwa") >= 0 || u.indexOf("naming") >= 0) return "nazwa";
  if (u.indexOf("strategia") >= 0) return "strategia";
  if (u.indexOf("konsultacje") >= 0) return "konsultacje";
  if (u.indexOf("copywriting") >= 0) return "copywriting";
  if (u.indexOf("/cennik") >= 0) return null;
  return null;
}

var bizProduct =
  normalizeBizProductSlug(rawBizProduct) ||
  pricingKeyToProduct(rawBizPricingKey);
const bizValue = getEventDataWithFallback("biz_value"); // Rzeczywista wartość dla purchase
const ctxPageUrl =
  getEventDataWithFallback("ctx_page_url") ||
  getEventDataWithFallback("page_location");
const ctxLandingPageUrl =
  getEventDataWithFallback("ctx_landing_page_url") || ctxPageUrl;
if (!bizProduct || rawBizProduct === "kontakt" || rawBizProduct === "main") {
  bizProduct =
    inferBizProductFromUrl(ctxLandingPageUrl) ||
    inferBizProductFromUrl(ctxPageUrl) ||
    normalizeBizProductSlug(rawBizProduct) ||
    bizProduct;
}
const bizPricingKey = rawBizPricingKey || bizProduct; // Klucz cennika (np. sql_strony)
const ctxUserAgent =
  getEventDataWithFallback("ctx_user_agent") ||
  getEventDataWithFallback("user_agent");
var ctxIpAddress = resolveCtxIpAddress(null);
const ctxReferrer =
  getEventDataWithFallback("ctx_referrer") ||
  getEventDataWithFallback("page_referrer") ||
  getEventDataWithFallback("referrer");
const srcSystem = getEventDataWithFallback("src_system") || "web";
const timeOccurredIso = getEventDataWithFallback("time_occurred_iso_utc");
var ctxTimeOnPageMs =
  getEventDataWithFallback("ctx_time_on_page_ms") ||
  getEventDataWithFallback("time_on_page_ms") ||
  getEventDataWithFallback("time_on_page") ||
  null;
var bizMessage =
  earlyBizMessage || getEventDataWithFallback("description") || null;

var rawFormAnswers =
  getEventDataWithFallback("answers") ||
  getEventDataWithFallback("biz_form_answers") ||
  null;
var bizFormAnswers = null;
if (rawFormAnswers) {
  if (typeof rawFormAnswers === "object") {
    bizFormAnswers = JSON.stringify(rawFormAnswers);
  } else {
    bizFormAnswers = makeString(rawFormAnswers);
  }
}
var bizFormProduct =
  getEventDataWithFallback("product") ||
  getEventDataWithFallback("biz_form_product") ||
  null;

if (!phone) {
  var phoneFromFormAnswers = pickPhoneFromAnswers(
    parseAnswersContactObject(rawFormAnswers),
  );
  if (!phoneFromFormAnswers && bizFormAnswers) {
    phoneFromFormAnswers = pickPhoneFromAnswers(
      parseAnswersContactObject(bizFormAnswers),
    );
  }
  if (!phoneFromFormAnswers && bizMessage) {
    phoneFromFormAnswers = extractPhoneFromBizMessage(bizMessage);
  }
  if (phoneFromFormAnswers) {
    phone = normalizePhone(phoneFromFormAnswers);
    logToConsole(
      "SORTOWNIA: phone fallback z answers/biz_form_answers/message =",
      phone,
    );
  }
}

const urlParams = parseUrlParams(ctxPageUrl);
const landingUrlParams = parseUrlParams(ctxLandingPageUrl);
const attrGclid =
  getEventDataWithFallback("attr_gclid") ||
  getEventDataWithFallback("gclid") ||
  urlParams.gclid ||
  landingUrlParams.gclid ||
  "";
const attrGbraid =
  getEventDataWithFallback("attr_gbraid") ||
  urlParams.gbraid ||
  landingUrlParams.gbraid ||
  "";
const attrWbraid =
  getEventDataWithFallback("attr_wbraid") ||
  urlParams.wbraid ||
  landingUrlParams.wbraid ||
  "";
const attrFbc =
  getEventDataWithFallback("attr_fbc") ||
  urlParams.fbclid ||
  landingUrlParams.fbclid ||
  "";
const attrUtmSource = (
  getEventDataWithFallback("attr_utm_source") ||
  urlParams.utm_source ||
  landingUrlParams.utm_source ||
  ""
).toLowerCase();

logToConsole("SORTOWNIA: ctx_page_url =", ctxPageUrl);
logToConsole("SORTOWNIA: ctx_landing_page_url =", ctxLandingPageUrl);
logToConsole("SORTOWNIA: ctx_user_agent =", ctxUserAgent);
logToConsole("SORTOWNIA: ctx_ip_address =", ctxIpAddress);
logToConsole("SORTOWNIA: attr_gclid (z Event Data lub URL) =", attrGclid);
logToConsole("SORTOWNIA: attr_fbc (z Event Data lub URL) =", attrFbc);
logToConsole("SORTOWNIA: attr_gbraid (z Event Data lub URL) =", attrGbraid);
logToConsole("SORTOWNIA: attr_wbraid (z Event Data lub URL) =", attrWbraid);
logToConsole(
  "SORTOWNIA: attr_utm_source (z Event Data lub URL) =",
  attrUtmSource || "(brak)",
);

function computeOwnerFromCurrentEvent(
  gclid,
  fbc,
  gbraid,
  wbraid,
  src,
  utmSource,
) {
  if (src === "meta_instant_form") return "platform:meta_ads";
  if (gclid) return "platform:google_ads";
  if (gbraid || wbraid) return "platform:google_ads";
  if (fbc) return "platform:meta_ads";
  if (utmSource) {
    if (
      utmSource.indexOf("meta") !== -1 ||
      utmSource.indexOf("facebook") !== -1 ||
      utmSource.indexOf("fb") !== -1
    )
      return "platform:meta_ads";
    if (utmSource.indexOf("google") !== -1 || utmSource.indexOf("cpc") !== -1)
      return "platform:google_ads";
  }
  return "platform:none";
}

logToConsole("SORTOWNIA: email =", email);
logToConsole("SORTOWNIA: phone =", phone);
logToConsole("SORTOWNIA: ga_client_id =", gaClientId);

const timestamp = makeString(getTimestampMillis());

const oidCookie = getFirstCookie("_oid");
logToConsole("SORTOWNIA: _oid cookie =", oidCookie);

const resolveKeys = [];
if (oidCookie) resolveKeys.push(oidCookie);
if (email) resolveKeys.push(email);
if (phone) resolveKeys.push(phone);
if (gaClientId) resolveKeys.push(gaClientId);

if (resolveKeys.length === 0) {
  logToConsole(
    "SORTOWNIA ERROR: Brak kluczy resolve (_oid/email/phone/ga_client_id) - SKIP",
  );
  return;
}

function resolveProfile(keys, idx) {
  if (idx >= keys.length) {
    logToConsole("SORTOWNIA: Wszystkie klucze 404 - nowy profil");
    processNewProfile();
    return;
  }

  const key = keys[idx];
  logToConsole(
    "SORTOWNIA: Resolve lookup key =",
    key,
    "(" + (idx + 1) + "/" + keys.length + ")",
  );

  getProfileByKey(
    key,
    function (res) {
      var resolveKeyType = "unknown";
      if (key === oidCookie) resolveKeyType = "_oid";
      else if (key === email) resolveKeyType = "email";
      else if (key === phone) resolveKeyType = "phone";
      else if (key === gaClientId) resolveKeyType = "ga_client_id";

      logToConsole(
        "SORTOWNIA: ✅ Found profile by key =",
        key,
        "(typ:",
        resolveKeyType + ")",
      );
      processExistingProfile(res);
    },
    function () {
      resolveProfile(keys, idx + 1);
    },
  );
}

resolveProfile(resolveKeys, 0);

function processExistingProfile(lookupResponse) {
  const profileBody = JSON.parse(lookupResponse.body);
  const existing =
    profileBody.data && profileBody.data.data ? profileBody.data.data : {};

  const idOid = existing.id_oid || generateULID();

  var hasNewEmail = email && !existing.biz_email;
  var hasNewPhone = phone && !existing.biz_phone;
  var hasNewGaClientId = gaClientId && !existing.ga_client_id;

  if (hasNewEmail || hasNewPhone || hasNewGaClientId) {
    var newKeysList = [];
    if (hasNewEmail) newKeysList.push("email");
    if (hasNewPhone) newKeysList.push("phone");
    if (hasNewGaClientId) newKeysList.push("ga_client_id");
    logToConsole(
      "SORTOWNIA: ⭐ Nowe klucze w evencie (pierwszy raz):",
      newKeysList,
    );
    logToConsole(
      "SORTOWNIA: ⚠️ Multi-key write będzie zapisać profil pod nowymi kluczami:",
      newKeysList,
    );
  }

  let owner = existing.owner || "platform:none";
  var taskOwner = owner; // domyślnie = owner; przy SKIP nadpisane na "last click"
  let assist = existing.assist || null;
  let orderId = existing.order_id;
  let aktTimestamp = existing.AktTimestamp;
  const existingGclid = existing.attr_gclid;
  const existingFbc = existing.attr_fbc;

  logToConsole("SORTOWNIA: id_oid =", idOid);
  logToConsole("SORTOWNIA: owner =", owner, ", order_id =", orderId);
  logToConsole("SORTOWNIA: gclid z profilu =", existingGclid);

  let aktTimestampMs = null;
  var enqueueTwentyCreateLead = false;
  if (eventName === "generate_lead") {
    const nowMs = timestamp * 1;

    if (existing.AktTimestampMs) {
      aktTimestampMs = existing.AktTimestampMs * 1;
    } else if (existing.AktTimestamp) {
      var parsedMs;
      if (
        existing.AktTimestamp.endsWith &&
        existing.AktTimestamp.endsWith("_iso")
      ) {
        var timestampPart = existing.AktTimestamp.replace("_iso", "");
        parsedMs = timestampPart * 1;
      } else {
        var isoStr = existing.AktTimestamp;
        parsedMs = isoStr * 1;
        if (parsedMs !== parsedMs) {
          parsedMs = nowMs;
        }
      }
      aktTimestampMs = parsedMs;
    }

    if (aktTimestampMs !== null) {
      const ageDays = (nowMs - aktTimestampMs) / 86400000; // 86400000 ms = 1 dzień

      if (ageDays < 90 && ageDays === ageDays) {
        var daysRounded = (ageDays + 0.5) | 0;
        logToConsole(
          "SORTOWNIA: ⏭️ SKIP - Akt istnieje i jest młodszy niż 90 dni (",
          daysRounded,
          " dni, AktTimestampMs =",
          aktTimestampMs,
          ")",
        );
        orderId = existing.order_id || orderId;
        aktTimestamp = existing.AktTimestamp;
        aktTimestampMs = existing.AktTimestampMs || aktTimestampMs;
        owner = existing.owner || owner;
        assist = existing.assist !== undefined ? existing.assist : assist;
        var mergedGclid = attrGclid || existingGclid;
        var mergedFbc = attrFbc || existingFbc;
        var taskOwner = computeOwnerFromCurrentEvent(
          mergedGclid,
          mergedFbc,
          attrGbraid,
          attrWbraid,
          srcSystem,
          attrUtmSource,
        );
        if (taskOwner !== owner) {
          logToConsole(
            "SORTOWNIA: Task owner =",
            taskOwner,
            ", profil owner (first touch) =",
            owner,
          );
        }
        enqueueTwentyCreateLead = false;
      } else {
        var daysRounded = (ageDays + 0.5) | 0;
        logToConsole(
          "SORTOWNIA: ✅ Akt jest starszy niż 90 dni (",
          daysRounded,
          " dni, AktTimestampMs =",
          aktTimestampMs,
          ") - tworzę nowy",
        );
        var finalGclid = attrGclid || existingGclid;
        var finalFbc = attrFbc || existingFbc;
        owner = computeOwnerFromCurrentEvent(
          finalGclid,
          finalFbc,
          attrGbraid,
          attrWbraid,
          srcSystem,
          attrUtmSource,
        );
        if (owner === "platform:google_ads" && finalGclid)
          logToConsole("SORTOWNIA: Owner = Google (gclid:", finalGclid, ")");
        taskOwner = owner;

        assist = null;
        orderId = timestamp + "_generate_lead";
        aktTimestamp = timeOccurredIso || timestamp + "_iso";
        aktTimestampMs = nowMs;
        logToConsole(
          "SORTOWNIA: ✅ Akt: owner =",
          owner,
          ", AktTimestampMs =",
          aktTimestampMs,
        );
        enqueueTwentyCreateLead = true;
      }
    } else {
      logToConsole("SORTOWNIA: ✨ Brak Akt - tworzę nowy");
      var finalGclid = attrGclid || existingGclid;
      var finalFbc = attrFbc || existingFbc;
      owner = computeOwnerFromCurrentEvent(
        finalGclid,
        finalFbc,
        attrGbraid,
        attrWbraid,
        srcSystem,
        attrUtmSource,
      );
      if (owner === "platform:google_ads" && finalGclid)
        logToConsole("SORTOWNIA: Owner = Google (gclid:", finalGclid, ")");
      taskOwner = owner;

      assist = null;
      orderId = timestamp + "_generate_lead";
      aktTimestamp = timeOccurredIso || timestamp + "_iso";
      aktTimestampMs = nowMs;
      logToConsole(
        "SORTOWNIA: ✅ Akt: owner =",
        owner,
        ", AktTimestampMs =",
        aktTimestampMs,
      );
      enqueueTwentyCreateLead = true;
    }
  } else {
    aktTimestampMs = existing.AktTimestampMs || null;
  }

  if (eventName === "generate_lead" && email) {
    enqueueTwentyCreateLead = true;
    logToConsole(
      "SORTOWNIA: crm:twenty_create_lead enabled (generate_lead + email)",
    );
  }

  saveProfileAndTask(
    idOid,
    owner,
    taskOwner,
    assist,
    orderId,
    aktTimestamp,
    aktTimestampMs,
    existingGclid,
    existingFbc,
    existing.ga_client_id || null,
    existing.biz_product || null,
    existing.ctx_ip_address || null,
    enqueueTwentyCreateLead,
  );
}

function processMergedProfile(oidInitResponse) {
  const oidInitBody = JSON.parse(oidInitResponse.body);
  const oidInitData =
    oidInitBody.data && oidInitBody.data.data ? oidInitBody.data.data : {};

  const idOid = oidInitData.id_oid || generateULID();
  const existingGclid = oidInitData.attr_gclid;
  const existingFbc = oidInitData.attr_fbc;

  logToConsole("SORTOWNIA: ✨ Merge z oid_init - id_oid =", idOid);

  var hasNewEmail = email && !oidInitData.biz_email;
  var hasNewPhone = phone && !oidInitData.biz_phone;
  var hasNewGaClientId = gaClientId && !oidInitData.ga_client_id;

  if (hasNewEmail || hasNewPhone || hasNewGaClientId) {
    var newKeysList = [];
    if (hasNewEmail) newKeysList.push("email");
    if (hasNewPhone) newKeysList.push("phone");
    if (hasNewGaClientId) newKeysList.push("ga_client_id");
    logToConsole(
      "SORTOWNIA: ⭐ Merge z oid_init - nowe klucze w evencie:",
      newKeysList,
    );
  }

  logToConsole("SORTOWNIA: gclid z oid_init =", existingGclid);

  let owner = "platform:none";
  let assist = null;
  let orderId;
  let aktTimestamp;
  let aktTimestampMs = null;

  var enqueueTwentyCreateLead = false;
  if (eventName === "generate_lead") {
    logToConsole("SORTOWNIA: Obliczam Akt Własności (merge oid_init)...");

    const finalGclid = attrGclid || existingGclid;
    const finalFbc = attrFbc || existingFbc;
    owner = computeOwnerFromCurrentEvent(
      finalGclid,
      finalFbc,
      attrGbraid,
      attrWbraid,
      srcSystem,
      attrUtmSource,
    );
    if (owner === "platform:google_ads" && finalGclid)
      logToConsole(
        "SORTOWNIA: Owner = Google (gclid z oid_init:",
        finalGclid,
        ")",
      );

    assist = null;
    orderId = timestamp + "_generate_lead";
    aktTimestamp = timeOccurredIso || timestamp + "_iso";
    aktTimestampMs = timestamp * 1;

    logToConsole(
      "SORTOWNIA: ✅ Akt: owner =",
      owner,
      ", AktTimestampMs =",
      aktTimestampMs,
    );
    enqueueTwentyCreateLead = true;
  }

  saveProfileAndTask(
    idOid,
    owner,
    owner,
    assist,
    orderId,
    aktTimestamp,
    aktTimestampMs,
    existingGclid,
    existingFbc,
    oidInitData.ga_client_id || null,
    oidInitData.biz_product || null,
    oidInitData.ctx_ip_address || null,
    enqueueTwentyCreateLead,
  );
}

function processNewProfile() {
  const idOid = generateULID();

  logToConsole("SORTOWNIA: ✨ Nowy id_oid =", idOid);
  var newKeysList = [];
  if (email) newKeysList.push("email");
  if (phone) newKeysList.push("phone");
  if (gaClientId) newKeysList.push("ga_client_id");
  if (newKeysList.length > 0) {
    logToConsole(
      "SORTOWNIA: ⭐ Nowy profil - wszystkie klucze są nowe:",
      newKeysList,
    );
  }

  let owner = "platform:none";
  let assist = null;
  let orderId;
  let aktTimestamp;
  let aktTimestampMs = null;

  var enqueueTwentyCreateLead = false;
  if (eventName === "generate_lead") {
    logToConsole("SORTOWNIA: Obliczam Akt Własności...");

    owner = computeOwnerFromCurrentEvent(
      attrGclid,
      attrFbc,
      attrGbraid,
      attrWbraid,
      srcSystem,
      attrUtmSource,
    );

    assist = null;
    orderId = timestamp + "_generate_lead";
    aktTimestamp = timeOccurredIso || timestamp + "_iso";
    aktTimestampMs = timestamp * 1;

    logToConsole(
      "SORTOWNIA: ✅ Akt: owner =",
      owner,
      ", AktTimestampMs =",
      aktTimestampMs,
    );
    enqueueTwentyCreateLead = true;
  }

  saveProfileAndTask(
    idOid,
    owner,
    owner,
    assist,
    orderId,
    aktTimestamp,
    aktTimestampMs,
    null,
    null,
    null,
    null,
    null,
    enqueueTwentyCreateLead,
  );
}

function uniqKeys(arr) {
  const out = [];
  let i = 0;
  while (i < arr.length) {
    const k = arr[i];
    let found = false;
    let j = 0;
    while (j < out.length) {
      if (out[j] === k) {
        found = true;
        break;
      }
      j = j + 1;
    }
    if (!found && k) out.push(k);
    i = i + 1;
  }
  return out;
}

function enqueueCrmTwentyCreateLeadTask(baseTaskData) {
  var crmTaskId =
    baseTaskData.id_oid + "_" + timestamp + "_crm_twenty_create_lead";
  var crmTaskData = {
    id_oid: baseTaskData.id_oid,
    id_event: timestamp + "_crm_twenty_create_lead",
    event_name: "generate_lead",
    job_type: "crm:twenty_create_lead",
    status: "pending",
    created_at: timestamp,
    environment: baseTaskData.environment,
    adapter: "crm:twenty_create_lead",
    biz_email: baseTaskData.biz_email,
    biz_phone: baseTaskData.biz_phone,
    biz_name: baseTaskData.biz_name,
    biz_product: baseTaskData.biz_product,
    biz_pricing_key: baseTaskData.biz_pricing_key,
    biz_value: baseTaskData.biz_value,
    attr_gclid: baseTaskData.attr_gclid,
    attr_fbc: baseTaskData.attr_fbc,
    attr_gbraid: baseTaskData.attr_gbraid,
    attr_wbraid: baseTaskData.attr_wbraid,
    ctx_page_url: baseTaskData.ctx_page_url,
    ctx_user_agent: baseTaskData.ctx_user_agent,
    ctx_ip_address: baseTaskData.ctx_ip_address,
    ctx_referrer: baseTaskData.ctx_referrer,
    ctx_time_on_page_ms: baseTaskData.ctx_time_on_page_ms,
    biz_message: baseTaskData.biz_message,
    biz_form_answers: baseTaskData.biz_form_answers,
    biz_form_product: baseTaskData.biz_form_product,
    ga_client_id: baseTaskData.ga_client_id,
    owner: baseTaskData.owner,
    order_id: baseTaskData.order_id,
    src_system: baseTaskData.src_system,
    src_action_source: baseTaskData.src_action_source,
    consent_analytics_storage: baseTaskData.consent_analytics_storage,
    consent_ad_storage: baseTaskData.consent_ad_storage,
    time_occurred_iso_utc: baseTaskData.time_occurred_iso_utc,
  };

  var encodedId = encodeUriComponent(crmTaskId);
  var saveUrl = API_BASE + "/task_queue/documents/" + encodedId;

  logToConsole("SORTOWNIA: Enqueue crm:twenty_create_lead", crmTaskId);

  sendHttpRequest(
    saveUrl,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify(crmTaskData),
  )
    .then(function (res) {
      logToConsole(
        "SORTOWNIA: ✅ crm:twenty_create_lead task saved, status =",
        res.statusCode,
      );
    })
    .catch(function (err) {
      logToConsole(
        "SORTOWNIA: ⚠️ crm:twenty_create_lead enqueue error (best-effort):",
        err,
      );
    });
}

function saveProfileAndTask(
  idOid,
  profileOwner,
  taskOwner,
  assist,
  orderId,
  aktTimestamp,
  aktTimestampMs,
  existingGclid,
  existingFbc,
  existingGaClientId,
  existingBizProduct,
  existingCtxIpAddress,
  enqueueTwentyCreateLead,
) {
  const resolvedGaClientId = gaClientId || existingGaClientId || null;
  const resolvedBizProduct =
    bizProduct ||
    normalizeBizProductSlug(existingBizProduct) ||
    existingBizProduct ||
    null;
  const resolvedCtxIp = resolveCtxIpAddress(existingCtxIpAddress);
  const taskEnvironment = resolveTaskEnvironment(email);

  const fullProfileData = {
    id_oid: idOid,
    biz_email: email,
    biz_phone: phone,
    biz_name: name,
    ga_client_id: resolvedGaClientId,
    biz_product: resolvedBizProduct,
    attr_gclid: attrGclid || existingGclid,
    attr_fbc: attrFbc || existingFbc,
    updated_at: timestamp,
    owner: profileOwner,
    assist: assist,
    order_id: orderId,
    AktTimestamp: aktTimestamp,
    AktTimestampMs: aktTimestampMs,
    ctx_ip_address: resolvedCtxIp,
  };

  const keys = [];
  keys.push(idOid);
  if (email) keys.push(email);
  if (phone) keys.push(phone);
  if (resolvedGaClientId) keys.push(resolvedGaClientId);

  const saveKeys = uniqKeys(keys);

  logToConsole("SORTOWNIA: Multi-key write, klucze:", saveKeys);
  logToConsole(
    "SORTOWNIA: Multi-key write: PUT pod",
    saveKeys.length,
    "kluczy (primary:",
    saveKeys[0] + ", pozostałe:",
    saveKeys.length - 1 + ")",
  );

  const primaryKey = saveKeys[0];
  const encodedPrimaryKey = encodeUriComponent(primaryKey);
  const saveIdentityUrl =
    API_BASE + "/identity_map/documents/" + encodedPrimaryKey;

  logToConsole(
    "SORTOWNIA: Zapisuję Identity Map (primary key:",
    primaryKey,
    ")...",
  );

  sendHttpRequest(
    saveIdentityUrl,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify(fullProfileData),
  )
    .then(function (saveIdentityResponse) {
      logToConsole(
        "SORTOWNIA: ✅ Identity saved (primary key:",
        primaryKey,
        "), status =",
        saveIdentityResponse.statusCode,
      );

      let keyIdx = 1;
      while (keyIdx < saveKeys.length) {
        const nextKey = saveKeys[keyIdx];
        const encodedNextKey = encodeUriComponent(nextKey);
        const saveNextUrl =
          API_BASE + "/identity_map/documents/" + encodedNextKey;

        sendHttpRequest(
          saveNextUrl,
          { method: "PUT", headers: { "Content-Type": "application/json" } },
          JSON.stringify(fullProfileData),
        )
          .then(function (response) {
            logToConsole(
              "SORTOWNIA: ✅ Identity saved (key:",
              nextKey,
              "), status =",
              response.statusCode,
            );
          })
          .catch(function (err) {
            logToConsole(
              "SORTOWNIA: ⚠️ Identity error (key:",
              nextKey,
              "):",
              err,
              "(best-effort, kontynuuję)",
            );
          });

        keyIdx = keyIdx + 1;
      }

      const taskId = idOid + "_" + timestamp + "_" + eventName;
      const srcActionSource =
        getEventDataWithFallback("src_action_source") || "website";
      const consentAnalytics = getEventDataWithFallback(
        "consent_analytics_storage",
      );
      const consentAd = getEventDataWithFallback("consent_ad_storage");
      logToConsole("SORTOWNIA: consent_analytics_storage =", consentAnalytics);
      logToConsole("SORTOWNIA: consent_ad_storage =", consentAd);
      logToConsole("SORTOWNIA: environment =", taskEnvironment);
      const taskData = {
        id_oid: idOid,
        id_event: timestamp + "_" + eventName,
        event_name: eventName,
        job_type: "analytics:ga4_mp",
        status: "pending",
        created_at: timestamp,
        environment: taskEnvironment,
        biz_email: email,
        biz_phone: phone,
        biz_name: name,
        biz_product: resolvedBizProduct,
        biz_pricing_key: bizPricingKey, // Klucz cennika dla Lookup Table
        biz_value: bizValue, // Rzeczywista wartość dla purchase
        attr_gclid: attrGclid || existingGclid,
        attr_fbc: attrFbc || existingFbc || null, // ✅ Dodano: Meta Click ID
        attr_gbraid: attrGbraid || null, // ✅ Dodano: Google Braid
        attr_wbraid: attrWbraid || null, // ✅ Dodano: Google Wbraid
        ctx_page_url: ctxPageUrl,
        ctx_user_agent: ctxUserAgent || null, // ✅ DODANO: dla Meta CAPI EMQ (wymagane)
        ctx_ip_address: resolvedCtxIp,
        ctx_referrer: ctxReferrer || null, // ✅ DODANO: dla analizy (opcjonalne)
        ctx_time_on_page_ms:
          ctxTimeOnPageMs !== undefined && ctxTimeOnPageMs !== null
            ? makeString(ctxTimeOnPageMs)
            : null, // ✅ Czas na stronie (jak w mailu)
        biz_message: bizMessage || null, // ✅ Treść wiadomości (jak w mailu)
        biz_form_answers: bizFormAnswers || null,
        biz_form_product: bizFormProduct || null,
        ga_client_id: resolvedGaClientId,
        owner: taskOwner, // last click (przy SKIP) lub first touch (nowy Akt)
        order_id: orderId,
        src_system: srcSystem, // ✅ Dodano zgodnie z SSOT
        src_action_source: srcActionSource, // ✅ Dodano zgodnie z SSOT
        consent_analytics_storage: consentAnalytics || null, // ✅ Consent Gate dla GA4
        consent_ad_storage: consentAd || null, // ✅ Consent Gate dla Google/Meta Ads
        time_occurred_iso_utc: timeOccurredIso || null,
      };

      const encodedTaskId = encodeUriComponent(taskId);
      const saveTaskUrl = API_BASE + "/task_queue/documents/" + encodedTaskId;

      logToConsole("SORTOWNIA: Zapisuję task...");

      sendHttpRequest(
        saveTaskUrl,
        { method: "PUT", headers: { "Content-Type": "application/json" } },
        JSON.stringify(taskData),
      )
        .then(function (saveTaskResponse) {
          logToConsole(
            "SORTOWNIA: ✅ Task saved, status =",
            saveTaskResponse.statusCode,
          );
          if (eventName === "generate_lead" && enqueueTwentyCreateLead) {
            enqueueCrmTwentyCreateLeadTask(taskData);
          }
          logToConsole("=== SORTOWNIA + AKT SUKCES ===");
          logToConsole(
            "FINAL: id_oid =",
            idOid,
            ", task owner =",
            taskOwner,
            ", order_id =",
            orderId,
          );
        })
        .catch(function (taskError) {
          logToConsole("SORTOWNIA: ❌ Task error:", taskError);
        });
    })
    .catch(function (identityError) {
      logToConsole("SORTOWNIA: ❌ Identity error:", identityError);
    });
}

logToConsole("SORTOWNIA V2: Processing started...");
