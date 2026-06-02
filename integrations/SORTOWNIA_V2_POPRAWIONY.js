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

// ✅ Odczyt wartości z event_params (GA4 w sGTM często trzyma parametry w event_params, nie na top level)
function getEventParamFromEventParams(key) {
  var eventParams = getEventData("event_params");
  if (!eventParams) return undefined;
  // Format GA4: tablica [{key: "x", value: {stringValue: "..."}}] lub obiekt {x: "..."}
  if (typeof eventParams === "object" && eventParams[key] !== undefined) {
    return eventParams[key];
  }
  if (typeof eventParams.length === "number") {
    var i = 0;
    while (i < eventParams.length) {
      var item = eventParams[i];
      if (item && item.key === key && item.value) {
        var v = item.value;
        if (v.stringValue !== undefined) return v.stringValue;
        if (v.intValue !== undefined) return v.intValue + "";
        if (v.doubleValue !== undefined) return v.doubleValue + "";
        return undefined;
      }
      i = i + 1;
    }
  }
  return undefined;
}

// ✅ Odczyt wartości z user_data (GA4 Enhanced Conversions / Customer Match):
// Web GTM tag GA4 zwykle przekazuje email/phone/etc. w obiekcie user_data,
// nie na top-level event_data. Bez tego Sortownia nie widzi email/phone z formularza
// przy generate_lead → profil w identity_map jest zapisany tylko pod id_oid + ga_client_id,
// więc późniejszy CRM event (qualify_lead/purchase) lookuje po email/phone i dostaje 404.
function getUserDataParam(key) {
  var ud = getEventData("user_data");
  if (!ud || typeof ud !== "object") return undefined;
  var v = ud[key];
  if (v === null || v === undefined) return undefined;
  return v;
}

// ✅ POPRAWKA: Helper dla test environment - fallback do data.eventData i event_params
function getEventDataWithFallback(key) {
  var result = getEventData(key);
  logToConsole("SORTOWNIA DEBUG getEventDataWithFallback:", key, "=", result);
  // Jeśli getEventData zwraca null/undefined i jesteśmy w test environment (data.eventData istnieje)
  if (
    (result === null || result === undefined) &&
    data &&
    data.eventData &&
    typeof data.eventData === "object"
  ) {
    result = data.eventData[key];
    logToConsole(
      "SORTOWNIA DEBUG getEventDataWithFallback fallback:",
      key,
      "=",
      result
    );
  }
  // ✅ Fallback: GA4 w sGTM często przekazuje parametry w event_params (nie na top level)
  if (result === null || result === undefined) {
    result = getEventParamFromEventParams(key);
    if (result !== undefined) {
      logToConsole(
        "SORTOWNIA DEBUG getEventDataWithFallback event_params:",
        key,
        "=",
        result
      );
    }
  }
  return result;
}

data.gtmOnSuccess();

// ============================================
// HELPER: Parsuj parametry URL z ctx_page_url
// ============================================
function parseUrlParams(url) {
  if (!url) return {};
  // ✅ POPRAWKA: Usunięto try/catch (nie jest obsługiwane w sGTM)
  // Ręczne parsowanie query string (bez new URL() - może nie być dostępne w sGTM)
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
      // ✅ POPRAWKA: Nie używamy decodeURIComponent (nie jest dostępne w sGTM)
      // Parametry URL są zwykle już zdekodowane w query string
      const key = pair.substring(0, equalIndex);
      const value = pair.substring(equalIndex + 1);
      params[key] = value;
    }
    i = i + 1;
  }

  return params;
}

// ============================================
// FUNKCJE NORMALIZACJI PII
// ============================================

// ✅ POPRAWKA: charAt() może nie być dostępne w sGTM, użyj substring()
function getCharAt(s, idx) {
  if (!s || typeof s !== "string" || idx < 0 || idx >= s.length) return "";
  return s.substring(idx, idx + 1);
}

// ═══════════════════════════════════════════════════════════════
// normalizeEmail(raw) — v2.3.1
// ═══════════════════════════════════════════════════════════════
// Input:  string (surowy email) lub null/undefined
// Output: string (czysty email) lub undefined
//
// Strategia: zachowujemy kropki i +suffix (normalizacja pod Metę)
// Google sam sobie matchuje warianty, Meta wymaga dokładnego matcha
// ═══════════════════════════════════════════════════════════════

