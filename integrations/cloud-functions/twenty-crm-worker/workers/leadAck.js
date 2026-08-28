"use strict";

/**
 * Lead Dispatcher — „Biorę” (bizAckAt).
 * Spec: integrations/runbooks/LEAD_DISPATCHER_PLAN.md
 */

const { patchTwentyRecord, twentyRequest } = require("../shared/twentyRest");

async function getOpportunity(opportunityId) {
  const id = String(opportunityId || "").trim();
  if (!id) throw new Error("opportunityId required");
  const res = await twentyRequest("GET", `/opportunities/${encodeURIComponent(id)}`);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`GET opportunity HTTP ${res.statusCode} ${res.rawBody}`);
  }
  return res.body?.data?.opportunity || res.body?.opportunity || res.body;
}

/**
 * Stamp bizAckAt — stops failover clock; escalation still runs.
 * Idempotent: existing bizAckAt → skipped.
 */
async function leadAck(opportunityId) {
  const opp = await getOpportunity(opportunityId);
  if (!opp?.id) throw new Error("opportunity not found");

  if (opp.bizAckAt) {
    return { ok: true, skipped: "already_ack", bizAckAt: opp.bizAckAt, id: opp.id };
  }
  if (opp.bizFirstAttemptAt) {
    return {
      ok: true,
      skipped: "already_contacted",
      bizFirstAttemptAt: opp.bizFirstAttemptAt,
      id: opp.id,
    };
  }
  if (opp.campaignRejected) {
    return { ok: true, skipped: "rejected", id: opp.id };
  }

  const now = new Date().toISOString();
  await patchTwentyRecord("opportunities", opp.id, { bizAckAt: now });
  return { ok: true, id: opp.id, bizAckAt: now };
}

module.exports = { leadAck, getOpportunity };
