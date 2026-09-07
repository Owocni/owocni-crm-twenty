"use strict";

/**
 * Tydzień testów BB: większość leadów → konto holding (owocni@gmail.com),
 * Marta / Gosia / Maciej dostają max N nowych kart dziennie (Europe/Warsaw).
 * Robert (Meta / MARKETING) bez limitu.
 */

const { warsawMinutesSinceMidnight } = require("./leadDispatch");

const RULE_SAMPLE_WEEK_QUOTA = "RULE-SAMPLE-WEEK-QUOTA";
const RULE_SAMPLE_WEEK_HOLDING = "RULE-SAMPLE-WEEK-HOLDING";

function startOfWarsawDayIso(now = new Date()) {
  const { ymd } = warsawMinutesSinceMidnight(now);
  let t = now.getTime();
  for (let i = 0; i < 36 * 60; i++) {
    const w = warsawMinutesSinceMidnight(new Date(t));
    if (w.ymd === ymd && w.minutes === 0) {
      return new Date(t - (t % 60_000)).toISOString();
    }
    if (w.ymd < ymd) {
      return new Date(t + 60_000 - (t % 60_000)).toISOString();
    }
    t -= 60_000;
  }
  return `${ymd}T00:00:00.000Z`;
}

/**
 * Pure decision (count already known).
 * @param {{ ownerId: string|null, routingRule?: string }} assignment
 * @param {{ enabled: boolean, holdingOwnerId: string, quotaOwnerIds: Set<string>, exemptOwnerIds: Set<string>, dailyQuota: number, assignedToday: number }} cfg
 */
function decideSampleWeekOwner(assignment, cfg) {
  if (!cfg.enabled) {
    return { ...assignment, sampleWeek: "off" };
  }

  const ownerId = assignment?.ownerId ? String(assignment.ownerId).trim() : "";
  const base = {
    ...assignment,
    ownerId: ownerId || null,
  };

  if (!ownerId) {
    return {
      ...base,
      ownerId: cfg.holdingOwnerId,
      routingRule: RULE_SAMPLE_WEEK_HOLDING,
      sampleWeek: "holding_unassigned",
    };
  }

  if (cfg.exemptOwnerIds.has(ownerId)) {
    return { ...base, sampleWeek: "exempt" };
  }

  if (!cfg.quotaOwnerIds.has(ownerId)) {
    return {
      ...base,
      ownerId: cfg.holdingOwnerId,
      routingRule: RULE_SAMPLE_WEEK_HOLDING,
      sampleWeek: "holding_outside_quota_pool",
    };
  }

  if (cfg.assignedToday < cfg.dailyQuota) {
    return {
      ...base,
      routingRule: base.routingRule || RULE_SAMPLE_WEEK_QUOTA,
      sampleWeek: "quota",
    };
  }

  return {
    ...base,
    ownerId: cfg.holdingOwnerId,
    routingRule: RULE_SAMPLE_WEEK_HOLDING,
    sampleWeek: "holding_quota_full",
  };
}

module.exports = {
  RULE_SAMPLE_WEEK_QUOTA,
  RULE_SAMPLE_WEEK_HOLDING,
  startOfWarsawDayIso,
  decideSampleWeekOwner,
  warsawMinutesSinceMidnight,
};
