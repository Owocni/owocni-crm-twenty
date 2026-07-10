"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { detectBusinessEvent } = require("./processWebhook");

const SKIP = "SKIP_NO_RELEVANT_TRANSITION";
const SKIP_SQL = "SKIP_QUALIFIED_WITHOUT_SQL_CONFIRM";

function prev(stage, rejected = false) {
  return { last_stage: stage, last_campaignRejected: rejected };
}

function opp(stage, extras = {}) {
  return {
    stage,
    campaignRejected: extras.campaignRejected ?? false,
    bizSqlConfirmed: extras.bizSqlConfirmed ?? false,
    bizLastNonSqlStage: extras.bizLastNonSqlStage ?? null,
    opportunityIdOid: extras.opportunityIdOid ?? "TEST_OID",
    ...extras,
  };
}

describe("detectBusinessEvent — PF-4 metric-only updates", () => {
  it("skips when stage unchanged (workflow wrote metric fields only)", () => {
    const decision = detectBusinessEvent(
      opp("CONTACTED", { hoursToFirstResponse: 12.5, firstResponseAt: "2026-07-09T10:00:00.000Z" }),
      prev("CONTACTED"),
    );
    assert.equal(decision.skip, SKIP);
    assert.equal(decision.emit, undefined);
  });

  it("skips when stage unchanged after Track Stage Time (QUALIFIED metrics)", () => {
    const decision = detectBusinessEvent(
      opp("QUALIFIED", {
        qualifiedAt: "2026-07-09T11:00:00.000Z",
        hoursToQualified: 48.25,
        bizSqlConfirmed: true,
      }),
      prev("QUALIFIED"),
    );
    assert.equal(decision.skip, SKIP);
  });

  it("skips when stage unchanged after WON close metrics", () => {
    const decision = detectBusinessEvent(
      opp("WON", {
        stageClosedAt: "2026-07-09T12:16:37.533Z",
        daysToClose: 2.24,
      }),
      prev("WON"),
    );
    assert.equal(decision.skip, SKIP);
  });

  it("skips description-only edit (smoke #5 parity)", () => {
    const decision = detectBusinessEvent(
      opp("NEW", { name: "Updated title only" }),
      prev("NEW"),
    );
    assert.equal(decision.skip, SKIP);
  });

  it("emits purchase on NEW → WON transition", () => {
    const decision = detectBusinessEvent(opp("WON"), prev("PROPOSAL"));
    assert.equal(decision.emit, "purchase");
  });

  it("emits qualify_lead when SQL confirmed on stage change", () => {
    const decision = detectBusinessEvent(
      opp("QUALIFIED", { bizSqlConfirmed: true }),
      prev("CONTACTED"),
    );
    assert.equal(decision.emit, "qualify_lead");
  });

  it("skips SQL and WON transitions on campaign-rejected leads", () => {
    const sql = detectBusinessEvent(
      opp("QUALIFIED", { bizSqlConfirmed: true, campaignRejected: true }),
      prev("CONTACTED"),
    );
    assert.equal(sql.skip, "SKIP_CAMPAIGN_REJECTED");

    const won = detectBusinessEvent(
      opp("WON", { campaignRejected: true }),
      prev("PROPOSAL"),
    );
    assert.equal(won.skip, "SKIP_CAMPAIGN_REJECTED");
  });

  it("emits rejected_lead when campaignRejected flips to true", () => {
    const decision = detectBusinessEvent(
      opp("CONTACTED", { campaignRejected: true }),
      prev("CONTACTED", false),
    );
    assert.equal(decision.emit, "rejected_lead");
  });
});
