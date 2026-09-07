"use strict";

/**
 * Wake snoozed open opportunities back into „Do odpisania”.
 * ODROCZENIE_DECISION: snoozeUntil <= now AND stage not WON/LOST
 * → isFollowUp = true, snoozeUntil = null.
 */

const {
  twentyRequest,
  parseTwentyListRecords,
  patchTwentyRecord,
  buildTwentyListPath,
} = require("../shared/twentyRest");

const CLOSED_STAGES = new Set(["WON", "LOST"]);

function shouldWakeOpportunity(opp, nowMs) {
  if (!opp?.id) return false;
  if (CLOSED_STAGES.has(String(opp.stage || "").toUpperCase())) return false;
  const until = Date.parse(opp.snoozeUntil || "");
  return Number.isFinite(until) && until <= nowMs;
}

async function listDueSnoozes(nowIso) {
  const path = buildTwentyListPath(
    "opportunities",
    `snoozeUntil[lte]:${nowIso}`,
    Number(process.env.MAX_SNOOZE_WAKE_SCAN || 50),
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(
      `list snooze HTTP ${res.statusCode} ${res.rawBody?.slice?.(0, 300)}`,
    );
  }
  return parseTwentyListRecords("opportunities", res.body);
}

async function runSnoozeWakeWorker() {
  try {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const rows = await listDueSnoozes(nowIso);
    const due = rows.filter((opp) => shouldWakeOpportunity(opp, nowMs));
    const woken = [];

    for (const opp of due) {
      await patchTwentyRecord("opportunities", opp.id, {
        isFollowUp: true,
        snoozeUntil: null,
      });
      woken.push(opp.id);
    }

    return { scanned: rows.length, woken: woken.length, ids: woken };
  } catch (err) {
    console.error("snoozeWake ERROR", err);
    return { error: err.message, scanned: 0, woken: 0, ids: [] };
  }
}

module.exports = {
  shouldWakeOpportunity,
  runSnoozeWakeWorker,
};
