"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { buildMergedOpportunityContactPatch } = require("./mergeLeads");

describe("mergeLeads — opportunity additional contacts", () => {
  it("adds loser card email and person email to survivor additional fields", () => {
    const { patch, emailsAdded, phonesAdded } = buildMergedOpportunityContactPatch(
      {
        bizCardEmail: "boss@firma.pl",
        bizCardPhone: "+48111111111",
        bizAdditionalEmails: null,
        bizAdditionalPhones: null,
      },
      {
        bizCardEmail: "asystent@firma.pl",
        bizCardPhone: "+48222222222",
        bizAdditionalEmails: {
          primaryEmail: "biuro@firma.pl",
          additionalEmails: [],
        },
      },
      {
        emails: {
          primaryEmail: "asystent@firma.pl",
          additionalEmails: ["extra@firma.pl"],
        },
        phones: {
          primaryPhoneCallingCode: "+48",
          primaryPhoneNumber: "333333333",
        },
      },
      {
        emails: { primaryEmail: "boss@firma.pl" },
        phones: {
          primaryPhoneCallingCode: "+48",
          primaryPhoneNumber: "111111111",
        },
      },
    );

    assert.equal(emailsAdded, 3);
    assert.equal(phonesAdded, 2);
    assert.equal(patch.bizAdditionalEmails.primaryEmail, "biuro@firma.pl");
    assert.deepEqual(patch.bizAdditionalEmails.additionalEmails.sort(), [
      "asystent@firma.pl",
      "extra@firma.pl",
    ]);
    assert.equal(patch.bizAdditionalPhones.primaryPhoneNumber, "222222222");
    assert.equal(patch.bizAdditionalPhones.additionalPhones.length, 1);
    assert.equal(patch.bizAdditionalPhones.additionalPhones[0].number, "333333333");
  });

  it("does not duplicate survivor primary card contacts", () => {
    const { patch, emailsAdded, phonesAdded } = buildMergedOpportunityContactPatch(
      {
        bizCardEmail: "same@firma.pl",
        bizCardPhone: "+48111111111",
      },
      {
        bizCardEmail: "same@firma.pl",
        bizCardPhone: "+48111111111",
      },
      {
        emails: { primaryEmail: "same@firma.pl" },
        phones: {
          primaryPhoneCallingCode: "+48",
          primaryPhoneNumber: "111111111",
        },
      },
      {
        emails: { primaryEmail: "same@firma.pl" },
        phones: {
          primaryPhoneCallingCode: "+48",
          primaryPhoneNumber: "111111111",
        },
      },
    );

    assert.equal(emailsAdded, 0);
    assert.equal(phonesAdded, 0);
    assert.deepEqual(patch, {});
  });
});
