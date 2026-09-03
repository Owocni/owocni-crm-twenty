"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveLeadId,
  isInstantFormLead,
  shouldSendMetaCapi,
  buildMetaCapiEvent,
  sha256HexLower,
} = require("./metaCapi");

const preparedSql = {
  event_name: "QualifiedLead",
  event_time: 1750000000,
  event_id: "oid_qualify_lead",
  value: 90,
  currency: "PLN",
};

const preparedPurchase = {
  event_name: "Purchase",
  event_time: 1750000100,
  event_id: "oid_purchase",
  value: 4500,
  currency: "PLN",
};

describe("resolveLeadId / Instant Form", () => {
  it("reads lead_id aliases", () => {
    assert.equal(resolveLeadId({ metaLeadgenId: " 99 " }), "99");
    assert.equal(resolveLeadId({ meta_leadgen_id: "88" }), "88");
    assert.equal(resolveLeadId({ lead_id: "77" }), "77");
  });

  it("treats meta_instant_form as Instant Form even without id", () => {
    assert.equal(
      isInstantFormLead({ src_action_source: "meta_instant_form" }),
      true,
    );
    assert.equal(isInstantFormLead({ owner: "platform:meta_ads" }), false);
  });

  it("skips Instant Form generate_lead (Meta already has the lead)", () => {
    assert.equal(
      shouldSendMetaCapi({ lead_id: "1" }, "generate_lead"),
      false,
    );
    assert.equal(shouldSendMetaCapi({ lead_id: "1" }, "qualify_lead"), true);
    assert.equal(
      shouldSendMetaCapi({ owner: "platform:meta_ads" }, "generate_lead"),
      true,
    );
  });
});

describe("buildMetaCapiEvent", () => {
  it("Instant Form SQL: system_generated + lead_id + CRM custom_data, no PII", () => {
    const event = buildMetaCapiEvent(
      {
        event_name: "qualify_lead",
        lead_id: "3191234824398181",
        biz_email: "firma@example.com",
        biz_phone: "+48111222333",
        attr_fbc: "fb.1.x",
      },
      preparedSql,
    );
    assert.equal(event.action_source, "system_generated");
    assert.equal(event.event_name, "QualifiedLead");
    assert.deepEqual(event.user_data, { lead_id: "3191234824398181" });
    assert.deepEqual(event.custom_data, {
      lead_event_source: "Twenty CRM",
      event_source: "crm",
    });
  });

  it("Instant Form WON: Purchase + lead_id + CRM fields + currency", () => {
    const event = buildMetaCapiEvent(
      { event_name: "purchase", meta_leadgen_id: "abc" },
      preparedPurchase,
    );
    assert.equal(event.event_name, "Purchase");
    assert.equal(event.user_data.lead_id, "abc");
    assert.deepEqual(event.custom_data, {
      lead_event_source: "Twenty CRM",
      event_source: "crm",
      currency: "PLN",
      value: 4500,
    });
  });

  it("website SQL: website + hashed email + value", () => {
    const event = buildMetaCapiEvent(
      {
        event_name: "qualify_lead",
        biz_email: "A@B.pl",
        id_oid: "OID1",
        attr_fbc: "fb.1.123.abc",
        attr_fbp: "fb.1.123.def",
        ctx_ip_address: "1.2.3.4",
        ctx_user_agent: "Mozilla/5.0",
      },
      preparedSql,
    );
    assert.equal(event.action_source, "website");
    assert.equal(event.event_name, "QualifiedLead");
    assert.deepEqual(event.user_data.em, [sha256HexLower("a@b.pl")]);
    assert.equal(event.user_data.fbc, "fb.1.123.abc");
    assert.equal(event.user_data.fbp, "fb.1.123.def");
    assert.deepEqual(event.custom_data, { value: 90, currency: "PLN" });
    assert.equal(event.user_data.lead_id, undefined);
  });

  it("returns null for Instant Form generate_lead", () => {
    const event = buildMetaCapiEvent(
      { event_name: "generate_lead", lead_id: "1" },
      { event_name: "Lead", event_time: 1, event_id: "x" },
    );
    assert.equal(event, null);
  });
});