function normalizeEmail(raw) {
  if (raw === null || raw === undefined) return undefined;

  // ✅ POPRAWKA: String() nie jest dostępne w sGTM, użyj konkatenacji
  var str = typeof raw === "string" ? raw : raw + "";
  logToConsole(
    "SORTOWNIA DEBUG normalizeEmail: str =",
    str,
    "typeof =",
    typeof str
  );
  if (typeof str !== "string") {
    logToConsole("SORTOWNIA DEBUG normalizeEmail: str is not string");
    return undefined;
  }

  // ✅ POPRAWKA: trim() nie jest dostępne w sGTM, użyj własnej implementacji
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
  logToConsole(
    "SORTOWNIA DEBUG normalizeEmail: trimmed =",
    trimmed,
    "length =",
    trimmed.length
  );
  if (!trimmed || trimmed.length === 0) {
    logToConsole("SORTOWNIA DEBUG normalizeEmail: trimmed is empty");
    return undefined;
  }

  // Helper: wyciągnij pierwszy email z listy
  var extractFirstEmail = function (s) {
    if (!s || typeof s !== "string") return "";
    // ✅ POPRAWKA: W sGTM stringi mają indexOf i substring, nie sprawdzamy typeof
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

  // Helper: unwrap mailto:, <...>, "Name <email>"
  var unwrapEmail = function (s) {
    if (!s || typeof s !== "string") return "";
    // ✅ POPRAWKA: W sGTM stringi mają substring i indexOf, nie sprawdzamy typeof
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

  // Helper: usuń trailing punctuation
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

  // Helper: usuń whitespace i control characters
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

  // Helper: zamień przecinki na kropki (mobile keyboard fix)
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

  // Helper: kompresuj podwójne kropki
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

  // Helper: walidacja domeny
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

    // TLD: a-z, 0-9, - (dla punycode xn--...)
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

  // ─── PIPELINE NORMALIZACJI ───

  var email = extractFirstEmail(trimmed);
  logToConsole(
    "SORTOWNIA DEBUG normalizeEmail: po extractFirstEmail =",
    email,
    "length =",
    email ? email.length : "N/A"
  );
  if (!email || typeof email !== "string" || email.length === 0) {
    logToConsole(
      "SORTOWNIA DEBUG normalizeEmail: extractFirstEmail returned invalid"
    );
    return undefined;
  }

  email = unwrapEmail(email);
  logToConsole("SORTOWNIA DEBUG normalizeEmail: po unwrapEmail =", email);
  if (!email || typeof email !== "string") {
    logToConsole(
      "SORTOWNIA DEBUG normalizeEmail: unwrapEmail returned invalid"
    );
    return undefined;
  }

  email = email.toLowerCase();
  logToConsole("SORTOWNIA DEBUG normalizeEmail: po toLowerCase =", email);
  if (typeof email !== "string") {
    logToConsole(
      "SORTOWNIA DEBUG normalizeEmail: toLowerCase returned invalid"
    );
    return undefined;
  }

  email = stripTrailingPunctuation(email);
  logToConsole(
    "SORTOWNIA DEBUG normalizeEmail: po stripTrailingPunctuation =",
    email
  );
  if (typeof email !== "string") return undefined;
  if (email.length === 0) {
    logToConsole(
      "SORTOWNIA DEBUG normalizeEmail: email empty after stripTrailingPunctuation"
    );
    return undefined;
  }

  email = stripAllWhitespace(email);
  logToConsole(
    "SORTOWNIA DEBUG normalizeEmail: po stripAllWhitespace =",
    email
  );
  if (typeof email !== "string") return undefined;
  if (email.length === 0) {
    logToConsole(
      "SORTOWNIA DEBUG normalizeEmail: email empty after stripAllWhitespace"
    );
    return undefined;
  }

  email = fixCommas(email);
  logToConsole("SORTOWNIA DEBUG normalizeEmail: po fixCommas =", email);
  if (typeof email !== "string") return undefined;
  if (email.length === 0) {
    logToConsole("SORTOWNIA DEBUG normalizeEmail: email empty after fixCommas");
    return undefined;
  }

  email = compressDoubleDots(email);
  logToConsole(
    "SORTOWNIA DEBUG normalizeEmail: po compressDoubleDots =",
    email
  );
  if (typeof email !== "string") return undefined;
  if (email.length === 0) {
    logToConsole(
      "SORTOWNIA DEBUG normalizeEmail: email empty after compressDoubleDots"
    );
    return undefined;
  }

  // Walidacja długości
  if (email.length < 6 || email.length > 254) {
    logToConsole(
      "SORTOWNIA DEBUG normalizeEmail: email length invalid =",
      email.length
    );
    return undefined;
  }

  // Walidacja struktury
  var atIndex = email.indexOf("@");
  if (atIndex === -1) return undefined;
  if (email.indexOf("@", atIndex + 1) !== -1) return undefined;

  var localPart = email.substring(0, atIndex);
  var domain = email.substring(atIndex + 1);
  logToConsole(
    "SORTOWNIA DEBUG normalizeEmail: przed Gmail rules, localPart =",
    localPart,
    "domain =",
    domain
  );

  // ───────────────────────────────────────────────────────────────
  // GMAIL RULES (KANONICZNE) — v2.4.0
  // ───────────────────────────────────────────────────────────────
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
    logToConsole(
      "SORTOWNIA DEBUG normalizeEmail: po Gmail rules, localPart =",
      localPart
    );

    if (localPart.length === 0) {
      logToConsole(
        "SORTOWNIA DEBUG normalizeEmail: localPart.length === 0 po Gmail rules"
      );
      return undefined;
    }
  }

  // Walidacja local part (JUŻ PO Gmail rules)
  if (localPart.length === 0 || localPart.length > 64) {
    logToConsole(
      "SORTOWNIA DEBUG normalizeEmail: localPart.length invalid =",
      localPart.length
    );
    return undefined;
  }
  if (getCharAt(localPart, 0) === ".") {
    logToConsole("SORTOWNIA DEBUG normalizeEmail: localPart starts with dot");
    return undefined;
  }
  if (getCharAt(localPart, localPart.length - 1) === ".") {
    logToConsole("SORTOWNIA DEBUG normalizeEmail: localPart ends with dot");
    return undefined;
  }

  // Local part musi mieć co najmniej jeden alfanumeryczny znak
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
    logToConsole(
      "SORTOWNIA DEBUG normalizeEmail: hasAlphaNum = false, localPart =",
      localPart
    );
    return undefined;
  }

  var domainValid = validateDomain(domain);
  if (!domainValid) {
    logToConsole(
      "SORTOWNIA DEBUG normalizeEmail: validateDomain(",
      domain,
      ") = false"
    );
    return undefined;
  }

  var finalEmail = localPart + "@" + domain;
  logToConsole("SORTOWNIA DEBUG normalizeEmail: finalEmail =", finalEmail);
  return finalEmail;
}

