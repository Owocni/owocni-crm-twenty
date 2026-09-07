"use strict";

/**
 * Retired 2026-09-04 — Lead Dispatcher v2.0 helpers kept as inactive archive.
 * Production assignment is COPY → Maciej + idOid hash in createLead.js.
 * sampleWeekRouting still uses warsawMinutesSinceMidnight.
 *
 * Spec (archive): integrations/runbooks/LEAD_DISPATCHER_PLAN.md
 */

const TIME_ON_PAGE_HOT_MS = 360_000;
const FAILOVER_MS = {
  HOT_FIT: 15 * 60 * 1000,
  STANDARD: 30 * 60 * 1000,
  LOW_INTENT: 2 * 60 * 60 * 1000,
};
const ESCALATE_MS = {
  HOT_FIT: 60 * 60 * 1000,
  STANDARD: 2 * 60 * 60 * 1000,
  LOW_INTENT: 4 * 60 * 60 * 1000,
};
const UNASSIGNED_ALERT_MS = 30 * 60 * 1000;
const MAX_OPEN = 3;
const WORK_START_MIN = 8 * 60;
const WORK_END_MIN = 18 * 60;

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function resolveTimeOnPageMs(taskData) {
  return toNumber(
    taskData?.ctx_time_on_page_ms ||
      taskData?.ctxTimeOnPageMs ||
      taskData?.bizTimeOnPageMs ||
      0,
  );
}

function isWebProduct(bizProductTwenty) {
  const p = String(bizProductTwenty || "").toUpperCase();
  return p === "WEB" || p === "STRONY" || p === "STRONA";
}

function isPremium(kanbanFields, answers) {
  if (String(kanbanFields?.bizIntent || "").toUpperCase() === "EKSPERT") {
    return true;
  }
  const quality = String(
    answers?.strona_jaka ||
      answers?.logo_jaka ||
      answers?.logo_jakie ||
      answers?.nazwa_jaka ||
      "",
  ).toLowerCase();
  return quality === "premium";
}

function isRedesign(kanbanFields) {
  return String(kanbanFields?.bizProjectType || "").toUpperCase() === "REDESIGN";
}

function isCompanyOwnerRole(kanbanFields) {
  return String(kanbanFields?.bizContactRole || "").toUpperCase() === "OWNER";
}

/**
 * @returns {"HOT_FIT"|"STANDARD"|"LOW_INTENT"}
 */
function classifyLeadIntent({
  bizProductTwenty,
  kanbanFields,
  answers,
  taskData,
  hasFormData,
}) {
  const timeMs = resolveTimeOnPageMs(taskData);
  const web = isWebProduct(bizProductTwenty);
  const premium = isPremium(kanbanFields, answers);
  const redesign = isRedesign(kanbanFields);
  const ownerRole = isCompanyOwnerRole(kanbanFields);
  const hotTime = timeMs > TIME_ON_PAGE_HOT_MS;

  if (web && redesign && premium && hotTime) return "HOT_FIT";
  if (web) return "STANDARD";
  if (!web && ownerRole && premium && hotTime) return "STANDARD";

  if (hasFormData === false || hasFormData === undefined) {
    // bare mail / no answers — default STANDARD
    const answersEmpty =
      !answers ||
      (typeof answers === "object" && Object.keys(answers).length === 0);
    if (answersEmpty && !web && !kanbanFields?.bizIntent) {
      return "STANDARD";
    }
  }

  if (!web && bizProductTwenty) return "LOW_INTENT";
  return "STANDARD";
}

function failoverMsForClass(intentClass) {
  return FAILOVER_MS[intentClass] || FAILOVER_MS.STANDARD;
}

function escalateMsForClass(intentClass) {
  return ESCALATE_MS[intentClass] || ESCALATE_MS.STANDARD;
}

/** Minutes from midnight in Europe/Warsaw (approx via UTC+offset from env or +2). */
function warsawMinutesSinceMidnight(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  );
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return {
    minutes: hour * 60 + minute,
    weekday: String(parts.weekday || "").slice(0, 3),
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function parseHolidaySet(raw) {
  const set = new Set();
  for (const part of String(raw || "").split(",")) {
    const d = part.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) set.add(d);
  }
  return set;
}

function isWorkInstant(date, holidaySet) {
  const { minutes, weekday, ymd } = warsawMinutesSinceMidnight(date);
  if (holidaySet && holidaySet.has(ymd)) return false;
  if (weekday === "Sat" || weekday === "Sun") return false;
  return minutes >= WORK_START_MIN && minutes < WORK_END_MIN;
}

/**
 * Business-ms elapsed between fromIso and toDate inside work window.
 * Day-stepped (O(days)), not minute-stepped — minute loops hang on old leads.
 */
