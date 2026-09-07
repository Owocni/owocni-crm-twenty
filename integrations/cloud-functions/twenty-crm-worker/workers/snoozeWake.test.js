"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { shouldWakeOpportunity } = require("./snoozeWake");

const NOW = Date.parse("2026-09-04T12:00:00.000Z");

describe("shouldWakeOpportunity", () => {
  it("wakes an open deal whose snooze has elapsed", () => {
    assert.equal(
      shouldWakeOpportunity(
        {
          id: "a",
          stage: "CONTACTED",
          snoozeUntil: "2026-09-04T11:59:00.000Z",
        },
        NOW,
      ),
      true,
    );
  });

  it("does not wake a future snooze", () => {
    assert.equal(
      shouldWakeOpportunity(
        {
          id: "a",
          stage: "CONTACTED",
          snoozeUntil: "2026-09-08T07:00:00.000Z",
        },
        NOW,
      ),
      false,
    );
  });

  it("does not wake WON/LOST", () => {
    assert.equal(
      shouldWakeOpportunity(
        {
          id: "a",
          stage: "WON",
          snoozeUntil: "2026-09-01T00:00:00.000Z",
        },
        NOW,
      ),
      false,
    );
  });
});
