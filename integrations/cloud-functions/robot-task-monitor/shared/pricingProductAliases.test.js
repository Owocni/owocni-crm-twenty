"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  splitPricingKey,
  aliasSlugsFor,
  listPricingKeyCandidates,
  getPricingValue,
  buildBizPricingKey,
  resolvePurchasePricingValue,
} = require("./pricingProductAliases");

const STRONY = { google_ads: 250, meta: 300, ga4: 300 };
const LOGO = { google_ads: 80, meta: 90, ga4: 100 };
const NAZWA = { google_ads: 40, meta: 50, ga4: 60 };
const COPY = { google_ads: 70, meta: 75, ga4: 80 };
const MARKETING = { google_ads: 110, meta: 120, ga4: 130 };
const OPAK = { google_ads: 15, meta: 16, ga4: 17 };
const OTHER = { google_ads: 1, meta: 1, ga4: 1 };
const WEB_ROW = { google_ads: 251, meta: 301, ga4: 301 };

describe("splitPricingKey", () => {
  it("splits known prefixes", () => {
    assert.deepEqual(splitPricingKey("sql_WEB"), {
      prefix: "sql",
      product: "WEB",
    });
    assert.deepEqual(splitPricingKey("lead_strony"), {
      prefix: "lead",
      product: "strony",
    });
    assert.deepEqual(splitPricingKey("rejected_logo"), {
      prefix: "rejected",
      product: "logo",
    });
    assert.deepEqual(splitPricingKey("purchase_WEB"), {
      prefix: "purchase",
      product: "WEB",
    });
  });

  it("keeps unprefixed product as product", () => {
    assert.deepEqual(splitPricingKey("strony"), {
      prefix: "",
      product: "strony",
    });
  });
});

describe("aliasSlugsFor", () => {
  it("maps Twenty WEB and Sortownia strony/strona together", () => {
    assert.deepEqual(aliasSlugsFor("WEB"), ["web", "strony", "strona"]);
    assert.deepEqual(aliasSlugsFor("strona"), ["strona", "strony", "web"]);
    assert.deepEqual(aliasSlugsFor("strony"), ["strony", "strona", "web"]);
  });

  it("keeps NAME and COPYWRITING as separate families", () => {
    assert.ok(aliasSlugsFor("NAME").includes("nazwa"));
    assert.equal(aliasSlugsFor("NAME").includes("copywriting"), false);
    assert.ok(aliasSlugsFor("COPYWRITING").includes("copywriting"));
    assert.equal(aliasSlugsFor("COPYWRITING").includes("nazwa"), false);
  });
});

