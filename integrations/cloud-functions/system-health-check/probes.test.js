"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { toUiSnapshot } = require("./probes");

describe("toUiSnapshot", () => {
  it("copies savedAt, mode, overall, items — no extra probe fields", () => {
    const state = {
      savedAt: "2026-09-07T09:00:00.000Z",
      mode: "probe",
      overall: "OK",
      items: [{ instance: "sandbox", id: "H-PLATFORM", prio: "P0", status: "OK", detail: "REST" }],
      extra: "secret-adjacent",
    };
    assert.deepEqual(toUiSnapshot(state), {
      savedAt: state.savedAt,
      mode: "probe",
      overall: "OK",
      items: state.items,
    });
  });
});
