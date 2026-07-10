"use strict";

const {
  CREATE_LEAD_BUILD_ID,
  getOwnerIds,
  isCreateLeadWriteEnabled,
  MAX_CREATE_LEAD_TASKS,
  PENDING_WRITE_TTL_MS,
} = require("../shared/config");
const {
  fetchPendingTasksByJobType,
  putTaskDocument,
  putTwentyStateDocument,
  setPendingWrite,
  clearPendingWrite,
} = require("../shared/stapeStore");
const {
  twentyRequest,
  extractCreatedId,
  findPersonByEmail,
  findOpportunityByIdOid,
  patchTwentyRecord,
} = require("../shared/twentyRest");

const ADAPTER_ID = "crm:twenty_create_lead";

function getWriteAudit() {
  return {
    buildId: CREATE_LEAD_BUILD_ID,
    templateWrite: isCreateLeadWriteEnabled(),
    eventWriteFlag: "",
    writeEnabled: isCreateLeadWriteEnabled(),
  };
}

function mapBizProductToTwenty(slug) {
  if (!slug) return "INNE";
  const s = String(slug).toLowerCase().trim();
  if (s === "strony" || s === "strona" || s === "web") return "WEB";
  if (s === "logo") return "LOGO";
  if (s === "nazwa" || s === "naming" || s === "nazwy") return "NAME";
  if (
    s === "copywriting" ||
    s === "nazwa/teksty" ||
    s === "nazwa/tekst" ||
    s === "teksty"
  ) {
    return "COPYWRITING";
  }
  if (s.includes("nazwa") && s.includes("tekst")) return "COPYWRITING";
  if (s === "opakowanie" || s === "packaging") return "OPAKOWANIE";
  if (s === "marketing" || s === "strategia" || s === "konsultacje") {
    return "MARKETING";
  }
  const upper = String(slug).toUpperCase().trim();
  const allowed = [
    "WEB",
    "LOGO",
    "NAME",
    "MARKETING",
    "COPYWRITING",
    "OPAKOWANIE",
    "INNE",
  ];
  return allowed.includes(upper) ? upper : "INNE";
}

function normalizeBizProductSlug(product) {
  let s = String(product || "")
    .toLowerCase()
    .trim();
  if (!s || s === "kontakt" || s === "main") return "";
  if (s === "strona") return "strony";
  if (s === "nazwa/teksty" || s === "nazwa/tekst" || s === "teksty") {
    return "copywriting";
  }
  return s;
}

function inferBizProductFromUrl(url) {
  url = String(url || "").toLowerCase();
  if (!url) return "";
  if (url.includes("projektowanie-logo") || url.includes("/logo")) return "logo";
  if (
    url.includes("tworzenie-stron") ||
    url.includes("strony.owocni") ||
    url.includes("/strony")
  ) {
    return "strony";
  }
  if (url.includes("copywriting")) return "copywriting";
  if (url.includes("nazwa") || url.includes("naming")) return "copywriting";
  if (url.includes("strategia") || url.includes("konsultacje")) return "marketing";
  return "";
}

function stripHtmlTags(text) {
  let out = "";
  let inTag = false;
  for (const ch of text) {
    if (ch === "<") inTag = true;
    else if (ch === ">") inTag = false;
    else if (!inTag) out += ch;
  }
  return out;
}

function collapseWhitespace(text) {
  let out = "";
  let prevSpace = false;
  for (const ch of text) {
    const isSpace = ch === " " || ch === "\n" || ch === "\r" || ch === "\t";
    if (isSpace) {
      if (!prevSpace) {
        out += " ";
        prevSpace = true;
      }
    } else {
      out += ch;
      prevSpace = false;
    }
  }
  return out;
}

function legacyMailBlob(taskData) {
  let s = String(taskData.biz_message || taskData.description || "");
  s = s
    .split("<br>")
    .join("\n")
    .split("<br/>")
    .join("\n")
    .split("<br />")
    .join("\n")
    .split("<BR>")
    .join("\n")
    .split("&nbsp;")
    .join(" ");
  s = collapseWhitespace(stripHtmlTags(s));
  return s.toLowerCase().trim();
}

function parseLegacyMailSection(blob, label) {
  const idx = blob.indexOf(label);
  if (idx < 0) return "";
  return blob.substring(idx + label.length, idx + label.length + 120).trim();
}

