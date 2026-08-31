"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_CUTOVER_AT,
  parseCutoverAtMs,
  shouldApplyFollowUpFlag,
  resolveFollowUpFlag,
  desiredFollowUpFromOpenLead,
} = require("./followUp");

const CUTOVER = parseCutoverAtMs(DEFAULT_CUTOVER_AT);

describe("followUp guard + flaga", () => {
  it("parses default cutoverAt (31.08.2026 00:00 Warsaw)", () => {
    assert.equal(CUTOVER, Date.parse("2026-08-31T00:00:00+02:00"));
  });

  it("throws on unparseable CUTOVER_AT", () => {
    assert.throws(() => parseCutoverAtMs("nie-data"), /nieparsowalny/);
  });

  it("fail-closed: brak receivedAt → bez flagi", () => {
    assert.equal(shouldApplyFollowUpFlag(null, CUTOVER), false);
    assert.equal(shouldApplyFollowUpFlag("", CUTOVER), false);
    assert.equal(shouldApplyFollowUpFlag("bogus", CUTOVER), false);
  });

  it("blocks business flag before cutoverAt", () => {
    assert.equal(
      shouldApplyFollowUpFlag("2026-08-30T21:59:59.000Z", CUTOVER),
      false,
    );
  });

  it("allows business flag at/after cutoverAt", () => {
    assert.equal(
      shouldApplyFollowUpFlag("2026-08-30T22:00:00.000Z", CUTOVER),
      true,
    );
    assert.equal(
      shouldApplyFollowUpFlag("2026-08-31T10:00:00+02:00", CUTOVER),
      true,
    );
  });

  it("INCOMING → ON, OUTGOING → OFF", () => {
    assert.equal(resolveFollowUpFlag("INCOMING"), true);
    assert.equal(resolveFollowUpFlag("incoming"), true);
    assert.equal(resolveFollowUpFlag("OUTGOING"), false);
    assert.equal(resolveFollowUpFlag("OTHER"), null);
  });

  it("open NEW lead wants the flag even without mail", () => {
    assert.equal(desiredFollowUpFromOpenLead("NEW"), true);
    assert.equal(desiredFollowUpFromOpenLead("CONTACTED"), false);
    assert.equal(desiredFollowUpFromOpenLead("PROPOSAL"), false);
  });
});