// ═══════════════════════════════════════════════════════════════
// normalizePhone(raw) — v2.3.1
// ═══════════════════════════════════════════════════════════════
// Input:  string lub number (surowy telefon) lub null/undefined
// Output: string w formacie E.164 (+48123456789) lub undefined
//
// Warstwy:
// 1. + lub 00 prefix → zaufaj i użyj
// 2. Polski (9 cyfr, 10 z 0, zaczyna od 48)
// 3. 10-15 cyfr bez wiodącego 0 → +digits (ratunek)
// ═══════════════════════════════════════════════════════════════

function normalizePhone(raw) {
  if (raw === null || raw === undefined) return undefined;

  // ✅ POPRAWKA: trim() nie jest dostępne w sGTM, użyj własnej implementacji
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

  // Konwersja number → string
  var str;
  if (typeof raw === "string") {
    str = trimString(raw);
  } else if (typeof raw === "number") {
    // ✅ POPRAWKA: isFinite(), Infinity, Math nie są dostępne w sGTM
    // Sprawdź czy to nie jest NaN (raw !== raw)
    // Sprawdź podstawowe warunki (dodatnia, całkowita, w bezpiecznym zakresie)
    // Sprawdź czy jest całkowita: raw % 1 === 0 (reszta z dzielenia przez 1)
    if (raw !== raw || raw <= 0 || raw % 1 !== 0) return undefined;
    // Sprawdź czy nie jest za duża (wychwyci też Infinity, jeśli by było)
    if (raw > 9007199254740991) return undefined;
    // ✅ POPRAWKA: toString() może nie być dostępne w sGTM, użyj konkatenacji
    str = raw + "";
    // Sprawdź czy nie ma notacji wykładniczej (e/E) - indexOf jest dostępne dla stringów
    if (str.indexOf("e") !== -1 || str.indexOf("E") !== -1) return undefined;
  } else {
    return undefined;
  }

  if (str.length === 0) return undefined;

  // Helper: usuń rozszerzenie (wew., ext., x, #)
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

  // Helper: wyciągnij pierwszy numer z listy
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

  // ─── PREPROCESSING ───

  var phone = extractFirstPhone(str);
  phone = stripExtension(phone);

  var hadPlusPrefix = getCharAt(phone, 0) === "+";
  var hadDoubleZeroPrefix =
    phone.length >= 2 &&
    getCharAt(phone, 0) === "0" &&
    getCharAt(phone, 1) === "0";

  // Wyciągnij tylko cyfry
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

  // ─── WARSTWY NORMALIZACJI ───

  // WARSTWA 1a: + prefix (Trust the Plus)
  if (hadPlusPrefix) {
    if (digits.length >= 7 && digits.length <= 15) {
      return "+" + digits;
    }
  }

  // WARSTWA 1b: 00 prefix
  if (hadDoubleZeroPrefix) {
    var digitsWithout00 = digits.substring(2);
    if (digitsWithout00.length >= 7 && digitsWithout00.length <= 15) {
      return "+" + digitsWithout00;
    }
  }

  // WARSTWA 2a: 9 cyfr = polski
  if (digits.length === 9) {
    return "+" + DEFAULT_COUNTRY_CODE + digits;
  }

  // WARSTWA 2b: 10 cyfr z 0 = stary polski format
  if (digits.length === 10 && getCharAt(digits, 0) === "0") {
    return "+" + DEFAULT_COUNTRY_CODE + digits.substring(1);
  }

  // WARSTWA 2c: Zaczyna od 48 (polski bez +)
  if (
    digits.substring(0, 2) === "48" &&
    digits.length >= 10 &&
    digits.length <= 12
  ) {
    return "+" + digits;
  }

  // WARSTWA 3: Ratunek (10-15 cyfr, nie zaczyna od 0)
  if (
    digits.length >= 10 &&
    digits.length <= 15 &&
    getCharAt(digits, 0) !== "0"
  ) {
    return "+" + digits;
  }

  // WARSTWA 4: nie udało się znormalizować
  return undefined;
}

// SSOT event names (owocni-crm/EVENT_CONTRACT.md §5.2) — legacy aliasy na wejściu
function normalizeSsoEventName(name) {
  if (!name) return name;
  if (name === "lead_won" || name === "closed_won") return "purchase";
  if (name === "lead_rejected") return "rejected_lead";
  return name;
}