function enrichAnswersFromLegacyContent(taskData, answers) {
  const blob = legacyMailBlob(taskData);
  if (!blob) return answers;
  if (blob.includes("zapytanie dla strony")) answers._legacy_product = "strony";
  else if (blob.includes("zapytanie dla nazwa")) answers._legacy_product = "copywriting";
  else if (blob.includes("zapytanie dla logo")) answers._legacy_product = "logo";
  else if (blob.includes("zapytanie dla marketingu")) answers._legacy_product = "marketing";

  const etapFirmy = parseLegacyMailSection(blob, "etap firmy:");
  if (etapFirmy) {
    if (
      etapFirmy.includes("odświeżamy") ||
      etapFirmy.includes("odswiezamy") ||
      etapFirmy.includes("odswiezamy marke")
    ) {
      answers.strona_ma = answers.strona_ma || "existing";
      answers.logo_ma = answers.logo_ma || "existing";
      answers.nazwa_ma = answers.nazwa_ma || "existing";
    } else if (
      etapFirmy.includes("pierwszy biznes") ||
      etapFirmy.includes("nowa strona dla nowej firmy") ||
      etapFirmy.includes("marka będzie nowa") ||
      etapFirmy.includes("marka bedzie nowa") ||
      etapFirmy.includes("nowa marka")
    ) {
      answers.strona_ma = answers.strona_ma || "new";
      answers.logo_ma = answers.logo_ma || "new";
      answers.nazwa_ma = answers.nazwa_ma || "new";
    }
  }

  const typPlanu = parseLegacyMailSection(blob, "typ planu:");
  if (typPlanu) {
    if (typPlanu.includes("najtańsza") || typPlanu.includes("najtansza")) {
      answers.strona_jaka = answers.strona_jaka || "basic";
      answers.logo_jaka = answers.logo_jaka || "basic";
      answers.nazwa_jaka = answers.nazwa_jaka || "basic";
    } else if (
      typPlanu.includes("rozszerzona") ||
      typPlanu.includes("strategiczna") ||
      typPlanu.includes("rozwojowy")
    ) {
      answers.strona_jaka = answers.strona_jaka || "premium";
      answers.logo_jaka = answers.logo_jaka || "premium";
      answers.nazwa_jaka = answers.nazwa_jaka || "premium";
    }
  }

  if (
    blob.includes("nowa strona dla nowej firmy") ||
    blob.includes("nowa marka") ||
    blob.includes("pierwsza działalność") ||
    blob.includes("pierwsza dzialalnosc")
  ) {
    answers.strona_ma = answers.strona_ma || "new";
    answers.logo_ma = answers.logo_ma || "new";
    answers.nazwa_ma = answers.nazwa_ma || "new";
  }
  if (blob.includes("istniej") && blob.includes("stron")) {
    answers.strona_ma = "existing";
  }
  if (blob.includes("ekspert") || blob.includes("chce eksperta")) {
    answers.strona_jaka = answers.strona_jaka || "premium";
    answers.nazwa_jaka = answers.nazwa_jaka || "premium";
  } else if (
    blob.includes("najtańsza") ||
    blob.includes("najtansza") ||
    blob.includes("szuka czegoś taniego") ||
    blob.includes("szuka czegos taniego")
  ) {
    answers.strona_jaka = answers.strona_jaka || "basic";
    answers.nazwa_jaka = answers.nazwa_jaka || "basic";
  }
  const specIdx = blob.indexOf("specjalizacja:");
  if (specIdx >= 0) {
    const spec = blob.substring(specIdx, specIdx + 48);
    if (spec.includes("online")) answers.strona_model = answers.strona_model || "online";
    else if (spec.includes("b2b")) answers.strona_model = answers.strona_model || "b2b";
    else if (spec.includes("local") || spec.includes("lokal")) {
      answers.strona_model = answers.strona_model || "local";
    } else if (spec.includes("ecommerce") || spec.includes("sklep")) {
      answers.strona_model = answers.strona_model || "ecommerce";
    }
  }
  if (!answers.recipient) {
    const roleIdx = blob.indexOf("role:");
    if (roleIdx >= 0) {
      answers.recipient = blob.substring(roleIdx + 5, roleIdx + 120);
    }
  }
  if (!answers.phone) {
    const extracted = extractPhoneFromText(blob);
    if (extracted) answers.phone = extracted;
  }
  return answers;
}

function normalizePhoneDigits(digits) {
  const d = String(digits || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 9) return "+48" + d;
  if (d.length === 11 && d.startsWith("48")) return "+" + d;
  if (d.length >= 10 && d.length <= 15) return "+" + d;
  return "";
}

