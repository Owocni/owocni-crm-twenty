"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { mapBizSource, isLeadsAtEmailTask } = require("./createLead");

describe("mapBizSource — Leads@ smoke", () => {
  it("returns DIRECT_EMAIL for leads_at inbound channel", () => {
    const task = { inbound_channel: "leads_at", src_system: "TWENTY_EMAIL" };
    assert.equal(isLeadsAtEmailTask(task), true);
    assert.equal(mapBizSource(task), "DIRECT_EMAIL");
  });

  it("returns DIRECT_EMAIL for TWENTY_EMAIL src_system", () => {
    const task = { src_system: "TWENTY_EMAIL" };
    assert.equal(mapBizSource(task), "DIRECT_EMAIL");
  });

  it("returns FORM path for generate_lead without leads_at", () => {
    const task = {
      event_name: "generate_lead",
      ctx_kanban_id: "k1",
      ctx_list_id: "l1",
    };
    assert.equal(isLeadsAtEmailTask(task), false);
    assert.equal(mapBizSource(task), "ORGANIC");
  });

  it("does not map web product to bizSource", () => {
    const task = {
      inbound_channel: "leads_at",
      biz_product: "web",
      src_system: "TWENTY_EMAIL",
    };
    assert.equal(mapBizSource(task), "DIRECT_EMAIL");
  });
});
