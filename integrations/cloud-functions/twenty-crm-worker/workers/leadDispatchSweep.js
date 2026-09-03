"use strict";

/**
 * Lead Dispatcher sweep — failover / escalate / unassigned.
 * Trigger: POST { action: "lead_dispatch_sweep" } or poll when LEAD_DISPATCHER_SWEEP_ON_POLL=true.
 * Spec: LEAD_DISPATCHER_PLAN.md
 */

const {
  getOwnerIds,
  isLeadDispatcherEnabled,
  isLeadDispatchFailoverEnabled,
  getLeadDispatchPoolIds,
  getLeadDispatchVacationIds,
  getLeadDispatchHolidays,
  getManagerEmail,
} = require("../shared/config");
const {
  failoverMsForClass,
  escalateMsForClass,
  UNASSIGNED_ALERT_MS,
  businessElapsedMs,
  isInsideWorkWindowNow,
  otherPoolMember,
  MAX_OPEN: DISPATCH_MAX_OPEN,
} = require("../shared/leadDispatch");
const {
  twentyRequest,
  parseTwentyListRecords,
  patchTwentyRecord,
  buildTwentyListPath,
} = require("../shared/twentyRest");

function maxOpen() {
  return Number(process.env.LEAD_DISPATCH_MAX_OPEN || DISPATCH_MAX_OPEN || 3);
}

async function sendManagerMail(subject, text) {
  const to = getManagerEmail();
  console.log("LEAD_DISPATCH escalate mail →", to, subject, text.slice(0, 200));
  // v1: log only + optional webhook
  const hook = process.env.LEAD_DISPATCH_MANAGER_WEBHOOK_URL;
  if (!hook) return { logged: true, to };
  try {
    const res = await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, text }),
    });
    return { ok: res.ok, status: res.status, to };
  } catch (err) {
    console.warn("manager webhook failed", err.message);
    return { ok: false, error: err.message, to };
  }
}

async function listNewDispatchOpportunities(limit = 40) {
  const filter = "stage[eq]:NEW";
  let path = buildTwentyListPath("opportunities", filter, limit);
  path += "&order_by=createdAt[AscNullsFirst]";
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`list NEW opps HTTP ${res.statusCode} ${res.rawBody}`);
  }
  return parseTwentyListRecords("opportunities", res.body);
}

async function countOpenUncontacted(ownerId) {
  const id = String(ownerId || "").trim();
  if (!id) return 0;
  // Approximation: NEW stage owned by member (no first attempt field filter if unsupported)
  const filter = `stage[eq]:NEW,ownerId[eq]:${id}`;
  const path = buildTwentyListPath("opportunities", filter, 50);
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) return 0;
  const rows = parseTwentyListRecords("opportunities", res.body);
  return rows.filter((o) => !o.bizFirstAttemptAt && !o.campaignRejected).length;
}

function intentOf(opp) {
  return String(opp.bizLeadIntentClass || "STANDARD").toUpperCase() === "HOT_FIT"
    ? "HOT_FIT"
    : String(opp.bizLeadIntentClass || "STANDARD").toUpperCase() === "LOW_INTENT"
      ? "LOW_INTENT"
      : "STANDARD";
}

