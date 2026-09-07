"use strict";

/**
 * Retired 2026-09-04 — Lead Dispatcher „Biorę” (bizAckAt).
 * HTTP action `lead_ack` stays so a leftover Twenty workflow does not 404.
 * Does not write Opportunity fields. Historical bizAckAt values stay.
 */

async function leadAck(opportunityId) {
  const id = String(opportunityId || "").trim();
  return {
    ok: true,
    skipped: "retired_biore",
    id: id || null,
  };
}

module.exports = { leadAck };
