"use strict";

/**
 * GUS BIR1.1 client (prod via GUS_BIR_KEY).
 * Uses bir1 for SOAP session (Zaloguj → DaneSzukajPodmioty → DanePobierzPelnyRaport → Wyloguj).
 */

const Bir = require("bir1").default;

const KNOWN_SANDBOX_KEYS = new Set(["abcde12345abcde12345"]);

function isSandboxKey(key) {
  const k = String(key || "").trim();
  if (!k) return false;
  if (KNOWN_SANDBOX_KEYS.has(k)) return true;
  return /test|sandbox/i.test(k);
}

function firstRow(result) {
  if (!result) return null;
  if (Array.isArray(result)) return result[0] || null;
  return result;
}

function pick(obj, keys) {
  if (!obj || typeof obj !== "object") return "";
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function formatPostcode(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return String(raw || "").trim();
}

function buildStreet(ulica, nrNier, nrLok) {
  const parts = [ulica, nrNier].filter(Boolean);
  let street = parts.join(" ").trim();
  if (nrLok) street = street ? `${street}/${nrLok}` : `lok. ${nrLok}`;
  return street;
}

function extractPkd(pkdResult) {
  const rows = !pkdResult
    ? []
    : Array.isArray(pkdResult)
      ? pkdResult
      : [pkdResult];
  if (!rows.length) return "";
  const primary =
    rows.find((r) =>
      ["1", "true", "True"].includes(
        String(
          r.praw_pkdPrzewazajace ||
            r.fiz_pkdPrzewazajace ||
            r.fiz_pkd_Przewazajace ||
            r.pkdPrzewazajace ||
            "",
        ),
      ),
    ) || rows[0];
  const code = pick(primary, [
    "praw_pkdKod",
    "fiz_pkdKod",
    "fiz_pkd_Kod",
    "pkdKod",
  ]);
  const name = pick(primary, [
    "praw_pkdNazwa",
    "fiz_pkdNazwa",
    "fiz_pkd_Nazwa",
    "pkdNazwa",
  ]);
  if (code && name) return `${code} — ${name}`;
  return code || name || "";
}

function extractFromSearch(row) {
  if (!row) return {};
  const out = {};
  const nazwa = pick(row, ["Nazwa", "nazwa"]);
  if (nazwa) out.legalName = nazwa;
  const regon = pick(row, ["Regon", "regon"]);
  if (regon) out.regon = regon.replace(/\D/g, "");
  const nip = pick(row, ["Nip", "nip"]);
  if (nip) out.nip = nip.replace(/\D/g, "");

  const street = buildStreet(
    pick(row, ["Ulica", "ulica"]),
    pick(row, ["NrNieruchomosci", "nrNieruchomosci"]),
    pick(row, ["NrLokalu", "nrLokalu"]),
  );
  const postcode = formatPostcode(pick(row, ["KodPocztowy", "kodPocztowy"]));
  const city = pick(row, ["Miejscowosc", "miejscowosc"]);
  if (street || postcode || city) {
    out.registeredAddress = {
      ...(street ? { addressStreet1: street } : {}),
      ...(postcode ? { addressPostcode: postcode } : {}),
      ...(city ? { addressCity: city } : {}),
      addressCountry: "Poland",
    };
  }
  return out;
}

function extractFromPrawna(rep) {
  if (!rep) return {};
  const out = {};
  const nazwa = pick(rep, ["praw_nazwa", "praw_nazwaSkrocona"]);
  if (nazwa) out.legalName = nazwa;
  const forma = pick(rep, [
    "praw_szczegolnaFormaPrawna_Nazwa",
    "praw_podstawowaFormaPrawna_Nazwa",
  ]);
  if (forma) out.legalForm = forma;
  const regDate = pick(rep, [
    "praw_dataRozpoczeciaDzialalnosci",
    "praw_dataPowstania",
    "praw_dataWpisuDoRejestruEwidencji",
    "praw_dataWpisuDoRegon",
  ]);
  if (regDate) out.registrationDate = regDate;

  const street = buildStreet(
    pick(rep, ["praw_adSiedzUlica_Nazwa"]),
    pick(rep, ["praw_adSiedzNumerNieruchomosci"]),
    pick(rep, ["praw_adSiedzNumerLokalu"]),
  );
  const postcode = formatPostcode(pick(rep, ["praw_adSiedzKodPocztowy"]));
  const city = pick(rep, ["praw_adSiedzMiejscowosc_Nazwa"]);
  if (street || postcode || city) {
    out.registeredAddress = {
      ...(street ? { addressStreet1: street } : {}),
      ...(postcode ? { addressPostcode: postcode } : {}),
      ...(city ? { addressCity: city } : {}),
      addressCountry: "Poland",
    };
  }
  return out;
}

function extractFromFizyczna(rep) {
  if (!rep) return {};
  const out = {};
  const firma = pick(rep, ["fiz_nazwa", "fiz_nazwaSkrocona", "fizC_Nazwa"]);
  if (firma) {
    out.legalName = firma;
  } else {
    const person = [pick(rep, ["fiz_imie1"]), pick(rep, ["fiz_nazwisko"])]
      .filter(Boolean)
      .join(" ");
    if (person) out.legalName = person;
  }
  const forma = pick(rep, [
    "fiz_szczegolnaFormaPrawna_Nazwa",
    "fiz_podstawowaFormaPrawna_Nazwa",
  ]);
  out.legalForm =
    forma || "JEDNOOSOBOWA DZIAŁALNOŚĆ GOSPODARCZA";
  const regDate = pick(rep, [
    "fiz_dataRozpoczeciaDzialalnosci",
    "fiz_dataPowstania",
    "fiz_dataWpisuDzialalnosciDoRegon",
    "fiz_dataWpisuPodmiotuDoRegon",
    "fizC_dataWpisuDoRejestruEwidencji",
  ]);
  if (regDate) out.registrationDate = regDate;

  const street = buildStreet(
    pick(rep, ["fiz_adSiedzUlica_Nazwa", "fizC_adSiedzUlica_Nazwa"]),
    pick(rep, [
      "fiz_adSiedzNumerNieruchomosci",
      "fizC_adSiedzNumerNieruchomosci",
    ]),
    pick(rep, ["fiz_adSiedzNumerLokalu", "fizC_adSiedzNumerLokalu"]),
  );
  const postcode = formatPostcode(
    pick(rep, ["fiz_adSiedzKodPocztowy", "fizC_adSiedzKodPocztowy"]),
  );
  const city = pick(rep, [
    "fiz_adSiedzMiejscowosc_Nazwa",
    "fizC_adSiedzMiejscowosc_Nazwa",
  ]);
  if (street || postcode || city) {
    out.registeredAddress = {
      ...(street ? { addressStreet1: street } : {}),
      ...(postcode ? { addressPostcode: postcode } : {}),
      ...(city ? { addressCity: city } : {}),
      addressCountry: "Poland",
    };
  }
  return out;
}

/**
 * @param {{ nip?: string, regon?: string, krs?: string }} query
 * @param {string} apiKey production BIR key
 * @returns {Promise<{ fields: object, search: object|null, typ: string }>}
 */
async function fetchGusEnrichment(query, apiKey) {
  const key = String(apiKey || "").trim();
  if (!key) throw new Error("GUS_BIR_KEY missing");
  if (isSandboxKey(key)) {
    throw new Error("sandbox_key_blocked");
  }

  const bir = new Bir({ key });
  await bir.login();
  try {
    const q = {};
    if (query.nip) q.nip = String(query.nip).replace(/\D/g, "");
    else if (query.regon) q.regon = String(query.regon).replace(/\D/g, "");
    else if (query.krs) q.krs = String(query.krs).replace(/\D/g, "");
    else throw new Error("GUS: brak nip/regon/krs");

    const searchRaw = await bir.search(q);
    const row = firstRow(searchRaw);
    if (!row) {
      return { fields: {}, search: null, typ: "" };
    }

    const typ = String(row.Typ || row.typ || "").toUpperCase();
    const regon = String(row.Regon || row.regon || "").replace(/\D/g, "");
    const fields = { ...extractFromSearch(row) };

    if (regon) {
      if (typ === "P") {
        const rep = await bir.report({ regon, report: "BIR11OsPrawna" });
        Object.assign(fields, extractFromPrawna(firstRow(rep) || rep));
        try {
          const pkd = await bir.report({ regon, report: "BIR11OsPrawnaPkd" });
          const pkdStr = extractPkd(pkd);
          if (pkdStr) fields.pkd = pkdStr;
        } catch {
          /* PKD optional */
        }
      } else if (typ === "F") {
        const ogolne = await bir.report({
          regon,
          report: "BIR11OsFizycznaDaneOgolne",
        });
        const ogolneRow = firstRow(ogolne) || ogolne;
        Object.assign(fields, extractFromFizyczna(ogolneRow));
        // CEIDG activity report has firm name, address, registration date
        if (String(ogolneRow?.fiz_dzialalnoscCeidg || "") === "1") {
          try {
            const ceidg = await bir.report({
              regon,
              report: "BIR11OsFizycznaDzialalnoscCeidg",
            });
            Object.assign(fields, extractFromFizyczna(firstRow(ceidg) || ceidg));
          } catch {
            /* optional */
          }
        }
        try {
          const pkd = await bir.report({ regon, report: "BIR11OsFizycznaPkd" });
          const pkdStr = extractPkd(pkd);
          if (pkdStr) fields.pkd = pkdStr;
        } catch {
          /* PKD optional */
        }
      }
    }

    return { fields, search: row, typ };
  } finally {
    await bir.logout().catch(() => null);
  }
}

module.exports = {
  fetchGusEnrichment,
  isSandboxKey,
  formatPostcode,
  extractPkd,
};
