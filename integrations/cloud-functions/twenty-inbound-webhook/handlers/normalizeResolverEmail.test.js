"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeResolverEmail } = require("./processWebhook");

describe("normalizeResolverEmail Gmail aliases", () => {
  it("strips Gmail dots and plus-tags for identity_map lookup", () => {
    assert.equal(normalizeResolverEmail("kamil.dnp@gmail.com"), "kamildnp@gmail.com");
    assert.equal(
      normalizeResolverEmail("prox.clublife+tag@googlemail.com"),
      "proxclublife@gmail.com",
    );
  });

  it("leaves corporate mail unchanged except lowercase", () => {
    assert.equal(normalizeResolverEmail("Biuro@Owocni.pl"), "biuro@owocni.pl");
  });
});