function extractPhoneFromText(text) {
  const s = String(text || "").toLowerCase();
  if (!s) return "";
  const markers = ["telefon:", "phone:", "tel:"];
  for (const marker of markers) {
    const idx = s.indexOf(marker);
    if (idx >= 0) {
      const chunk = s.substring(idx + marker.length, idx + marker.length + 24);
      const quoted = chunk.match(/["']?\s*([+\d][\d\s\-()]{6,18})/);
      const raw = quoted ? quoted[1] : chunk;
      const digits = raw.replace(/\D/g, "");
      const normalized = normalizePhoneDigits(digits);
      if (normalized) return normalized;
    }
  }
  const telIdx = s.indexOf("telefon");
  if (telIdx >= 0) {
    const chunk = s.substring(telIdx, telIdx + 32);
    const digits = chunk.replace(/\D/g, "");
    const normalized = normalizePhoneDigits(digits);
    if (normalized) return normalized;
  }
  return "";
}

function pickPhoneFromAnswers(answers) {
  if (!answers || typeof answers !== "object") return "";
  const keys = [
    "phone",
    "tel",
    "telefon",
    "phone_number",
    "mobile",
    "numer_telefonu",
  ];
  for (const key of keys) {
    const value = String(answers[key] || "").trim();
    if (value) return value;
  }
  return "";
}

function resolveTaskPhone(taskData, answers) {
  const fromAnswers = pickPhoneFromAnswers(answers);
  const fromTask =
    taskData.biz_phone ||
    taskData.phone ||
    taskData.telefon ||
    taskData.tel ||
    taskData.phone_number ||
    "";
  const fromMessage = extractPhoneFromText(
    taskData.biz_message || taskData.description || "",
  );
  return String(fromTask || fromAnswers || fromMessage || "").trim();
}

function parseFormAnswers(taskData) {
  let answers = {};
  const raw =
    taskData.biz_form_answers ||
    taskData.form_answers ||
    taskData.answers ||
    null;
  if (raw) {
    if (typeof raw === "object") {
      answers = { ...raw };
    } else {
      let s = String(raw).trim();
      if (s.length >= 2) {
        if (s.charAt(0) === '"') s = JSON.parse(s);
        if (typeof s === "string" && s.charAt(0) === "{") {
          const parsed = JSON.parse(s);
          if (parsed && typeof parsed === "object") answers = parsed;
        } else if (typeof s === "object" && s) {
          answers = s;
        }
      }
    }
  }
  if (!answers.recipient) {
    const topRecipient = String(taskData.recipient || "").trim();
    if (topRecipient) answers.recipient = topRecipient;
  }
  return enrichAnswersFromLegacyContent(taskData, answers);
}

function resolveEffectiveBizProductSlug(taskData, answers) {
  let slug = normalizeBizProductSlug(
    taskData.biz_form_product ||
      taskData.biz_product ||
      answers._legacy_product ||
      "",
  );
  if (slug) return slug;
  slug =
    inferBizProductFromUrl(taskData.ctx_landing_page_url) ||
    inferBizProductFromUrl(taskData.ctx_page_url);
  return slug || normalizeBizProductSlug(taskData.biz_product);
}

function resolveTwentyBizProduct(taskData, answers) {
  return mapBizProductToTwenty(resolveEffectiveBizProductSlug(taskData, answers));
}

function resolveOpportunityOwnerId(bizProductTwenty, idOid) {
  const owners = getOwnerIds();
  if (bizProductTwenty === "COPYWRITING") return owners.maciej;
  let hash = 0;
  const s = String(idOid);
  for (let i = 0; i < s.length; i++) hash += s.charCodeAt(i);
  return hash % 2 === 0 ? owners.gosia : owners.marta;
}

function mapBizSource(taskData) {
  if (isLeadsAtEmailTask(taskData)) return "DIRECT_EMAIL";

  const utmSource = String(taskData.attr_utm_source || "").toLowerCase();
  const utmMedium = String(taskData.attr_utm_medium || "").toLowerCase();

  if (
    taskData.attr_gclid ||
    utmSource.includes("google") ||
    utmSource.includes("gclid")
  ) {
    return "GOOGLE";
  }
  if (
    taskData.attr_fbclid ||
    utmSource.includes("facebook") ||
    utmSource.includes("fb") ||
    utmSource.includes("meta") ||
    utmMedium.includes("facebook")
  ) {
    return "FACEBOOK";
  }

  const src = String(taskData.src_action_source || "").toLowerCase();
  if (src === "referral" || src === "polecenie") return "REFERRAL";

  if (String(taskData.src_system || "").trim() === "TWENTY_UI") {
    return "MANUAL";
  }

  if (
    hasFormKanbanContext(taskData) ||
    String(taskData.event_name || "").trim() === "generate_lead"
  ) {
    return "ORGANIC";
  }

  if (utmSource || utmMedium || taskData.attr_gclid || taskData.attr_fbclid) {
    return "OTHER";
  }

  return "UNKNOWN";
}

function splitFullName(full) {
  full = String(full || "").trim();
  if (!full) return { firstName: "Lead", lastName: "Formularz" };
  const space = full.indexOf(" ");
  if (space < 0) return { firstName: full, lastName: "" };
  return {
    firstName: full.substring(0, space),
    lastName: full.substring(space + 1),
  };
}

function resolveInboundChannel(taskData) {
  const channel = String(taskData.inbound_channel || "").trim();
  if (channel) return channel;
  if (String(taskData.src_system || "").trim() === "TWENTY_EMAIL") {
    return "leads_at";
  }
  return "";
}

function hasFormKanbanContext(taskData) {
  const answers = parseFormAnswers(taskData);
  if (
    answers.strona_jaka ||
    answers.logo_jakie ||
    answers.strona_ma ||
    answers.logo_ma ||
    answers.strona_cena
  ) {
    return true;
  }
  if (String(taskData.biz_form_answers || "").trim()) return true;
  if (String(taskData.biz_form_product || "").trim()) return true;
  if (String(taskData.biz_message || "").trim()) return true;
  if (
    String(taskData.event_name || "").trim() === "generate_lead" &&
    String(taskData.biz_product || "").trim() &&
    String(taskData.biz_product || "").toLowerCase() !== "web"
  ) {
    return true;
  }
  return false;
}

function isLeadsAtEmailTask(taskData) {
  return (
    resolveInboundChannel(taskData) === "leads_at" ||
    String(taskData.src_system || "") === "TWENTY_EMAIL" ||
    String(taskData.src_action_source || "") === "leads_at_email_sync"
  );
}

function isFormOriginTask(taskData) {
  if (isLeadsAtEmailTask(taskData)) return false;
  return hasFormKanbanContext(taskData);
}

function sortCreateLeadTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const aData = a.data || {};
    const bData = b.data || {};
    const aForm = isFormOriginTask(aData) ? 0 : isLeadsAtEmailTask(aData) ? 2 : 1;
    const bForm = isFormOriginTask(bData) ? 0 : isLeadsAtEmailTask(bData) ? 2 : 1;
    if (aForm !== bForm) return aForm - bForm;
    return Number(aData.created_at || 0) - Number(bData.created_at || 0);
  });
}

