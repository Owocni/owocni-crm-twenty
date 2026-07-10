"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { deliveryFingerprint } = require("./processWebhook");

const OPP_ID = "72f62296-fdc3-473b-b99f-d71768e88469";

function body(stage, extras = {}) {
  return {
    event: "opportunity.updated",
    timestamp: extras.timestamp ?? "",
    previousRecord: extras.previousRecord ?? { stage: extras.prevStage ?? "" },
    data: {
      id: OPP_ID,
      stage,
      updatedAt: extras.updatedAt ?? "2026-07-09T12:16:37.533Z",
      idOid: "KKYG0XR653SERQVVQBMGNQH6Q2",
    },
  };
}

describe("deliveryFingerprint — stage transitions are not duplicates", () => {
  it("differs between QUALIFIED and PROPOSAL when Twenty omits timestamp", () => {
    const qualified = deliveryFingerprint(
      body("QUALIFIED", { prevStage: "CONTACTED" }),
    );
    const proposal = deliveryFingerprint(
      body("PROPOSAL", { prevStage: "QUALIFIED" }),
    );
    assert.notEqual(qualified, proposal);
  });

  it("differs between PROPOSAL and WON when Twenty omits timestamp", () => {
    const proposal = deliveryFingerprint(
      body("PROPOSAL", { prevStage: "QUALIFIED" }),
    );
    const won = deliveryFingerprint(body("WON", { prevStage: "PROPOSAL" }));
    assert.notEqual(proposal, won);
  });

  it("matches identical retry delivery", () => {
    const first = deliveryFingerprint(
      body("WON", { prevStage: "PROPOSAL", updatedAt: "2026-07-09T12:16:37.533Z" }),
    );
    const retry = deliveryFingerprint(
      body("WON", { prevStage: "PROPOSAL", updatedAt: "2026-07-09T12:16:37.533Z" }),
    );
    assert.equal(first, retry);
  });
});