async function processOpportunity(opp, holidays) {
  const result = { id: opp.id, name: opp.name, actions: [] };
  if (opp.campaignRejected) return result;
  if (opp.bizFirstAttemptAt) return result;

  // Pre-dispatcher inventory: bez klasy/assignedAt — nie ruszaj (unikaj masowego failoveru)
  if (!opp.bizAssignedAt && !opp.bizLeadIntentClass) {
    result.actions.push("skip_pre_dispatcher");
    return result;
  }

  // Stamp MANUAL first attempt if already left NEW without stamp
  const stage = String(opp.stage || "").toUpperCase();
  if (stage && stage !== "NEW") {
    await patchTwentyRecord("opportunities", opp.id, {
      bizFirstAttemptAt: new Date().toISOString(),
      bizFirstAttemptChannel: "MANUAL",
    });
    result.actions.push("stamp_manual_first_attempt");
    return result;
  }

  const assignedAt = opp.bizAssignedAt || opp.createdAt;
  const elapsed = businessElapsedMs(assignedAt, new Date(), holidays);
  const intent = intentOf(opp);
  const ownerId = String(opp.ownerId || opp.owner?.id || "").trim();

  // Unassigned alert
  if (!ownerId) {
    if (
      elapsed >= UNASSIGNED_ALERT_MS &&
      !opp.bizManagerAlertedAt
    ) {
      await sendManagerMail(
        `[Dyspozytor] Lead bez ownera: ${opp.name || opp.id}`,
        `Opportunity ${opp.id} bez ownera > 30 min roboczych.`,
      );
      await patchTwentyRecord("opportunities", opp.id, {
        bizManagerAlertedAt: new Date().toISOString(),
      });
      result.actions.push("unassigned_alert");
    }
    return result;
  }

  // Escalate (even with Ack)
  if (
    elapsed >= escalateMsForClass(intent) &&
    !opp.bizManagerAlertedAt
  ) {
    await sendManagerMail(
      `[Dyspozytor] Eskalacja ${intent}: ${opp.name || opp.id}`,
      `Lead ${opp.id} bez first contact (ack=${Boolean(opp.bizAckAt)}). Owner=${ownerId}`,
    );
    await patchTwentyRecord("opportunities", opp.id, {
      bizManagerAlertedAt: new Date().toISOString(),
    });
    result.actions.push("escalate");
  }

  // Failover only without Ack — paused until the team agrees on assignment (G8).
  if (!opp.bizAckAt && elapsed >= failoverMsForClass(intent)) {
    if (!isLeadDispatchFailoverEnabled()) {
      result.actions.push("failover_paused");
      return result;
    }
    const pool = getLeadDispatchPoolIds();
    const vacations = getLeadDispatchVacationIds();
    const other = otherPoolMember(pool, ownerId);
    if (!other || vacations.has(other)) {
      if (!opp.bizManagerAlertedAt) {
        await sendManagerMail(
          `[Dyspozytor] Failover zablokowany: ${opp.name || opp.id}`,
          `Brak dostępnej drugiej osoby w puli (limit/urlop). Owner=${ownerId}`,
        );
        await patchTwentyRecord("opportunities", opp.id, {
          bizManagerAlertedAt: new Date().toISOString(),
        });
        result.actions.push("failover_blocked_alert");
      }
      return result;
    }
    const otherOpen = await countOpenUncontacted(other);
    if (otherOpen >= maxOpen()) {
      if (!opp.bizManagerAlertedAt) {
        await sendManagerMail(
          `[Dyspozytor] Failover — druga osoba na limicie: ${opp.name || opp.id}`,
          `other=${other} open=${otherOpen} MAX_OPEN=${maxOpen()}`,
        );
        await patchTwentyRecord("opportunities", opp.id, {
          bizManagerAlertedAt: new Date().toISOString(),
        });
        result.actions.push("failover_limit_alert");
      }
      return result;
    }
    const now = new Date().toISOString();
    const count = Number(opp.bizFailoverCount || 0) + 1;
    await patchTwentyRecord("opportunities", opp.id, {
      ownerId: other,
      bizAssignedAt: now,
      bizFailoverCount: count,
      bizRoutingRule: "RULE-FAILOVER",
    });
    result.actions.push(`failover_to_${other}`);
  }

  return result;
}

async function runLeadDispatchSweep() {
  if (!isLeadDispatcherEnabled()) {
    return { skipped: "LEAD_DISPATCHER_ENABLED off" };
  }
  const holidays = getLeadDispatchHolidays();
  if (!isInsideWorkWindowNow(holidays)) {
    return { skipped: "outside_work_window" };
  }

  let opps;
  try {
    opps = await listNewDispatchOpportunities(
      Number(process.env.LEAD_DISPATCH_SWEEP_LIMIT || 40),
    );
  } catch (err) {
    // Twenty 100 tokens / 60s — poll already spent budget on enrich/create_lead.
    // Must not 500 the whole worker: Scheduler last-fail pages H-LEAD-FORM + H-MAIL-DIR + H-UPDATE-PERSON.
    console.error("lead_dispatch_sweep list FAIL", err.message);
    return {
      ok: false,
      error: err.message,
      scanned: 0,
      results: [],
    };
  }
  const results = [];
  for (const opp of opps) {
    try {
      results.push(await processOpportunity(opp, holidays));
    } catch (err) {
      results.push({ id: opp.id, error: err.message });
    }
  }
  return {
    ok: true,
    scanned: opps.length,
    results,
    manager: getManagerEmail(),
    pool: getLeadDispatchPoolIds(),
  };
}

module.exports = {
  runLeadDispatchSweep,
  countOpenUncontacted,
};