function hasPendingFormSiblingTask(task, allPending) {
  const taskData = task.data || {};
  const idOid = String(taskData.id_oid || "").trim();
  if (!idOid || !isLeadsAtEmailTask(taskData)) return false;
  return allPending.some((other) => {
    if (other.key === task.key) return false;
    if (String(other.data?.id_oid || "").trim() !== idOid) return false;
    if (String(other.data?.status || "pending") !== "pending") return false;
    return isFormOriginTask(other.data || {});
  });
}

function resolveSrcSystem(taskData) {
  if (hasFormKanbanContext(taskData)) return "OWOCNI_SORTOWNIA";
  if (resolveInboundChannel(taskData) === "leads_at") return "TWENTY_EMAIL";
  return "OWOCNI_SORTOWNIA";
}

function resolveBizSourceForTask(taskData) {
  return mapBizSource(taskData);
}

function productLabelForName(taskData) {
  const answers = parseFormAnswers(taskData);
  const slug = resolveEffectiveBizProductSlug(taskData, answers);
  if (slug === "strony" || slug === "strona" || slug === "web") return "Strona";
  if (slug === "logo") return "Logo";
  if (slug === "nazwy" || slug === "nazwa" || slug === "naming") return "Naming";
  if (slug === "marketing") return "Marketing";
  if (slug === "copywriting") return "Copywriting";
  const mapped = mapBizProductToTwenty(slug || taskData.biz_product);
  if (mapped === "WEB") return "Strona";
  if (mapped === "LOGO") return "Logo";
  if (mapped === "NAME") return "Naming";
  if (mapped === "MARKETING") return "Marketing";
  if (mapped === "COPYWRITING") return "Copywriting";
  return "";
}

function deriveProjectType(answers) {
  const hasExisting =
    answers.strona_ma === "existing" ||
    answers.logo_ma === "existing" ||
    answers.nazwa_ma === "existing";
  const isNew =
    answers.strona_ma === "new" ||
    answers.logo_ma === "new" ||
    answers.nazwa_ma === "new";
  if (hasExisting) return { api: "REDESIGN", label: "Redesign" };
  if (isNew) return { api: "NEW", label: "Nowe" };
  return null;
}

function deriveIntent(answers) {
  const quality =
    answers.strona_jaka ||
    answers.logo_jakie ||
    answers.nazwa_jaka ||
    answers.marketing_jaka ||
    null;
  if (quality === "basic") return { api: "CENNIK", label: "Cennik" };
  if (quality === "premium") return { api: "EKSPERT", label: "Ekspert" };
  return null;
}

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isNaN(value) ? 0 : value;
  const n = parseInt(String(value).trim(), 10);
  return Number.isNaN(n) ? 0 : n;
}