// KROK 0: Sprawdź typ eventu
const eventName = normalizeSsoEventName(
  getEventDataWithFallback("event_name") ||
  getEventDataWithFallback("event") ||
  "generate_lead"
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

// ============================================
// HELPER: Odczyt cookie _oid
// ============================================
function getFirstCookie(name) {
  // ✅ W trybie "run code" cookie może być niedostępne (to normalne)
  // W Preview Mode / Production cookie będzie dostępne
  const vals = getCookieValues(name);
  return vals && vals.length ? vals[0] : null;
}

// Wyciąga GA4 client_id z cookie _ga (GA1.1.1234567890.1234567890 -> 1234567890.1234567890)
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

// ============================================
// OBSŁUGA OID_INIT (zdarzenie techniczne)
// ============================================
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
  // ✅ POPRAWKA: Pobierz IP z Event Data
  var ctxIpAddress = getEventDataWithFallback("ctx_ip_address");

  // Fallback: inne nazwy w Event Data
  if (!ctxIpAddress) {
    ctxIpAddress = getEventDataWithFallback("ip_address");
  }
  if (!ctxIpAddress) {
    ctxIpAddress = getEventDataWithFallback("client_ip");
  }
  if (!ctxIpAddress) {
    ctxIpAddress = getEventDataWithFallback("ip_override"); // ✅ DODANO: GA4 używa ip_override
  }
  const ctxReferrer =
    getEventDataWithFallback("ctx_referrer") ||
    getEventDataWithFallback("page_referrer") ||
    getEventDataWithFallback("referrer");

  // ✅ POPRAWKA: Parsuj parametry URL z ctx_page_url jako fallback
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
        ctx_ip_address: ctxIpAddress || existingData.ctx_ip_address || null, // ✅ DODANO: dla Meta CAPI (zalecane)
        ctx_referrer: ctxReferrer || existingData.ctx_referrer || null, // ✅ DODANO: dla analizy
        oid_init_timestamp: timestamp,
        updated_at: timestamp,
      };

      // Zachowaj istniejące dane (tylko jeśli są)
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
        JSON.stringify(updatedData)
      )
        .then(function () {
          logToConsole("OID_INIT: ✅ Zapisano - gclid zachowany!");

          // Ustaw cookie _oid server-side (zgodnie z SSOT)
          // Cookie _oid: HttpOnly, Secure, Path=/, Max-Age=90 dni
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
        JSON.stringify(fallbackData)
      ).then(function () {
        logToConsole("OID_INIT: ✅ Fallback - nowy profil");

        // Ustaw cookie _oid server-side (zgodnie z SSOT)
        // Cookie _oid: HttpOnly, Secure, Path=/, Max-Age=90 dni
        setCookie("_oid", fallbackIdOid, {
          "max-age": 7776000, // 90 dni w sekundach (90 * 24 * 60 * 60)
          path: "/",
          secure: true,
          httponly: true, // UWAGA: małe litery 'httponly', nie 'httpOnly'!
          samesite: "Lax", // UWAGA: małe litery 'samesite', nie 'sameSite'!
        });

        logToConsole(
          "OID_INIT: ✅ Cookie _oid ustawione (fallback):",
          fallbackIdOid
        );
        logToConsole("=== OID_INIT SUKCES ===");
      });
    });

  return; // oid_init kończy się tutaj!
}

// ============================================
// HELPER: GET profilu po kluczu
// ============================================
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

// ============================================
// OBSŁUGA GENERATE_LEAD / QUALIFY_LEAD
// ============================================
logToConsole("=== SORTOWNIA + AKT START ===");

// ═══════════════════════════════════════════════════════════════
// ODCZYT I NORMALIZACJA PII (jedno miejsce)
// ═══════════════════════════════════════════════════════════════
// ✅ Email/phone czytane z 3 źródeł (kolejność priorytetów):
// 1) top-level event_data (biz_email/biz_phone — własna konwencja SSOT)
// 2) top-level event_data (email/phone — alias)
// 3) user_data.* (GA4 standard Enhanced Conversions / Customer Match — to tu Web GTM
//    tag GA4 przekazuje email/phone z formularza przy generate_lead).
// UWAGA: NIE używamy sha256_email_address / sha256_phone_number — zhashowana
// wartość nie nadaje się jako klucz indeksu w identity_map.
const rawEmail =
  getEventDataWithFallback("biz_email") ||
  getEventDataWithFallback("email") ||
  getUserDataParam("email") ||
  getUserDataParam("email_address");
const rawPhone =
  getEventDataWithFallback("biz_phone") ||
  getEventDataWithFallback("phone") ||
  getUserDataParam("phone_number") ||
  getUserDataParam("phone");

logToConsole("SORTOWNIA: rawEmail (przed normalizeEmail) =", rawEmail);
logToConsole("SORTOWNIA: rawPhone (przed normalizePhone) =", rawPhone);

const email = normalizeEmail(rawEmail);
logToConsole("SORTOWNIA: email (po normalizeEmail) =", email);
const phone = normalizePhone(rawPhone);
logToConsole("SORTOWNIA: phone (po normalizePhone) =", phone);

// ═══════════════════════════════════════════════════════════════
// OD TEGO MIEJSCA: używasz TYLKO email i phone (już znormalizowane)
// ═══════════════════════════════════════════════════════════════
const name =
  getEventDataWithFallback("biz_name") || getEventDataWithFallback("name");
const gaClientId =
  getEventDataWithFallback("ga_client_id") ||
  extractGaClientIdFromGaCookie() ||
  getEventDataWithFallback("client_id") ||
  getEventDataWithFallback("cid");
const rawBizProduct =
  getEventDataWithFallback("biz_product") ||
  getEventDataWithFallback("form_type");
const rawBizPricingKey = getEventDataWithFallback("biz_pricing_key");
// Fallback dla eventów SQL/WON: gdy nie ma biz_product, spróbuj wyciągnąć go z pricing_key (lead_/sql_/rejected_*)
function pricingKeyToProduct(pricingKey) {
  if (!pricingKey) return null;
  if (pricingKey.indexOf("lead_") === 0) return pricingKey.slice(5);
  if (pricingKey.indexOf("sql_") === 0) return pricingKey.slice(4);
  if (pricingKey.indexOf("rejected_") === 0) return pricingKey.slice(9);
  if (pricingKey.indexOf("won_") === 0) return pricingKey.slice(4);
  return pricingKey;
}

// Mapowanie slugów CRM / formularza na nazwy usług w arkuszu i cenniku
function normalizeBizProductSlug(product) {
  if (!product) return null;
  var s = makeString(product).toLowerCase().trim();
  if (s === "strona") return "strony";
  if (s === "kontakt" || s === "main") return null;
  return s;
}

