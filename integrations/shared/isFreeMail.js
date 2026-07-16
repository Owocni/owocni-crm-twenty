/**
 * isFreeMail.js — company_domain_key gate (SSOT free_mail_domains v1).
 *
 * Reguła: is_free_mail(eTLD+1) → company_domain_key = null (NIE mintuj / NIE łącz firmy).
 * Exact match w JSON. Opcjonalne wzorce zakotwiczone (^…$) — domyślnie WYŁĄCZONE.
 * ZAKAZ substring („domena zawiera gmail/live/me.com”) — false-positive na acme.com, livechat.com, …
 *
 * SSOT kanoniczny: owocni-crm/data/free_mail_domains_v1.json (gen_free_mail.py)
 * Runtime bundle: integrations/shared/data/ (obok tego modułu — CF / lokalnie).
 * IDENTITY §5.8.2
 */

"use strict";

const fs = require("fs");
const path = require("path");

let _cache = null;

function defaultJsonPath() {
  const bundled = path.join(__dirname, "data", "free_mail_domains_v1.json");
  if (fs.existsSync(bundled)) return bundled;
  return path.join(
    __dirname,
    "..",
    "..",
    "owocni-crm",
    "data",
    "free_mail_domains_v1.json",
  );
}

function loadRules(jsonPath) {
  if (_cache && !jsonPath) return _cache;
  const file = jsonPath || defaultJsonPath();
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const set = new Set(Object.keys(raw.domains || {}));
  const patternsEnabled = raw.patterns_optional === false;
  const patterns = (raw.patterns || []).map((p) => ({
    re: new RegExp(p.re),
    provider: p.provider,
    tier: p.tier,
  }));
  const neverBlock = new Set(raw.never_block || []);
  _cache = {
    raw,
    set,
    patternsEnabled,
    patterns,
    neverBlock,
    version: raw.version,
  };
  return _cache;
}

function resetFreeMailCache() {
  _cache = null;
}

/**
 * Normalizacja e-maila (IDENTITY §5.8.1 / SSOT §4.1).
 * Bez pełnego PSL — domain to hostname po @ (lowercase, googlemail→gmail).
 */
function normalizeEmail(raw) {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  const at = s.lastIndexOf("@");
  if (at < 1 || s.indexOf("@") !== at) {
    return { invalid: true, email: null, domain: null };
  }
  let local = s.slice(0, at);
  let domain = s.slice(at + 1);
  if (!domain || domain.includes(" ") || domain.startsWith(".") || domain.endsWith(".")) {
    return { invalid: true, email: null, domain: null };
  }
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") {
    local = local.split("+")[0].replace(/\./g, "");
  }
  return { invalid: false, email: `${local}@${domain}`, domain };
}

/**
 * Uproszczony eTLD+1 bez pełnego PSL.
 * Wystarczy dla typowych `.pl` / `.com` / `.co.uk` używanych w leadach.
 * Docelowo: tldts / psl (SSOT §4.2).
 */
function registrableDomain(domain) {
  if (!domain) return null;
  const d = String(domain).toLowerCase().trim();
  const parts = d.split(".").filter(Boolean);
  if (parts.length < 2) return d;
  const multi = new Set([
    "co.uk",
    "com.au",
    "com.br",
    "com.pl",
    "net.pl",
    "com.mx",
    "com.tr",
    "com.ar",
    "co.jp",
    "co.nz",
    "co.il",
    "co.th",
    "co.kr",
    "co.id",
    "com.cn",
    "com.hk",
    "com.sg",
    "com.tw",
    "com.ph",
    "com.vn",
    "com.pe",
    "com.ve",
    "com.co",
    "com.my",
    "com.gr",
    "ne.jp",
    "on.net",
  ]);
  const last2 = parts.slice(-2).join(".");
  if (multi.has(last2) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return last2;
}

function isFreeMail(domainReg, options) {
  const rules = loadRules(options && options.jsonPath);
  if (!domainReg) return true;
  const d = String(domainReg).toLowerCase().trim();
  if (rules.neverBlock.has(d)) return false;
  if (rules.set.has(d)) return true;
  const enablePatterns =
    options && options.patternsEnabled !== undefined
      ? options.patternsEnabled
      : rules.patternsEnabled;
  if (enablePatterns && rules.patterns.some((p) => p.re.test(d))) {
    return true;
  }
  return false;
}

function companyDomainKey(rawEmail, options) {
  const n = normalizeEmail(rawEmail);
  if (n.invalid) return null;
  const reg = registrableDomain(n.domain);
  return isFreeMail(reg, options) ? null : reg;
}

module.exports = {
  loadRules,
  resetFreeMailCache,
  normalizeEmail,
  registrableDomain,
  isFreeMail,
  companyDomainKey,
};