function formatPlnAmount(value) {
  const n = Math.round(toNumber(value));
  if (n <= 0) return "";
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " PLN";
}

function deriveValueRange(answers, taskData) {
  const budgetKey = answers.strona_cena || answers.marketing_budzet || null;
  if (budgetKey === "4-10k") return { min: 4000, max: 10000 };
  if (budgetKey === "10-25k") return { min: 10000, max: 25000 };
  if (budgetKey === "25k+") return { min: 25000, max: null };
  if (budgetKey === "unknown") return { min: null, max: null, unknown: true };
  const explicitMin = taskData.biz_value_min || taskData.biz_valueMin;
  const explicitMax = taskData.biz_value_max || taskData.biz_valueMax;
  if (explicitMin || explicitMax) {
    return {
      min: explicitMin ? toNumber(explicitMin) : null,
      max: explicitMax ? toNumber(explicitMax) : null,
    };
  }
  const single = taskData.biz_value;
  if (single) {
    const v = toNumber(single);
    if (v > 0) return { min: v, max: v };
  }
  return { min: null, max: null };
}

function buildValueDisplay(range, fixedAmountMicros) {
  if (fixedAmountMicros && fixedAmountMicros > 0) {
    return formatPlnAmount(fixedAmountMicros / 1_000_000);
  }
  if (!range) return "0 PLN";
  if (range.unknown) return "Do ustalenia";
  if (range.min && range.max && range.min !== range.max) {
    return `${formatPlnAmount(range.min)} – ${formatPlnAmount(range.max)}`;
  }
  if (range.min && !range.max) return `od ${formatPlnAmount(range.min)}`;
  if (range.min) return formatPlnAmount(range.min);
  return "0 PLN";
}

function buildTwentyCurrency(amountPln) {
  const n = Math.max(0, toNumber(amountPln));
  return { amountMicros: Math.round(n * 1_000_000), currencyCode: "PLN" };
}

function formatTimeOnPageDisplay(taskData) {
  const ms = toNumber(
    taskData.ctx_time_on_page_ms || taskData.ctxTimeOnPageMs || 0,
  );
  if (ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0 && sec > 0) return `${min} min ${sec} s`;
  if (min > 0) return `${min} min`;
  return `${sec} s`;
}

function deriveDeviceType(taskData) {
  const ua = String(taskData.ctx_user_agent || "").toLowerCase();
  if (!ua) return null;
  if (ua.includes("ipad")) return "TABLET";
  if (ua.includes("tablet") && !ua.includes("mobile")) return "TABLET";
  if (
    ua.includes("mobile") ||
    ua.includes("iphone") ||
    ua.includes("android")
  ) {
    return "MOBILE";
  }
  if (
    ua.includes("windows") ||
    ua.includes("macintosh") ||
    ua.includes("linux") ||
    ua.includes("cros")
  ) {
    return "DESKTOP";
  }
  return "OTHER";
}

function normalizeRecipientToken(value) {
  const token = String(value || "")
    .toLowerCase()
    .trim();
  if (!token) return "";
  if (
    token === "board" ||
    token.includes("przeloz") ||
    token.includes("przełoż") ||
    token.includes("decyzj")
  ) {
    return "board";
  }
  if (
    token === "me" ||
    token.includes("wlasciciel") ||
    token.includes("właściciel") ||
    token.includes("budzet") ||
    token.includes("budżet") ||
    token.includes("dla mnie")
  ) {
    return "me";
  }
  return "";
}

function deriveContactRole(answers) {
  const recipient = normalizeRecipientToken(answers.recipient);
  if (recipient === "board") return "BOARD";
  if (recipient === "me") return "OWNER";
  return null;
}

function deriveBusinessModel(answers) {
  const model = String(answers.strona_model || "").toLowerCase();
  if (model === "b2b") return "B2B";
  if (model === "local") return "LOCAL";
  if (model === "ecommerce") return "ECOMMERCE";
  if (model === "online") return "ONLINE";
  return null;
}

