"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeBizValueForTask,
  parseBizValueDisplay,
  resolveOpportunityBizValue,
} = require("./processWebhook");

describe("normalizeBizValueForTask", () => {
  it("flattens Twenty currency object with null micros to empty string", () => {
    assert.equal(
      normalizeBizValueForTask({ amountMicros: null, currencyCode: null }),
      "",
    );
  });

  it("converts amountMicros to PLN number", () => {
    assert.equal(
      normalizeBizValueForTask({ amountMicros: 5_000_000, currencyCode: "PLN" }),
      5,
    );
  });
});

describe("parseBizValueDisplay", () => {
  it("parses single PLN amount from kanban display", () => {
    assert.equal(parseBizValueDisplay("1222 PLN"), 1222);
  });

  it("ignores placeholder display values", () => {
    assert.equal(parseBizValueDisplay("0 PLN"), "");
    assert.equal(parseBizValueDisplay("Do ustalenia"), "");
  });
});

describe("resolveOpportunityBizValue", () => {
  it("falls back to bizValueDisplay when amount is zero", () => {
    assert.equal(
      resolveOpportunityBizValue({
        bizValueWon: { amountMicros: null, currencyCode: null },
        amount: { amountMicros: 0, currencyCode: "PLN" },
        bizValueDisplay: "1222 PLN",
      }),
      1222,
    );
  });

  it("prefers bizValueWon over display text", () => {
    assert.equal(
      resolveOpportunityBizValue({
        bizValueWon: { amountMicros: 3_000_000, currencyCode: "PLN" },
        bizValueDisplay: "1222 PLN",
      }),
      3,
    );
  });
});