function businessElapsedMs(fromIso, toDate = new Date(), holidayRaw = "") {
  const from = Date.parse(fromIso || "");
  const to = toDate instanceof Date ? toDate.getTime() : Date.parse(toDate);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;
  const holidays = parseHolidaySet(holidayRaw);

  // Walk Warsaw calendar days via noon UTC anchors (~safe for CET/CEST).
  const fromParts = warsawMinutesSinceMidnight(new Date(from));
  const toParts = warsawMinutesSinceMidnight(new Date(to));
  let elapsed = 0;

  // Iterate at most ~400 days (safety)
  let cursor = new Date(`${fromParts.ymd}T12:00:00Z`);
  const endAnchor = new Date(`${toParts.ymd}T12:00:00Z`);
  let guard = 0;
  while (cursor.getTime() <= endAnchor.getTime() + 12 * 3600 * 1000 && guard < 400) {
    guard += 1;
    const dayInfo = warsawMinutesSinceMidnight(cursor);
    const ymd = dayInfo.ymd;
    const isWorkDay =
      dayInfo.weekday !== "Sat" &&
      dayInfo.weekday !== "Sun" &&
      !(holidays && holidays.has(ymd));

    if (isWorkDay) {
      // Work window as ms-from-midnight Warsaw
      let winStart = WORK_START_MIN;
      let winEnd = WORK_END_MIN;
      if (ymd === fromParts.ymd) {
        winStart = Math.max(winStart, fromParts.minutes);
      }
      if (ymd === toParts.ymd) {
        winEnd = Math.min(winEnd, toParts.minutes);
      }
      if (winEnd > winStart) {
        elapsed += (winEnd - winStart) * 60 * 1000;
      }
    }

    if (ymd === toParts.ymd) break;
    cursor = new Date(cursor.getTime() + 24 * 3600 * 1000);
  }
  return elapsed;
}

function isInsideWorkWindowNow(holidayRaw = "") {
  return isWorkInstant(new Date(), parseHolidaySet(holidayRaw));
}

/**
 * Hard-route + pool rule id (without continuity / least-loaded).
 *
 * Meta (FACEBOOK):
 * - empty allowlist + interim → cały FB→Robert (RULE-META-INTERIM)
 * - campaign_id (lub form_id) na liście Piotra → Robert (RULE-META-R01)
 * - poza listą → pula / COPY (NIE RULE-MKTG — marketing Meta = tylko lista kampanii)
 */
function resolveRoutingRuleId({
  bizProductTwenty,
  bizSource,
  mailboxOwnerId,
  metaFormId,
  metaCampaignId,
  metaAllowlist,
  metaInterimAllFacebook,
}) {
  if (mailboxOwnerId) return { ruleId: "RULE-MAILBOX", ownerHint: mailboxOwnerId };

  const source = String(bizSource || "").toUpperCase();
  const product = String(bizProductTwenty || "").toUpperCase();
  const allow = Array.isArray(metaAllowlist) ? metaAllowlist.filter(Boolean) : [];
  const formId = String(metaFormId || "").trim();
  const campaignId = String(metaCampaignId || "").trim();

  if (source === "FACEBOOK") {
    if (allow.length === 0 && metaInterimAllFacebook) {
      return { ruleId: "RULE-META-INTERIM", ownerHint: "robert" };
    }
    if (
      (campaignId && allow.includes(campaignId)) ||
      (formId && allow.includes(formId))
    ) {
      return { ruleId: "RULE-META-R01", ownerHint: "robert" };
    }
    // Meta spoza listy Piotra = inne produkty → COPY lub pula (nie marketing→Robert)
    if (product === "COPYWRITING") {
      return { ruleId: "RULE-COPY-01", ownerHint: "maciej" };
    }
    return { ruleId: "RULE-POOL-DEFAULT", ownerHint: null };
  }

  if (product === "MARKETING") {
    return { ruleId: "RULE-MKTG-01", ownerHint: "robert" };
  }
  if (product === "COPYWRITING") {
    return { ruleId: "RULE-COPY-01", ownerHint: "maciej" };
  }

  return { ruleId: "RULE-POOL-DEFAULT", ownerHint: null };
}

/**
 * Pick least-loaded pool member.
 * @param {Array<{id:string, openCount:number, lastAssignedAt?:string|null, vacation?:boolean}>} candidates
 */
function pickLeastLoaded(candidates, maxOpen = MAX_OPEN) {
  const available = (candidates || []).filter(
    (c) => c && c.id && !c.vacation && (c.openCount || 0) < maxOpen,
  );
  if (!available.length) return null;
  available.sort((a, b) => {
    const oc = (a.openCount || 0) - (b.openCount || 0);
    if (oc !== 0) return oc;
    const ta = Date.parse(a.lastAssignedAt || "") || 0;
    const tb = Date.parse(b.lastAssignedAt || "") || 0;
    return ta - tb;
  });
  return available[0].id;
}

function otherPoolMember(poolIds, currentOwnerId) {
  const cur = String(currentOwnerId || "");
  return (poolIds || []).find((id) => id && id !== cur) || null;
}

module.exports = {
  TIME_ON_PAGE_HOT_MS,
  FAILOVER_MS,
  ESCALATE_MS,
  UNASSIGNED_ALERT_MS,
  MAX_OPEN,
  resolveTimeOnPageMs,
  classifyLeadIntent,
  failoverMsForClass,
  escalateMsForClass,
  businessElapsedMs,
  isInsideWorkWindowNow,
  resolveRoutingRuleId,
  pickLeastLoaded,
  otherPoolMember,
  parseHolidaySet,
  isWorkInstant,
  warsawMinutesSinceMidnight,
};