// Gdy formularz wysyła biz_product=kontakt (strona /kontakt), spróbuj wywnioskować usługę z URL
function inferBizProductFromUrl(url) {
  if (!url) return null;
  var u = makeString(url).toLowerCase();
  if (u.indexOf("projektowanie-logo") >= 0 || u.indexOf("/logo") >= 0) return "logo";
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
// ✅ Strona wejścia (z gclid) – fallback gdy użytkownik przeszedł na /kontakt bez parametrów
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
// ✅ POPRAWKA: Pobierz IP z Event Data
var ctxIpAddress = getEventDataWithFallback("ctx_ip_address");

// Fallback: inne nazwy w Event Data
if (!ctxIpAddress) {
  ctxIpAddress = getEventDataWithFallback("ip_address");
}
if (!ctxIpAddress) {
  ctxIpAddress = getEventDataWithFallback("client_ip");
}
if (!ctxIpAddress) {
  ctxIpAddress = getEventDataWithFallback("ip_override"); // ✅ DODANO: GA4 używa ip_override
}
const ctxReferrer =
  getEventDataWithFallback("ctx_referrer") ||
  getEventDataWithFallback("page_referrer") ||
  getEventDataWithFallback("referrer");
const srcSystem = getEventDataWithFallback("src_system") || "web";
const timeOccurredIso = getEventDataWithFallback("time_occurred_iso_utc");
// ✅ Czas na stronie (ms) i treść wiadomości — do arkusza (jak w mailu)
var ctxTimeOnPageMs =
  getEventDataWithFallback("ctx_time_on_page_ms") ||
  getEventDataWithFallback("time_on_page_ms") ||
  getEventDataWithFallback("time_on_page") ||
  null;
var bizMessage =
  getEventDataWithFallback("biz_message") ||
  getEventDataWithFallback("message") ||
  getEventDataWithFallback("description") ||
  null;

// ✅ POPRAWKA: Parsuj parametry URL z ctx_page_url i ctx_landing_page_url (strona wejścia z gclid)
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
// attr_fbc może być w cookie _fbc lub w URL jako fbclid
const attrFbc =
  getEventDataWithFallback("attr_fbc") ||
  urlParams.fbclid ||
  landingUrlParams.fbclid ||
  "";
// utm_source z URL lub Event Data (fallback gdy brak gclid/fbc)
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
  attrUtmSource || "(brak)"
);

