"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const IDENTITY_ENRICH_FIELDS = [
  "owner",
  "order_id",
  "attr_gclid",
  "ga_client_id",
];

function isEnrichFieldEmpty(value) {
  return value === null || value === undefined || value === "";
}

function applyIdentityDocFields(enriched, doc) {
  if (!doc || typeof doc !== "object") {
    return;
  }
  for (const fieldName of IDENTITY_ENRICH_FIELDS) {
    if (isEnrichFieldEmpty(enriched[fieldName]) && doc[fieldName]) {
      enriched[fieldName] = doc[fieldName];
    }
  }
}

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
    });
    assert.equal(enriched.owner, "platform:google_ads");
    assert.equal(enriched.order_id, "123_generate_lead");
    assert.equal(enriched.attr_gclid, "gclid-test");
    assert.equal(enriched.ga_client_id, "155.178");
  });
});
