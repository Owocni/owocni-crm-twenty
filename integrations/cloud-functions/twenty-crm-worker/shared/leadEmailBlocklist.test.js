"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  isEmailOnLeadBlocklist,
  isLeadEmailBlocked,
  findBlockedLeadEmail,
  getLeadEmailBlocklist,
} = require("./leadEmailBlocklist");

describe("leadEmailBlocklist", () => {
  it("blocks artur@maxseo.pl regardless of case", () => {
    assert.equal(isEmailOnLeadBlocklist("artur@maxseo.pl"), true);
    assert.equal(isEmailOnLeadBlocklist("ARTUR@MaxSeo.PL"), true);
  });

  it("does not block other people on the same domain", () => {
    assert.equal(isEmailOnLeadBlocklist("biuro@maxseo.pl"), false);
    assert.equal(isEmailOnLeadBlocklist("anna@owocni.pl"), false);
  });

  it("does not block empty / invalid", () => {
    assert.equal(isEmailOnLeadBlocklist(""), false);
    assert.equal(isEmailOnLeadBlocklist("not-an-email"), false);
    assert.equal(isLeadEmailBlocked({}), false);
  });

  it("blocks from biz_email on a createLead task", () => {
    assert.equal(
      isLeadEmailBlocked({ biz_email: "artur@maxseo.pl" }),
      true,
    );
  });

  it("blocks from form answers when biz_email is empty", () => {
    assert.equal(
      isLeadEmailBlocked({
        answers: { email: "artur@maxseo.pl" },
      }),
      true,
    );
  });

  it("accepts extra exact addresses", () => {
    const hit = findBlockedLeadEmail(
      ["spam@example.com"],
      ["spam@example.com"],
    );
    assert.equal(hit.handle, "spam@example.com");
  });

  it("accepts extra @domain handles", () => {
    assert.equal(
      isEmailOnLeadBlocklist("kto@maxseo.pl", ["@maxseo.pl"]),
      true,
    );
    assert.equal(
      isEmailOnLeadBlocklist("kto@notmaxseo.pl", ["@maxseo.pl"]),
      false,
    );
  });

  it("folds Gmail dots and plus-tags against the list", () => {
    assert.equal(
      isEmailOnLeadBlocklist("john.doe+x@gmail.com", ["johndoe@gmail.com"]),
      true,
    );
  });

  it("merges committed list with extras", () => {
    const handles = getLeadEmailBlocklist(["extra@foo.pl"]);
    assert.ok(handles.includes("artur@maxseo.pl"));
    assert.ok(handles.includes("extra@foo.pl"));
  });
});
