"use strict";

/**
 * Aliasy produktu dla Pricing_Config (Robot → Google Ads / Meta / GA4).
 *
 * Twenty SELECT (PF-9): WEB, LOGO, NAME, MARKETING, COPYWRITING, OPAKOWANIE, INNE
 * Sortownia / historyczny cennik: strony, logo, nazwa, marketing, copywriting, opakowanie
 *
 * Lookup: exact key → aliasy (case-insensitive) → klucz bez prefiksu → Other.
 */

const PRICING_PREFIXES = ["rejected", "purchase", "lead", "sql", "won"];

const EVENT_PRICING_PREFIX = {
  generate_lead: "lead",
  qualify_lead: "sql",
  purchase: "purchase",
  rejected_lead: "rejected",
};

const PRODUCT_ALIAS_GROUPS = [
  ["strony", "strona", "web"],
  ["logo"],
  ["nazwa", "naming", "nazwy", "name"],
  ["marketing", "strategia", "konsultacje"],
  ["copywriting", "teksty", "nazwa/teksty", "nazwa/tekst"],
  ["opakowanie", "packaging"],
  ["inne", "other"],
];

function normalizeProductSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function splitPricingKey(pricingKey) {
  const raw = String(pricingKey || "").trim();
  if (!raw) return { prefix: "", product: "" };
  const lower = raw.toLowerCase();
  for (const prefix of PRICING_PREFIXES) {
    const token = prefix + "_";
    if (lower.startsWith(token)) {
      return { prefix, product: raw.slice(token.length) };
    }
  }
  return { prefix: "", product: raw };
}

function aliasSlugsFor(product) {
  const slug = normalizeProductSlug(product);
  if (!slug) return [];
  for (const group of PRODUCT_ALIAS_GROUPS) {
    if (group.includes(slug)) {
      const ordered = [slug];
      for (const item of group) {
        if (!ordered.includes(item)) ordered.push(item);
      }
      return ordered;
    }
  }
  return [slug];
}

function uniquePush(list, value) {
  if (!value) return;
  if (!list.includes(value)) list.push(value);
}

function listPricingKeyCandidates(pricingKey) {
  const original = String(pricingKey || "").trim();
  const keys = [];
  uniquePush(keys, original);
  if (!original) return keys;

  const { prefix, product } = splitPricingKey(original);
  const slugs = aliasSlugsFor(product);

  for (const slug of slugs) {
    if (prefix) {
      uniquePush(keys, `${prefix}_${slug}`);
      uniquePush(keys, `${prefix}_${slug.toUpperCase()}`);
    }
    uniquePush(keys, slug);
    uniquePush(keys, slug.toUpperCase());
  }

  return keys;
}

function findPricingRow(pricingConfig, key) {
  if (!pricingConfig || !key) return null;
  if (
    Object.prototype.hasOwnProperty.call(pricingConfig, key) &&
    pricingConfig[key]
  ) {
    return { key, config: pricingConfig[key] };
  }
  const lower = key.toLowerCase();
  for (const existing of Object.keys(pricingConfig)) {
    if (existing.toLowerCase() === lower && pricingConfig[existing]) {
      return { key: existing, config: pricingConfig[existing] };
    }
  }
  return null;
}

function lookupPricingConfig(pricingKey, pricingConfig) {
  if (!pricingKey || !pricingConfig) {
    return { matchedKey: null, config: null, fallbackOther: false };
  }
  for (const candidate of listPricingKeyCandidates(pricingKey)) {
    const hit = findPricingRow(pricingConfig, candidate);
    if (hit) {
      return { matchedKey: hit.key, config: hit.config, fallbackOther: false };
    }
  }
  const other = findPricingRow(pricingConfig, "Other");
  if (other) {
    return {
      matchedKey: other.key,
      config: other.config,
      fallbackOther: true,
    };
  }
  return { matchedKey: null, config: null, fallbackOther: false };
}

function getPricingValue(pricingKey, platform, pricingConfig) {
  const hit = lookupPricingConfig(pricingKey, pricingConfig);
  if (!hit.config) {
    return {
      value: null,
      matchedKey: null,
      requestedKey: pricingKey,
      fallbackOther: false,
    };
  }
  const value = hit.config[platform] ?? null;
  return {
    value,
    matchedKey: hit.matchedKey,
    requestedKey: pricingKey,
    fallbackOther: !!hit.fallbackOther,
  };
}

function buildBizPricingKey(eventName, product) {
  const prefix = EVENT_PRICING_PREFIX[eventName];
  if (!prefix) return "";
  const slug = normalizeProductSlug(product);
  if (!slug) return "";
  return `${prefix}_${slug}`;
}

function lookupPricingConfigExactFamily(pricingKey, pricingConfig) {
  const hit = lookupPricingConfig(pricingKey, pricingConfig);
  if (hit.fallbackOther) {
    return { matchedKey: null, config: null, fallbackOther: false };
  }
  return hit;
}

/**
 * Purchase: najpierw purchase_{product}, potem sql_{product}, dopiero Other.
 * getPricingValue(purchase_X) samo wpada w Other=1 gdy brak wiersza purchase_* —
 * to zjada prawdziwy cennik sql_logo / sql_copywriting.
 */
function resolvePurchasePricingValue(product, pricingConfig, platform) {
  const purchaseKey = buildBizPricingKey("purchase", product) || "purchase_other";
  let hit = lookupPricingConfigExactFamily(purchaseKey, pricingConfig);
  if (!hit.config && product) {
    hit = lookupPricingConfigExactFamily(
      buildBizPricingKey("qualify_lead", product),
      pricingConfig,
    );
  }
  if (!hit.config) {
    hit = lookupPricingConfig("Other", pricingConfig);
  }
  const value = hit.config ? (hit.config[platform] ?? null) : null;
  return {
    value,
    matchedKey: hit.matchedKey,
    requestedKey: purchaseKey,
    fallbackOther: !!hit.fallbackOther,
  };
}

module.exports = {
  PRICING_PREFIXES,
  PRODUCT_ALIAS_GROUPS,
  EVENT_PRICING_PREFIX,
  splitPricingKey,
  aliasSlugsFor,
  listPricingKeyCandidates,
  lookupPricingConfig,
  getPricingValue,
  buildBizPricingKey,
  resolvePurchasePricingValue,
};