function deriveMailingOptInInitial(taskData) {
  const product = String(
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
  const iso = String(taskData.time_occurred_iso_utc || "").trim();
  if (iso.includes("T")) return iso;
  const runMs = toNumber(taskData.create_lead_run_started_at);
  const createdMs = toNumber(taskData.created_at);
  let useMs = createdMs;
  if (runMs > 0 && createdMs > 0 && runMs - createdMs > 3_600_000) {
    useMs = runMs;
  } else if (runMs > 0 && createdMs <= 0) {
    useMs = runMs;
  } else if (useMs <= 0) {
    useMs = Date.now();
  }
  return new Date(useMs).toISOString();
}

function resolveTaskContactFields(taskData) {
  const answers = parseFormAnswers(taskData);
  const phone = resolveTaskPhone(taskData, answers);
  return {
    email: String(taskData.biz_email || answers.email || "").trim(),
    phone,
    name: String(
      taskData.biz_name || answers.name || answers.first_name || "",
    ).trim(),
  };
}

function formatPhoneForTwenty(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  if (digits.length === 11 && digits.startsWith("48")) {
    const national = digits.slice(2);
    if (national.length !== 9) return null;
    return { primaryPhoneCallingCode: "+48", primaryPhoneNumber: national };
  }
  if (digits.length === 9) {
    return { primaryPhoneCallingCode: "+48", primaryPhoneNumber: digits };
  }
  if (digits.length >= 10 && digits.length <= 15) {
    return { primaryPhoneCallingCode: "+48", primaryPhoneNumber: digits };
  }
  return null;
}

function resolveContactLabel(taskData, answers) {
  const name = String(
    answers.name || taskData.biz_name || answers.first_name || "",
  ).trim();
  if (name) return name;
  const email = String(taskData.biz_email || answers.email || "").trim();
  if (email) {
    const at = email.indexOf("@");
    return at > 0 ? email.substring(0, at) : email;
  }
  const phone = resolveTaskPhone(taskData, answers).trim();
  if (phone) return phone;
  return "Lead";
}

function buildOpportunityName(taskData) {
  if (resolveSrcSystem(taskData) === "TWENTY_EMAIL") {
    const subject = String(
      taskData.biz_subject || taskData.inbound_subject || "",
    ).trim();
    const mailName = String(taskData.biz_name || "").trim();
    const mailEmail = String(taskData.biz_email || "").trim();
    if (subject) return `${subject} — mail leads@`;
    if (mailName) return `${mailName} — mail leads@`;
    if (mailEmail) return `${mailEmail} — mail leads@`;
    return "Lead mail leads@";
  }
  const answers = parseFormAnswers(taskData);
  const segments = [];
  const productLabel = productLabelForName(taskData);
  if (productLabel) segments.push(productLabel);
  const projectType = deriveProjectType(answers);
  if (projectType?.label) segments.push(projectType.label);
  const intent = deriveIntent(answers);
  if (intent?.label) segments.push(intent.label);
  segments.push(resolveContactLabel(taskData, answers));
  if (segments.length === 1 && segments[0] === "Lead") return "Lead formularz";
  return segments.join(" · ");
}

function buildOpportunityKanbanFields(taskData) {
  const answers = parseFormAnswers(taskData);
  const lastContactIso = resolveLastContactIso(taskData);
  const projectType = deriveProjectType(answers);
  const intent = deriveIntent(answers);
  const valueRange = deriveValueRange(answers, taskData);
  const contact = resolveTaskContactFields(taskData);
  const phoneFields = formatPhoneForTwenty(contact.phone);
  let phoneDisplay = contact.phone;
  if (phoneFields?.primaryPhoneNumber) {
    phoneDisplay =
      (phoneFields.primaryPhoneCallingCode || "") + phoneFields.primaryPhoneNumber;
  }
  const fields = {
    lastContactAt: lastContactIso,
    bizLastContactLabel: "Godzin: 0",
    bizValueDisplay: buildValueDisplay(valueRange, 0),
    amount: buildTwentyCurrency(0),
    bizCardEmail: contact.email || null,
    bizCardPhone: phoneDisplay || null,
  };
  if (projectType?.api) fields.bizProjectType = projectType.api;
  if (intent?.api) fields.bizIntent = intent.api;
  if (valueRange?.min) fields.bizValueMin = buildTwentyCurrency(valueRange.min);
  if (valueRange?.max) fields.bizValueMax = buildTwentyCurrency(valueRange.max);
  const timeOnPage = formatTimeOnPageDisplay(taskData);
  if (timeOnPage) fields.bizTimeOnPageDisplay = timeOnPage;
  const deviceType = deriveDeviceType(taskData);
  if (deviceType) fields.bizDeviceType = deviceType;
  const contactRole = deriveContactRole(answers);
  if (contactRole) fields.bizContactRole = contactRole;
  const businessModel = deriveBusinessModel(answers);
  if (businessModel) fields.bizBusinessModel = businessModel;
  fields.bizMailingOptIn = deriveMailingOptInInitial(taskData);
  return fields;
}

async function writeWorkerHeartbeat(audit) {
  await putTwentyStateDocument("create_lead_worker_heartbeat", {
    build_id: audit.buildId,
    template_write: audit.templateWrite,
    event_write_flag: audit.eventWriteFlag,
    write_enabled: audit.writeEnabled,
    runtime: "gcp",
    at: Date.now(),
  });
}

async function writeRunAuditDoc(taskKey, audit, result, errorMsg) {
  let docKey = `create_lead_audit_${encodeURIComponent(String(taskKey))}`;
  if (docKey.length > 180) docKey = docKey.slice(0, 180);
  await putTwentyStateDocument(docKey, {
    task_key: taskKey,
    build_id: audit.buildId,
    template_write: audit.templateWrite,
    event_write_flag: audit.eventWriteFlag,
    write_enabled: audit.writeEnabled,
    result: String(result || ""),
    error: String(errorMsg || ""),
    runtime: "gcp",
    at: Date.now(),
  });
}

async function patchPersonContactFields(personId, taskData) {
  const contact = resolveTaskContactFields(taskData);
  const patch = {};
  const phoneFields = formatPhoneForTwenty(contact.phone);
  if (phoneFields) patch.phones = phoneFields;
  if (contact.email) patch.emails = { primaryEmail: contact.email };
  if (!patch.phones && !patch.emails) return;
  await patchTwentyRecord("people", personId, patch);
}

async function patchPersonIdOid(personId, idOid) {
  await patchTwentyRecord("people", personId, { idOid });
}

async function createPersonRecord(taskData, idOid) {
  const contact = resolveTaskContactFields(taskData);
  const nameParts = splitFullName(contact.name);
  const phoneFields = formatPhoneForTwenty(contact.phone);
  const body = { name: nameParts, idOid };
  if (contact.email) body.emails = { primaryEmail: contact.email };
  if (phoneFields) body.phones = phoneFields;
  const res = await twentyRequest("POST", "/people", body);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`POST people HTTP ${res.statusCode} ${res.rawBody}`);
  }
  const personId = extractCreatedId("people", res.body);
  if (!personId) throw new Error("POST people — brak id w odpowiedzi");
  return personId;
}