// ═══════════════════════════════════════════════════════════════
// HELPER: Oblicz platformę (owner) z BIEŻĄCEGO zdarzenia
// Używane: przy nowym Akcie ORAZ przy SKIP (dla taska = "last click")
// Fallback: utm_source z URL gdy brak click-id (np. parametry zgubione przy submit)
// Kolejność jak SSOT2: twardy click Google (gclid / gbraid / wbraid) PRZED fbc — inaczej
// merge profilu (stary attr_fbc + świeży gclid z Google Ads) błędnie dawał platform:meta_ads.
// ═══════════════════════════════════════════════════════════════
function computeOwnerFromCurrentEvent(
  gclid,
  fbc,
  gbraid,
  wbraid,
  src,
  utmSource
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

// ═══════════════════════════════════════════════════════════════
// ODCZYT COOKIE _OID (KROK 1)
// ═══════════════════════════════════════════════════════════════
const oidCookie = getFirstCookie("_oid");
logToConsole("SORTOWNIA: _oid cookie =", oidCookie);

// ═══════════════════════════════════════════════════════════════
// KROK 2: WATERFALL RESOLVE (_oid → email → phone → ga_client_id)
// ═══════════════════════════════════════════════════════════════

// Zbuduj listę kluczy resolve (kolejność ma znaczenie!)
const resolveKeys = [];
if (oidCookie) resolveKeys.push(oidCookie);
if (email) resolveKeys.push(email);
if (phone) resolveKeys.push(phone);
if (gaClientId) resolveKeys.push(gaClientId);

if (resolveKeys.length === 0) {
  logToConsole(
    "SORTOWNIA ERROR: Brak kluczy resolve (_oid/email/phone/ga_client_id) - SKIP"
  );
  return;
}

// Funkcja do sekwencyjnego resolve po kluczach
function resolveProfile(keys, idx) {
  if (idx >= keys.length) {
    // Nic nie znaleziono - nowy profil
    logToConsole("SORTOWNIA: Wszystkie klucze 404 - nowy profil");
    processNewProfile();
    return;
  }

  const key = keys[idx];
  logToConsole(
    "SORTOWNIA: Resolve lookup key =",
    key,
    "(" + (idx + 1) + "/" + keys.length + ")"
  );

  getProfileByKey(
    key,
    function (res) {
      // ✅ REGUŁA: ga_client_id może wskazać profil TYLKO jeśli nie ma _oid/email/phone w evencie.
      // Jeśli ga_client_id wskazał profil, ale w evencie jest email/phone, to te klucze są "nowe"
      // i muszą być dodane do multi-key write. Od tej pory ga_client_id jest tylko indeksem
      // do tego samego profilu (nie może wskazać innego profilu).
      var resolveKeyType = "unknown";
      if (key === oidCookie) resolveKeyType = "_oid";
      else if (key === email) resolveKeyType = "email";
      else if (key === phone) resolveKeyType = "phone";
      else if (key === gaClientId) resolveKeyType = "ga_client_id";

      logToConsole(
        "SORTOWNIA: ✅ Found profile by key =",
        key,
        "(typ:",
        resolveKeyType + ")"
      );
      processExistingProfile(res);
    },
    function () {
      // Nie znaleziono - próbuj następny klucz
      resolveProfile(keys, idx + 1);
    }
  );
}

// Start resolve od pierwszego klucza
resolveProfile(resolveKeys, 0);

// ============================================
// HELPER: Przetwórz istniejący profil
// ============================================
function processExistingProfile(lookupResponse) {
  const profileBody = JSON.parse(lookupResponse.body);
  const existing =
    profileBody.data && profileBody.data.data ? profileBody.data.data : {};

  // 🔬 DIAGNOSTYKA ga_client_id fallback (do usunięcia po naprawie):
  logToConsole(
    "SORTOWNIA DEBUG: existing.ga_client_id =",
    existing.ga_client_id,
    ", existing.id_oid =",
    existing.id_oid,
    ", existing.biz_email =",
    existing.biz_email,
    ", existing.biz_phone =",
    existing.biz_phone
  );

  const idOid = existing.id_oid || generateULID();

  // ✅ REGUŁA BEZPIECZEŃSTWA DEVICE ID:
  // ga_client_id może wskazać profil TYLKO jeśli nie ma _oid/email/phone w evencie.
  // Jeśli ga_client_id wskazał profil, ale w evencie jest email/phone, to te klucze są "nowe"
  // i muszą być dodane do multi-key write. Od tej pory ga_client_id jest tylko indeksem
  // do tego samego profilu (nie może wskazać innego profilu).

  // Sprawdź, które klucze są nowe (pojawiły się pierwszy raz w evencie)
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
      newKeysList
    );
    logToConsole(
      "SORTOWNIA: ⚠️ Multi-key write będzie zapisać profil pod nowymi kluczami:",
      newKeysList
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

  // BLOKADA 90 DNI: Sprawdź czy Akt istnieje i jest młodszy niż 90 dni
  let aktTimestampMs = null;
  if (eventName === "generate_lead") {
    const nowMs = timestamp * 1;

    if (existing.AktTimestampMs) {
      // ✅ Użyj AktTimestampMs (number) - precyzyjne
      aktTimestampMs = existing.AktTimestampMs * 1;
    } else if (existing.AktTimestamp) {
      // Fallback: parsuj AktTimestamp (kompatybilność wsteczna)
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
          ")"
        );
        // Zachowaj istniejący Akt (nie nadpisuj) — profil = first touch
        orderId = existing.order_id || orderId;
        aktTimestamp = existing.AktTimestamp;
        aktTimestampMs = existing.AktTimestampMs || aktTimestampMs;
        owner = existing.owner || owner;
        assist = existing.assist !== undefined ? existing.assist : assist;
        // ✅ Task dostaje platformę z: bieżące zdarzenie LUB profil (tak jak zapisujemy attr_* w tasku)
        // Dzięki temu jeśli formularz nie przekazał fbclid/gclid, a profil ma attr_fbc → owner = meta
        var mergedGclid = attrGclid || existingGclid;
        var mergedFbc = attrFbc || existingFbc;
        var taskOwner = computeOwnerFromCurrentEvent(
          mergedGclid,
          mergedFbc,
          attrGbraid,
          attrWbraid,
          srcSystem,
          attrUtmSource
        );
        if (taskOwner !== owner) {
          logToConsole(
            "SORTOWNIA: Task owner =",
            taskOwner,
            ", profil owner (first touch) =",
            owner
          );
        }
      } else {
        var daysRounded = (ageDays + 0.5) | 0;
        logToConsole(
          "SORTOWNIA: ✅ Akt jest starszy niż 90 dni (",
          daysRounded,
          " dni, AktTimestampMs =",
          aktTimestampMs,
          ") - tworzę nowy"
        );
        // Akt jest starszy niż 90 dni - utwórz nowy
        var finalGclid = attrGclid || existingGclid;
        var finalFbc = attrFbc || existingFbc;
        owner = computeOwnerFromCurrentEvent(
          finalGclid,
          finalFbc,
          attrGbraid,
          attrWbraid,
          srcSystem,
          attrUtmSource
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
          aktTimestampMs
        );
      }
    } else {
      // Akt nie istnieje - utwórz nowy
      logToConsole("SORTOWNIA: ✨ Brak Akt - tworzę nowy");
      var finalGclid = attrGclid || existingGclid;
      var finalFbc = attrFbc || existingFbc;
      owner = computeOwnerFromCurrentEvent(
        finalGclid,
        finalFbc,
        attrGbraid,
        attrWbraid,
        srcSystem,
        attrUtmSource
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
        aktTimestampMs
      );
    }
  } else {
    // qualify_lead - zachowaj istniejące wartości
    aktTimestampMs = existing.AktTimestampMs || null;
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
    existing.biz_product || null
  );
}

