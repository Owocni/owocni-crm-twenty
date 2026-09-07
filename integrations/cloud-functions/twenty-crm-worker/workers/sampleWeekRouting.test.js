"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  decideSampleWeekOwner,
  RULE_SAMPLE_WEEK_HOLDING,
  RULE_SAMPLE_WEEK_QUOTA,
} = require("../shared/sampleWeekRouting");

const MARTA = "marta-id";
const HOLDING = "holding-id";
const ROBERT = "robert-id";

const baseCfg = {
  enabled: true,
  holdingOwnerId: HOLDING,
  quotaOwnerIds: new Set([MARTA, "gosia-id", "maciej-id"]),
  exemptOwnerIds: new Set([ROBERT]),
  dailyQuota: 2,
};

describe("decideSampleWeekOwner", () => {
  it("off → passthrough", () => {
    const r = decideSampleWeekOwner(
      { ownerId: MARTA, routingRule: "RULE-POOL-DEFAULT" },
      { ...baseCfg, enabled: false, assignedToday: 99 },
    );
    assert.equal(r.ownerId, MARTA);
    assert.equal(r.sampleWeek, "off");
  });

  it("Robert exempt even when over quota", () => {
    const r = decideSampleWeekOwner(
      { ownerId: ROBERT, routingRule: "RULE-META-R01" },
      { ...baseCfg, assignedToday: 99 },
    );
    assert.equal(r.ownerId, ROBERT);
    assert.equal(r.sampleWeek, "exempt");
  });

  it("under quota → keep salesperson", () => {
    const r = decideSampleWeekOwner(
      { ownerId: MARTA, routingRule: "RULE-POOL-DEFAULT" },
      { ...baseCfg, assignedToday: 1 },
    );
    assert.equal(r.ownerId, MARTA);
    assert.equal(r.sampleWeek, "quota");
  });

  it("at quota → holding", () => {
    const r = decideSampleWeekOwner(
      { ownerId: MARTA, routingRule: "RULE-POOL-DEFAULT" },
      { ...baseCfg, assignedToday: 2 },
    );
    assert.equal(r.ownerId, HOLDING);
    assert.equal(r.routingRule, RULE_SAMPLE_WEEK_HOLDING);
    assert.equal(r.sampleWeek, "holding_quota_full");
  });

  it("unassigned → holding", () => {
    const r = decideSampleWeekOwner(
      { ownerId: null },
      { ...baseCfg, assignedToday: 0 },
    );
    assert.equal(r.ownerId, HOLDING);
    assert.equal(r.routingRule, RULE_SAMPLE_WEEK_HOLDING);
  });

  it("Ewa (outside pool) → holding", () => {
    const r = decideSampleWeekOwner(
      { ownerId: "ewa-id" },
      { ...baseCfg, assignedToday: 0 },
    );
    assert.equal(r.ownerId, HOLDING);
    assert.equal(r.sampleWeek, "holding_outside_quota_pool");
  });

  it("quota 0 → always holding for pool", () => {
    const r = decideSampleWeekOwner(
      { ownerId: MARTA },
      { ...baseCfg, dailyQuota: 0, assignedToday: 0 },
    );
    assert.equal(r.ownerId, HOLDING);
    assert.equal(r.routingRule, RULE_SAMPLE_WEEK_HOLDING);
  });

  it("preserves routing rule when under quota and missing", () => {
    const r = decideSampleWeekOwner(
      { ownerId: MARTA },
      { ...baseCfg, assignedToday: 0 },
    );
    assert.equal(r.routingRule, RULE_SAMPLE_WEEK_QUOTA);
  });
});
