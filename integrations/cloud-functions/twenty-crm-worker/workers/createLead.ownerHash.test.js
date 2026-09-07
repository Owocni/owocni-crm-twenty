"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { resolveOpportunityOwnerId } = require("./createLead");

const MARTA = "4704e0c0-8d77-4640-ad1e-1875294294df";
const GOSIA = "ccac533d-a34b-4cfc-a036-9e75ee3f8910";
const MACIEJ = "7fddba1d-e443-47d4-97b7-a3a829efd8c1";
const ROBERT = "23ac9976-0232-4097-b056-5dc391bf7c34";

describe("resolveOpportunityOwnerId — GCP hash (Biorę retired)", () => {
  it("COPYWRITING → Maciej regardless of Facebook source", () => {
    const owner = resolveOpportunityOwnerId("COPYWRITING", "x", {
      src_action_source: "meta_instant_form",
      lead_id: "123",
    });
    assert.equal(owner, MACIEJ);
  });

  it("COPYWRITING → Maciej for organic", () => {
    assert.equal(resolveOpportunityOwnerId("COPYWRITING", "any-oid", {}), MACIEJ);
  });

  it("even idOid hash → Gosia", () => {
    assert.equal(resolveOpportunityOwnerId("LOGO", "aa", {}), GOSIA);
  });

  it("odd idOid hash → Marta", () => {
    assert.equal(resolveOpportunityOwnerId("LOGO", "a", {}), MARTA);
  });

  it("FACEBOOK non-copy → Robert", () => {
    const owner = resolveOpportunityOwnerId("LOGO", "x", {
      src_action_source: "meta_instant_form",
      lead_id: "123",
    });
    assert.equal(owner, ROBERT);
  });
});