// ============================================
// HELPER: Przetwórz profil z oid_init (merge)
// ============================================
function processMergedProfile(oidInitResponse) {
  const oidInitBody = JSON.parse(oidInitResponse.body);
  const oidInitData =
    oidInitBody.data && oidInitBody.data.data ? oidInitBody.data.data : {};

  const idOid = oidInitData.id_oid || generateULID();
  const existingGclid = oidInitData.attr_gclid;
  const existingFbc = oidInitData.attr_fbc;

  logToConsole("SORTOWNIA: ✨ Merge z oid_init - id_oid =", idOid);

  // ✅ Sprawdź, które klucze są nowe (pojawiły się pierwszy raz w evencie)
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
      newKeysList
    );
  }

  logToConsole("SORTOWNIA: gclid z oid_init =", existingGclid);

  // Oblicz Akt (nowy profil)
  let owner = "platform:none";
  let assist = null;
  let orderId;
  let aktTimestamp;
  let aktTimestampMs = null;

  if (eventName === "generate_lead") {
    logToConsole("SORTOWNIA: Obliczam Akt Własności...");

    const finalGclid = attrGclid || existingGclid;
    const finalFbc = attrFbc || existingFbc;
    owner = computeOwnerFromCurrentEvent(
      finalGclid,
      finalFbc,
      attrGbraid,
      attrWbraid,
      srcSystem,
      attrUtmSource
    );
    if (owner === "platform:google_ads" && finalGclid)
      logToConsole(
        "SORTOWNIA: Owner = Google (gclid z oid_init:",
        finalGclid,
        ")"
      );

    assist = null;
    orderId = timestamp + "_generate_lead";
    aktTimestamp = timeOccurredIso || timestamp + "_iso";
    aktTimestampMs = timestamp * 1;

    logToConsole(
      "SORTOWNIA: ✅ Akt: owner =",
      owner,
      ", AktTimestampMs =",
      aktTimestampMs
    );
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
    oidInitData.biz_product || null
  );
}

// ============================================
// HELPER: Przetwórz nowy profil (bez oid_init)
// ============================================
function processNewProfile() {
  const idOid = generateULID();

  logToConsole("SORTOWNIA: ✨ Nowy id_oid =", idOid);
  // 🔬 DIAGNOSTYKA: jeśli tu trafia event CRM (qualify_lead/purchase), to znaczy że
  // Waterfall Resolve nie znalazł profilu po email/phone — fallback ga_client_id z profilu
  // nie zadziała, bo profilu po prostu nie ma (lub jest pod innym kluczem).
  logToConsole(
    "SORTOWNIA DEBUG processNewProfile: eventName =",
    eventName,
    ", srcSystem =",
    srcSystem,
    ", email =",
    email,
    ", phone =",
    phone
  );

  // ✅ Dla nowego profilu wszystkie klucze są "nowe"
  var newKeysList = [];
  if (email) newKeysList.push("email");
  if (phone) newKeysList.push("phone");
  if (gaClientId) newKeysList.push("ga_client_id");
  if (newKeysList.length > 0) {
    logToConsole(
      "SORTOWNIA: ⭐ Nowy profil - wszystkie klucze są nowe:",
      newKeysList
    );
  }

  let owner = "platform:none";
  let assist = null;
  let orderId;
  let aktTimestamp;
  let aktTimestampMs = null;

  if (eventName === "generate_lead") {
    logToConsole("SORTOWNIA: Obliczam Akt Własności...");

    owner = computeOwnerFromCurrentEvent(
      attrGclid,
      attrFbc,
      attrGbraid,
      attrWbraid,
      srcSystem,
      attrUtmSource
    );

    assist = null;
    orderId = timestamp + "_generate_lead";
    aktTimestamp = timeOccurredIso || timestamp + "_iso";
    aktTimestampMs = timestamp * 1;

    logToConsole(
      "SORTOWNIA: ✅ Akt: owner =",
      owner,
      ", AktTimestampMs =",
      aktTimestampMs
    );
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
    null
  );
}

// ============================================
// HELPER: Usuń duplikaty z tablicy kluczy
// ============================================
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

