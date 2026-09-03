"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  applyIdentityDocFields,
  applyMetaAdsRouting,
  IDENTITY_ENRICH_FIELDS,
  parseTwentyPayload,
} = require("./processWebhook");

describe("identity enrich fallback merge", () => {
  it("fills paid fields from secondary doc without overwriting existing", () => {
    const enriched = { id_oid: "OID1", biz_email: "a@b.pl", owner: "" };
    applyIdentityDocFields(enriched, {
      biz_email: "a@b.pl",
      identity_tier: "T1",
    });
    assert.equal(enriched.owner, "");

    applyIdentityDocFields(enriched, {
      owner: "platform:google_ads",
      order_id: "123_generate_lead",
      attr_gclid: "gclid-test",
      ga_client_id: "155.178",
      attr_fbp: "fb.1.x.y",
      lead_id: "should-not-matter-if-empty-skip",
    });
    assert.equal(enriched.owner, "platform:google_ads");
    assert.equal(enriched.order_id, "123_generate_lead");
    assert.equal(enriched.attr_gclid, "gclid-test");
    assert.equal(enriched.ga_client_id, "155.178");
    assert.equal(enriched.attr_fbp, "fb.1.x.y");
  });

  it("includes Meta CAPI fields in the enrich allowlist", () => {
    assert.ok(IDENTITY_ENRICH_FIELDS.includes("attr_fbp"));
    assert.ok(IDENTITY_ENRICH_FIELDS.includes("ctx_user_agent"));
    assert.ok(IDENTITY_ENRICH_FIELDS.includes("lead_id"));
  });
});

describe("applyMetaAdsRouting", () => {
  it("sets owner from Instant Form lead_id when owner is empty", () => {
    const enriched = applyMetaAdsRouting(
      { event_name: "qualify_lead" },
      { metaLeadgenId: "3191234824398181" },
      null,
    );
    assert.equal(enriched.lead_id, "3191234824398181");
    assert.equal(enriched.owner, "platform:meta_ads");
    assert.equal(enriched.assist, "platform:meta_ads");
  });

  it("sets owner from FACEBOOK bizSource without overwriting existing owner", () => {
    const enriched = applyMetaAdsRouting(
      { owner: "platform:google_ads" },
      { bizSource: "FACEBOOK", metaLeadgenId: "1" },
      null,
    );
    assert.equal(enriched.owner, "platform:google_ads");
    assert.equal(enriched.lead_id, "1");
  });
});

describe("parseTwentyPayload metaLeadgenId", () => {
  it("reads metaLeadgenId from opportunity webhook", () => {
    const parsed = parseTwentyPayload({
      event: "opportunity.updated",
      data: {
        id: "opp-1",
        stage: "QUALIFIED",
        bizSqlConfirmed: true,
        bizSource: "FACEBOOK",
        metaLeadgenId: "3191234824398181",
        idOid: "OID1",
      },
    });
    assert.equal(parsed.metaLeadgenId, "3191234824398181");
    assert.equal(parsed.bizSource, "FACEBOOK");
  });
});