describe("getPricingValue aliases", () => {
  it("prefers exact sql_WEB when both WEB and strony exist", () => {
    const config = { sql_WEB: WEB_ROW, sql_strony: STRONY, Other: OTHER };
    const hit = getPricingValue("sql_WEB", "google_ads", config);
    assert.equal(hit.value, 251);
    assert.equal(hit.matchedKey, "sql_WEB");
    assert.equal(hit.fallbackOther, false);
  });

  it("falls back sql_WEB → sql_strony when WEB row is missing", () => {
    const config = { sql_strony: STRONY, Other: OTHER };
    const hit = getPricingValue("sql_WEB", "google_ads", config);
    assert.equal(hit.value, 250);
    assert.equal(hit.matchedKey, "sql_strony");
  });

  it("matches sql_strona (Brokersmedia) without walking to Other", () => {
    const config = { sql_strona: STRONY, Other: OTHER };
    const hit = getPricingValue("sql_strona", "google_ads", config);
    assert.equal(hit.value, 250);
    assert.equal(hit.matchedKey, "sql_strona");
  });

  it("keeps lead_strony exact (does not steal sql value)", () => {
    const config = {
      lead_strony: { google_ads: 1, meta: 1, ga4: 1 },
      sql_strony: STRONY,
    };
    const hit = getPricingValue("lead_strony", "google_ads", config);
    assert.equal(hit.value, 1);
    assert.equal(hit.matchedKey, "lead_strony");
  });

  it("maps Twenty uppercase products to historical lowercase keys", () => {
    const config = {
      sql_logo: LOGO,
      sql_nazwa: NAZWA,
      sql_copywriting: COPY,
      sql_marketing: MARKETING,
      sql_opakowanie: OPAK,
      Other: OTHER,
    };
    assert.equal(
      getPricingValue("sql_LOGO", "google_ads", config).matchedKey,
      "sql_logo",
    );
    assert.equal(
      getPricingValue("sql_NAME", "google_ads", config).matchedKey,
      "sql_nazwa",
    );
    assert.equal(
      getPricingValue("sql_COPYWRITING", "google_ads", config).matchedKey,
      "sql_copywriting",
    );
    assert.equal(
      getPricingValue("sql_MARKETING", "google_ads", config).matchedKey,
      "sql_marketing",
    );
    assert.equal(
      getPricingValue("sql_OPAKOWANIE", "google_ads", config).matchedKey,
      "sql_opakowanie",
    );
    assert.equal(getPricingValue("sql_LOGO", "google_ads", config).value, 80);
    assert.equal(getPricingValue("sql_NAME", "ga4", config).value, 60);
  });

  it("does not alias NAME onto copywriting rows", () => {
    const config = { sql_copywriting: COPY, Other: OTHER };
    const hit = getPricingValue("sql_NAME", "google_ads", config);
    assert.equal(hit.matchedKey, "Other");
    assert.equal(hit.fallbackOther, true);
  });

  it("falls back to Other for unknown product", () => {
    const config = { sql_strony: STRONY, Other: OTHER };
    const hit = getPricingValue("sql_UNKNOWN", "google_ads", config);
    assert.equal(hit.value, 1);
    assert.equal(hit.fallbackOther, true);
  });

  it("is case-insensitive on sheet keys", () => {
    const config = { sql_Strony: STRONY };
    const hit = getPricingValue("sql_WEB", "meta", config);
    assert.equal(hit.value, 300);
    assert.equal(hit.matchedKey, "sql_Strony");
  });

  it("lists WEB candidates before Other", () => {
    const keys = listPricingKeyCandidates("sql_WEB");
    assert.ok(keys.indexOf("sql_strony") < keys.length);
    assert.ok(keys.includes("sql_strona"));
    assert.equal(keys.includes("Other"), false);
  });
});

describe("buildBizPricingKey", () => {
  it("lowercases Twenty SELECT values", () => {
    assert.equal(buildBizPricingKey("purchase", "LOGO"), "purchase_logo");
    assert.equal(
      buildBizPricingKey("purchase", "COPYWRITING"),
      "purchase_copywriting",
    );
  });
});

describe("resolvePurchasePricingValue", () => {
  it("does not let Other=1 beat sql_logo when purchase_logo is missing", () => {
    const config = {
      sql_logo: LOGO,
      Other: OTHER,
    };
    const hit = resolvePurchasePricingValue("LOGO", config, "google_ads");
    assert.equal(hit.value, 80);
    assert.equal(hit.matchedKey, "sql_logo");
    assert.equal(hit.fallbackOther, false);
  });

  it("uses purchase_logo when present", () => {
    const config = {
      purchase_logo: { google_ads: 2000, meta: 2000, ga4: 2000 },
      sql_logo: LOGO,
      Other: OTHER,
    };
    const hit = resolvePurchasePricingValue("logo", config, "google_ads");
    assert.equal(hit.value, 2000);
    assert.equal(hit.matchedKey, "purchase_logo");
  });

  it("falls back to Other only when product rows are missing", () => {
    const config = { Other: OTHER };
    const hit = resolvePurchasePricingValue("LOGO", config, "google_ads");
    assert.equal(hit.value, 1);
    assert.equal(hit.matchedKey, "Other");
  });
});
