"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  displayEmail,
  canonicalEmail,
  emailLookupKeys,
  twentyEmailsFields,
  preferPersonId,
} = require("./gmailEmail");

describe("gmailEmail", () => {
  it("canonical strips Gmail dots and plus-tags", () => {
    assert.equal(canonicalEmail("Kamil.DNP+x@googlemail.com"), "kamildnp@gmail.com");
    assert.equal(displayEmail("Kamil.DNP+x@googlemail.com"), "kamil.dnp+x@gmail.com");
  });

  it("lookup keys include both typed and canonical Gmail", () => {
    assert.deepEqual(emailLookupKeys("kamil.dnp@gmail.com"), [
      "kamil.dnp@gmail.com",
      "kamildnp@gmail.com",
    ]);
    assert.deepEqual(emailLookupKeys("biuro@owocni.pl"), ["biuro@owocni.pl"]);
  });

  it("Twenty payload keeps typed primary and canonical additional", () => {
    const fields = twentyEmailsFields("kamil.dnp@gmail.com", [], "kamildnp@gmail.com");
    assert.equal(fields.primaryEmail, "kamil.dnp@gmail.com");
    assert.ok(fields.additionalEmails.includes("kamildnp@gmail.com"));
  });

  it("prefers alias person that already has an open opportunity", () => {
    assert.equal(
      preferPersonId({
        existingPersonId: "imap-ghost",
        aliasPersonId: "sortownia",
        aliasHasOpenOpp: true,
        existingHasOpenOpp: false,
      }),
      "sortownia",
    );
    assert.equal(
      preferPersonId({
        existingPersonId: "imap-ghost",
        aliasPersonId: "sortownia",
        aliasHasOpenOpp: false,
        existingHasOpenOpp: false,
      }),
      "imap-ghost",
    );
  });
});
