"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const {
  isFreeMail,
  companyDomainKey,
  normalizeEmail,
  registrableDomain,
  resetFreeMailCache,
} = require("./isFreeMail");

const JSON_PATH = path.join(__dirname, "data", "free_mail_domains_v1.json");

const opts = { jsonPath: JSON_PATH, patternsEnabled: false };

describe("isFreeMail — exact match (substring FORBIDDEN)", () => {
  it("blocks known freemail", () => {
    assert.equal(isFreeMail("gmail.com", opts), true);
    assert.equal(isFreeMail("wp.pl", opts), true);
    assert.equal(isFreeMail("live.com", opts), true);
    assert.equal(isFreeMail("me.com", opts), true);
    assert.equal(isFreeMail("consultant.com", opts), true);
  });

  it("canary: corporate / lookalikes MUST pass (no substring)", () => {
    const canary = [
      "acme.com",
      "livechat.com",
      "livechatinc.com",
      "terravita.pl",
      "claims.com",
      "home.com",
      "protonet.de",
      "orange.com",
      "telekom.de",
      "msnbc.com",
      "deliveroo.co.uk",
      "owocni.pl",
      "pharmac.com",
      "tutaj.pl",
    ];
    for (const d of canary) {
      assert.equal(isFreeMail(d, opts), false, `false-positive: ${d}`);
    }
  });

  it("never_block overrides", () => {
    assert.equal(isFreeMail("orange.com", opts), false);
  });

  it("anchored MS pattern blocks hotmail.fr when enabled", () => {
    assert.equal(
      isFreeMail("hotmail.fr", { ...opts, patternsEnabled: true }),
      true,
    );
    assert.equal(
      isFreeMail("livechat.com", { ...opts, patternsEnabled: true }),
      false,
    );
  });
});

describe("companyDomainKey", () => {
  it("null for freemail, domain for corporate", () => {
    assert.equal(companyDomainKey("a@gmail.com", opts), null);
    assert.equal(companyDomainKey("biuro@owocni.pl", opts), "owocni.pl");
  });

  it("normalizes googlemail → gmail", () => {
    const n = normalizeEmail("J.K+x@googlemail.com");
    assert.equal(n.invalid, false);
    assert.equal(n.email, "jk@gmail.com");
  });
});

describe("registrableDomain (simplified PSL)", () => {
  it("handles co.uk and com.pl", () => {
    assert.equal(registrableDomain("mail.firma.pl"), "firma.pl");
    assert.equal(registrableDomain("firma.co.uk"), "firma.co.uk");
    assert.equal(registrableDomain("onet.com.pl"), "onet.com.pl");
  });
});

resetFreeMailCache();
