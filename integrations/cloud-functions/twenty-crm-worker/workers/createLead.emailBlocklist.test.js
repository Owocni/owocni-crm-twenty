"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { isLeadEmailBlocked } = require("./createLead");

describe("createLead blocked email", () => {
  it("skips artur@maxseo.pl from the committed list", () => {
    assert.equal(
      isLeadEmailBlocked({ biz_email: "artur@maxseo.pl" }),
      true,
    );
  });

  it("lets a normal inquiry through", () => {
    assert.equal(
      isLeadEmailBlocked({
        biz_email: "anna@firma.pl",
        biz_message: "Proszę o wycenę strony",
      }),
      false,
    );
  });
});