async function createOpportunityRecord(taskData, idOid, personId) {
  const answers = parseFormAnswers(taskData);
  const bizProductTwenty = resolveTwentyBizProduct(taskData, answers);
  const kanbanFields = buildOpportunityKanbanFields(taskData);
  const body = {
    name: buildOpportunityName(taskData),
    stage: "NEW",
    idOid,
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
  for (const key of [
    "bizProjectType",
    "bizIntent",
    "bizValueMin",
    "bizValueMax",
    "bizTimeOnPageDisplay",
    "bizDeviceType",
    "bizContactRole",
    "bizBusinessModel",
    "bizMailingOptIn",
  ]) {
    if (kanbanFields[key]) body[key] = kanbanFields[key];
  }
  const res = await twentyRequest("POST", "/opportunities", body);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`POST opportunities HTTP ${res.statusCode} ${res.rawBody}`);
  }
  const oppId = extractCreatedId("opportunities", res.body);
  if (!oppId) throw new Error("POST opportunities — brak id w odpowiedzi");
  return oppId;
}

async function resolveExistingPersonId(taskData, idOid) {
  const existingPersonId = String(
    taskData.existing_person_id || taskData.person_id || "",
  ).trim();
  if (!existingPersonId) return null;
  const res = await twentyRequest("GET", `/people/${encodeURIComponent(existingPersonId)}`);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`GET person HTTP ${res.statusCode}`);
  }
  const person = res.body?.data?.person || {};
  if (!person.id) throw new Error("existing person not found");
  const existingOid = String(person.idOid || "").trim();
  if (existingOid && existingOid !== idOid) {
    throw new Error(
      `Person idOid conflict existing=${existingOid} new=${idOid}`,
    );
  }
  if (!existingOid) await patchPersonIdOid(person.id, idOid);
  await patchPersonContactFields(person.id, taskData);
  return person.id;
}

async function resolveOrCreatePerson(taskData, idOid) {
  const existingId = await resolveExistingPersonId(taskData, idOid);
  if (existingId) return existingId;

  const email = String(taskData.biz_email || "").trim();
  const existingPerson = await findPersonByEmail(email);
  if (existingPerson?.id) {
    const existingOid = existingPerson.idOid || "";
    if (existingOid && existingOid !== idOid) {
      throw new Error(
        `Person email conflict idOid existing=${existingOid} new=${idOid}`,
      );
    }
    if (!existingOid) await patchPersonIdOid(existingPerson.id, idOid);
    await patchPersonContactFields(existingPerson.id, taskData);
    return existingPerson.id;
  }
  return createPersonRecord(taskData, idOid);
}

