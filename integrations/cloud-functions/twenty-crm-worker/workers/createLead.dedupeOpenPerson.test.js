"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { preferOpenOpportunity } = require("../shared/twentyRest");

describe("preferOpenOpportunity", () => {
  it("prefers BETTER_BITRIX_LEGACY over newer TWENTY_EMAIL", () => {
    const picked = preferOpenOpportunity([
      { id: "email", srcSystem: "TWENTY_EMAIL", stage: "NEW" },
      {
        id: "bb",
        srcSystem: "BETTER_BITRIX_LEGACY",
        stage: "CONTACTED",
        bitrixDealId: "bb:1",
      },
    ]);
    assert.equal(picked.id, "bb");
  });

  it("prefers bitrixDealId even without legacy srcSystem", () => {
    const picked = preferOpenOpportunity([
      { id: "a", srcSystem: "TWENTY_EMAIL", stage: "NEW" },
      { id: "b", srcSystem: "OWOCNI_SORTOWNIA", stage: "NEW", bitrixDealId: "bb:9" },
    ]);
    assert.equal(picked.id, "b");
  });

  it("falls back to first when no legacy", () => {
    const picked = preferOpenOpportunity([
      { id: "a", srcSystem: "TWENTY_EMAIL", stage: "NEW" },
    ]);
    assert.equal(picked.id, "a");
  });

  it("returns null for empty", () => {
    assert.equal(preferOpenOpportunity([]), null);
    assert.equal(preferOpenOpportunity(null), null);
  });
});
