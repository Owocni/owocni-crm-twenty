"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  classifyLeadIntent,
  resolveRoutingRuleId,
  pickLeastLoaded,
  businessElapsedMs,
  failoverMsForClass,
} = require("../shared/leadDispatch");

describe("classifyLeadIntent", () => {
  it("HOT: web + redesign + premium + >6min", () => {
    const c = classifyLeadIntent({
      bizProductTwenty: "WEB",
      kanbanFields: {
        bizProjectType: "REDESIGN",
        bizIntent: "EKSPERT",
      },
      answers: { strona_jaka: "premium" },
      taskData: { ctx_time_on_page_ms: 400_000 },
    });
    assert.equal(c, "HOT_FIT");
  });

  it("STANDARD: other web options", () => {
    const c = classifyLeadIntent({
      bizProductTwenty: "WEB",
      kanbanFields: { bizProjectType: "NEW", bizIntent: "CENNIK" },
      answers: { strona_jaka: "basic" },
      taskData: { ctx_time_on_page_ms: 10_000 },
    });
    assert.equal(c, "STANDARD");
  });

  it("STANDARD: other product + owner + premium + time", () => {
    const c = classifyLeadIntent({
      bizProductTwenty: "LOGO",
      kanbanFields: {
        bizContactRole: "OWNER",
        bizIntent: "EKSPERT",
      },
      answers: { logo_jaka: "premium" },
      taskData: { ctx_time_on_page_ms: 400_000 },
    });
    assert.equal(c, "STANDARD");
  });

  it("LOW: other product without signals", () => {
    const c = classifyLeadIntent({
      bizProductTwenty: "LOGO",
      kanbanFields: {},
      answers: { logo_jaka: "basic" },
      taskData: {},
    });
    assert.equal(c, "LOW_INTENT");
  });

  it("default STANDARD when no form product", () => {
    const c = classifyLeadIntent({
      bizProductTwenty: null,
      kanbanFields: {},
      answers: {},
      taskData: {},
    });
    assert.equal(c, "STANDARD");
  });
});

describe("resolveRoutingRuleId", () => {
  it("FACEBOOK interim → robert", () => {
    const r = resolveRoutingRuleId({
      bizProductTwenty: "WEB",
      bizSource: "FACEBOOK",
      metaInterimAllFacebook: true,
      metaAllowlist: [],
    });
    assert.equal(r.ruleId, "RULE-META-INTERIM");
    assert.equal(r.ownerHint, "robert");
  });

  it("FACEBOOK campaign on Piotr list → robert R01", () => {
    const r = resolveRoutingRuleId({
      bizProductTwenty: "WEB",
      bizSource: "FACEBOOK",
      metaCampaignId: "120250072847080433",
      metaAllowlist: ["120250072847080433", "120250072846850433"],
      metaInterimAllFacebook: false,
    });
    assert.equal(r.ruleId, "RULE-META-R01");
    assert.equal(r.ownerHint, "robert");
  });

  it("FACEBOOK outside Piotr list → pool (not Robert)", () => {
    const r = resolveRoutingRuleId({
      bizProductTwenty: "MARKETING",
      bizSource: "FACEBOOK",
      metaCampaignId: "999999999999999999",
      metaAllowlist: ["120250072847080433"],
      metaInterimAllFacebook: false,
    });
    assert.equal(r.ruleId, "RULE-POOL-DEFAULT");
    assert.equal(r.ownerHint, null);
  });

  it("COPY → maciej", () => {
    const r = resolveRoutingRuleId({
      bizProductTwenty: "COPYWRITING",
      bizSource: "ORGANIC",
    });
    assert.equal(r.ruleId, "RULE-COPY-01");
    assert.equal(r.ownerHint, "maciej");
  });

  it("pool default", () => {
    const r = resolveRoutingRuleId({
      bizProductTwenty: "WEB",
      bizSource: "ORGANIC",
    });
    assert.equal(r.ruleId, "RULE-POOL-DEFAULT");
  });
});

describe("pickLeastLoaded", () => {
  it("picks lower openCount", () => {
    const id = pickLeastLoaded([
      { id: "a", openCount: 2 },
      { id: "b", openCount: 0 },
    ]);
    assert.equal(id, "b");
  });

  it("skips at MAX_OPEN", () => {
    const id = pickLeastLoaded([
      { id: "a", openCount: 3 },
      { id: "b", openCount: 3 },
    ]);
    assert.equal(id, null);
  });
});

describe("failoverMsForClass", () => {
  it("HOT 15 min", () => {
    assert.equal(failoverMsForClass("HOT_FIT"), 15 * 60 * 1000);
  });
});

describe("businessElapsedMs", () => {
  it("returns 0 for empty", () => {
    assert.equal(businessElapsedMs(null), 0);
  });

  it("counts weekday work window without hanging on long span", () => {
    // Monday 2026-08-17 10:00 Warsaw (CEST = UTC+2) → 08:00Z
    // Same day 11:00 Warsaw → 09:00Z → 60 min business
    const ms = businessElapsedMs(
      "2026-08-17T08:00:00.000Z",
      new Date("2026-08-17T09:00:00.000Z"),
    );
    assert.equal(ms, 60 * 60 * 1000);
  });

  it("skips weekend", () => {
    // Sat 2026-08-22 10:00 → Mon 2026-08-24 09:00 Warsaw
    // Sat+Sun skipped; Mon 08:00–09:00 = 60 min
    const ms = businessElapsedMs(
      "2026-08-22T08:00:00.000Z",
      new Date("2026-08-24T07:00:00.000Z"),
    );
    assert.equal(ms, 60 * 60 * 1000);
  });
});

describe("isLeadDispatchFailoverEnabled", () => {
  const { isLeadDispatchFailoverEnabled } = require("../shared/config");

  it("stays off after Biorę retirement (env ignored)", () => {
    delete process.env.LEAD_DISPATCH_FAILOVER_ENABLED;
    assert.equal(isLeadDispatchFailoverEnabled(), false);
    process.env.LEAD_DISPATCH_FAILOVER_ENABLED = "true";
    assert.equal(isLeadDispatchFailoverEnabled(), false);
    delete process.env.LEAD_DISPATCH_FAILOVER_ENABLED;
  });
});
