"use strict";

/**
 * Retired 2026-09-04 — Lead Dispatcher sweep (failover / escalate / unassigned).
 * Historical Opportunity fields stay. This job no longer changes owners or sends alerts.
 * POST { action: "lead_dispatch_sweep" } remains a no-op so old callers do not 500.
 */

async function runLeadDispatchSweep() {
  return { skipped: "retired_biore", scanned: 0, results: [] };
}

module.exports = {
  runLeadDispatchSweep,
};