// ============================================
// HELPER: Zapisz profil i task
// ============================================
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
  existingBizProduct
) {
  // ✅ Fallback ga_client_id z profilu w identity_map.
  // Kluczowe dla zdarzeń CRM (qualify_lead/purchase/rejected_lead), które nie mają
  // dostępu do cookie _ga przeglądarki — bez tego robot wysyłałby do GA4 MP
  // client_id = id_oid (ULID) i lejek nie sklejałby się z generate_lead z Web GTM.
  const resolvedGaClientId = gaClientId || existingGaClientId || null;
  const resolvedBizProduct =
    bizProduct ||
    normalizeBizProductSlug(existingBizProduct) ||
    existingBizProduct ||
    null;

  // 🔬 DIAGNOSTYKA ga_client_id fallback (do usunięcia po naprawie):
  logToConsole(
    "SORTOWNIA DEBUG saveProfileAndTask: gaClientId(event) =",
    gaClientId,
    ", existingGaClientId(profil) =",
    existingGaClientId,
    ", resolvedGaClientId(final) =",
    resolvedGaClientId,
    ", idOid =",
    idOid,
    ", eventName =",
    eventName,
    ", srcSystem =",
    srcSystem
  );

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
  };

  // ═══════════════════════════════════════════════════════════════
  // MULTI-KEY WRITE: zapis profilu pod wszystkimi kluczami
  // ═══════════════════════════════════════════════════════════════
  // ✅ REGUŁA: Zapisujemy profil pod WSZYSTKIMI znanymi kluczami:
  // - id_oid (zawsze, primary key)
  // - email (jeśli jest w evencie)
  // - phone (jeśli jest w evencie)
  // - ga_client_id (jeśli jest w evencie)
  //
  // ✅ REGUŁA: Jeśli w evencie pojawił się nowy klucz (np. pierwszy raz mamy email/phone/ga_client_id),
  // to profil zapisujemy pod tym nowym kluczem również. To jest kluczowe, bo bez merge post-hoc
  // to jedyny moment, gdy "świat się dowiaduje", że te klucze należą do tego samego profilu.
  //
  // ✅ KIEDY: Multi-key write jest wykonywane ZAWSZE po resolve (zarówno dla istniejącego profilu,
  // jak i nowego), po każdym evencie, gdy pojawi się nowy klucz, i aktualizujemy WSZYSTKIE znane klucze.
  // ═══════════════════════════════════════════════════════════════
  const keys = [];
  keys.push(idOid);
  if (email) keys.push(email);
  if (phone) keys.push(phone);
  // ✅ Indeksuj profil również po ga_client_id z profilu (jeśli event nie przyniósł własnego),
  // żeby zachować zgodność klucz indeksu z polem profilu po fallbacku.
  if (resolvedGaClientId) keys.push(resolvedGaClientId);

  const saveKeys = uniqKeys(keys);

  logToConsole("SORTOWNIA: Multi-key write, klucze:", saveKeys);
  logToConsole(
    "SORTOWNIA: Multi-key write: PUT pod",
    saveKeys.length,
    "kluczy (primary:",
    saveKeys[0] + ", pozostałe:",
    saveKeys.length - 1 + ")"
  );

  // ✅ DEBUG: Loguj które klucze są nowe (pojawiły się pierwszy raz w evencie)
  // Sprawdź w existing (jeśli istnieje) - dla processExistingProfile
  // Dla processNewProfile wszystkie klucze są nowe (już zalogowane wyżej)

  // Zapisz pod pierwszym kluczem (idOid - najważniejszy)
  const primaryKey = saveKeys[0];
  const encodedPrimaryKey = encodeUriComponent(primaryKey);
  const saveIdentityUrl =
    API_BASE + "/identity_map/documents/" + encodedPrimaryKey;

  logToConsole(
    "SORTOWNIA: Zapisuję Identity Map (primary key:",
    primaryKey,
    ")..."
  );

  sendHttpRequest(
    saveIdentityUrl,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
    JSON.stringify(fullProfileData)
  )
    .then(function (saveIdentityResponse) {
      logToConsole(
        "SORTOWNIA: ✅ Identity saved (primary key:",
        primaryKey,
        "), status =",
        saveIdentityResponse.statusCode
      );

      // Best-effort: zapisz pod pozostałymi kluczami (jeśli są)
      let keyIdx = 1;
      while (keyIdx < saveKeys.length) {
        const nextKey = saveKeys[keyIdx];
        const encodedNextKey = encodeUriComponent(nextKey);
        const saveNextUrl =
          API_BASE + "/identity_map/documents/" + encodedNextKey;

        sendHttpRequest(
          saveNextUrl,
          { method: "PUT", headers: { "Content-Type": "application/json" } },
          JSON.stringify(fullProfileData)
        )
          .then(function (response) {
            logToConsole(
              "SORTOWNIA: ✅ Identity saved (key:",
              nextKey,
              "), status =",
              response.statusCode
            );
          })
          .catch(function (err) {
            logToConsole(
              "SORTOWNIA: ⚠️ Identity error (key:",
              nextKey,
              "):",
              err,
              "(best-effort, kontynuuję)"
            );
          });

        keyIdx = keyIdx + 1;
      }

      // KROK 3: Zapisz task_queue
      const taskId = idOid + "_" + timestamp + "_" + eventName;
      const srcActionSource =
        getEventDataWithFallback("src_action_source") || "website";
      const consentAnalytics = getEventDataWithFallback(
        "consent_analytics_storage"
      );
      const consentAd = getEventDataWithFallback("consent_ad_storage");
      var taskEnvironment =
        getEventDataWithFallback("environment") ||
        getEventDataWithFallback("runtime_environment") ||
        "prod";
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
        ctx_ip_address: ctxIpAddress || null, // ✅ DODANO: dla Meta CAPI + arkusz
        ctx_referrer: ctxReferrer || null, // ✅ DODANO: dla analizy (opcjonalne)
        ctx_time_on_page_ms:
          ctxTimeOnPageMs !== undefined && ctxTimeOnPageMs !== null
            ? makeString(ctxTimeOnPageMs)
            : null, // ✅ Czas na stronie (jak w mailu)
        biz_message: bizMessage || null, // ✅ Treść wiadomości (jak w mailu)
        // ✅ Używamy resolvedGaClientId (event ?? profil) — kluczowe dla CRM (qualify_lead/purchase),
        // które nie znają cookie _ga, ale chcemy aby robot wysłał do GA4 MP ten sam client_id
        // co Web GTM dla generate_lead (sklejanie lejka w GA4).
        ga_client_id: resolvedGaClientId,
        owner: taskOwner, // last click (przy SKIP) lub first touch (nowy Akt)
        order_id: orderId,
        src_system: srcSystem, // ✅ Dodano zgodnie z SSOT
        src_action_source: srcActionSource, // ✅ Dodano zgodnie z SSOT
        consent_analytics_storage: consentAnalytics || null, // ✅ Consent Gate dla GA4
        consent_ad_storage: consentAd || null, // ✅ Consent Gate dla Google/Meta Ads
      };

      const encodedTaskId = encodeUriComponent(taskId);
      const saveTaskUrl = API_BASE + "/task_queue/documents/" + encodedTaskId;

      logToConsole("SORTOWNIA: Zapisuję task...");

      sendHttpRequest(
        saveTaskUrl,
        { method: "PUT", headers: { "Content-Type": "application/json" } },
        JSON.stringify(taskData)
      )
        .then(function (saveTaskResponse) {
          logToConsole(
            "SORTOWNIA: ✅ Task saved, status =",
            saveTaskResponse.statusCode
          );
          logToConsole("=== SORTOWNIA + AKT SUKCES ===");
          logToConsole(
            "FINAL: id_oid =",
            idOid,
            ", task owner =",
            taskOwner,
            ", order_id =",
            orderId
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