async function updateTaskFailed(taskKey, taskData, errorMsg, audit) {
  const updated = structuredClone(taskData);
  updated.status = "pending";
  updated.create_lead_last_error = String(errorMsg);
  updated.create_lead_last_attempt_at = Date.now();
  updated.create_lead_build_id = audit.buildId;
  updated.create_lead_template_write = audit.templateWrite;
  updated.create_lead_event_write_flag = audit.eventWriteFlag;
  updated.create_lead_write_enabled = audit.writeEnabled;
  updated.create_lead_runtime = "gcp";
  await putTaskDocument(taskKey, updated);
  await writeRunAuditDoc(taskKey, audit, "failed", errorMsg);
}

async function updateTaskDone(taskKey, taskData, result, audit) {
  const updated = structuredClone(taskData);
  updated.status = "done";
  updated.create_lead_result = result;
  updated.create_lead_completed_at = Date.now();
  updated.create_lead_last_error = "";
  updated.create_lead_build_id = audit.buildId;
  updated.create_lead_template_write = audit.templateWrite;
  updated.create_lead_event_write_flag = audit.eventWriteFlag;
  updated.create_lead_write_enabled = audit.writeEnabled;
  updated.create_lead_runtime = "gcp";
  await putTaskDocument(taskKey, updated);
  await writeRunAuditDoc(taskKey, audit, result, "");
}

async function stampTaskRunMeta(taskKey, taskData, audit) {
  const updated = structuredClone(taskData);
  updated.create_lead_build_id = audit.buildId;
  updated.create_lead_template_write = audit.templateWrite;
  updated.create_lead_event_write_flag = audit.eventWriteFlag;
  updated.create_lead_write_enabled = audit.writeEnabled;
  updated.create_lead_run_started_at = Date.now();
  updated.create_lead_runtime = "gcp";
  await putTaskDocument(taskKey, updated);
}

async function processOneTask(task, audit, allPending) {
  const taskData = task.data || {};
  const idOid = String(taskData.id_oid || "").trim();
  if (!idOid) throw new Error("missing id_oid");

  if (hasPendingFormSiblingTask(task, allPending || [])) {
    console.log("SKIP — form task pending for same id_oid", idOid);
    await updateTaskDone(task.key, taskData, "deferred_form_priority", audit);
    return;
  }

  console.log(
    ADAPTER_ID,
    "task",
    task.key,
    "id_oid=",
    idOid,
    "write=",
    audit.writeEnabled,
    "build=",
    audit.buildId,
    "phone=",
    resolveTaskPhone(taskData, parseFormAnswers(taskData)) || "(brak)",
  );

  try {
    await stampTaskRunMeta(task.key, taskData, audit);
  } catch (err) {
    console.warn("stamp meta warn", err.message);
  }

  if (!audit.writeEnabled) {
    console.log("log_only payload", JSON.stringify(taskData));
    await updateTaskDone(task.key, taskData, "log_only", audit);
    return;
  }

  const existingOpp = await findOpportunityByIdOid(idOid);
  if (existingOpp?.id) {
    console.log("SKIP — Opportunity exists", existingOpp.id);
    await updateTaskDone(task.key, taskData, "already_exists", audit);
    return;
  }

  const personId = await resolveOrCreatePerson(taskData, idOid);
  const oppId = await createOpportunityRecord(taskData, idOid, personId);
  await setPendingWrite(oppId, ADAPTER_ID, PENDING_WRITE_TTL_MS);
  await updateTaskDone(
    task.key,
    taskData,
    `created person=${personId} opp=${oppId}`,
    audit,
  );
  try {
    await clearPendingWrite(oppId, ADAPTER_ID);
  } catch (err) {
    console.warn("pending-write CLEAR warn", err.message);
  }
  console.log("OK", idOid, personId, oppId);
}

async function runCreateLeadWorker() {
  const audit = getWriteAudit();
  console.log("=== create_lead worker (GCP) ===", ADAPTER_ID, audit.buildId);
  await writeWorkerHeartbeat(audit);

  const tasks = await fetchPendingTasksByJobType(
    ADAPTER_ID,
    MAX_CREATE_LEAD_TASKS * 10,
  );
  console.log("pending create_lead tasks:", tasks.length);

  const stats = { processed: 0, failed: 0, skipped: 0 };
  const ordered = sortCreateLeadTasks(tasks);
  const slice = ordered.slice(0, MAX_CREATE_LEAD_TASKS);

  for (const task of slice) {
    try {
      await processOneTask(task, audit, ordered);
      stats.processed += 1;
    } catch (err) {
      stats.failed += 1;
      console.error("create_lead FAIL", task.key, err.message);
      await updateTaskFailed(task.key, task.data || {}, err.message, audit);
    }
  }

  console.log(
    ADAPTER_ID,
    "done processed=",
    stats.processed,
    "failed=",
    stats.failed,
  );
  return stats;
}

module.exports = { runCreateLeadWorker, ADAPTER_ID, mapBizSource, isLeadsAtEmailTask };
