"use strict";

/**
 * ENRICH_COMPANY_PL — gov-direct enrichment for Company (KSeF-ready fields).
 * Sources: MF Wykaz VAT (no key) · KRS Open API (no key) · GUS BIR1.1 (when GUS_BIR_KEY set).
 * Writer = this worker (GCP = all writes). Auth: X-Enrich-Token / ENRICH_COMPANY_PL_TOKEN.
 */

const {
  twentyRequest,
  extractCreatedId,
  patchTwentyRecord,
  buildTwentyListPath,
  parseTwentyListRecords,
  getCompanyById,
} = require("../shared/twentyRest");
const { fetchGusEnrichment, isSandboxKey } = require("../shared/gusBir");

const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7];
const PENDING = new Map(); // companyId+day → true (in-process idempotency)

function enrichTokenOk(req) {
  const expected = process.env.ENRICH_COMPANY_PL_TOKEN;
  if (!expected) return false;
  const got =
    req.headers["x-enrich-token"] ||
    req.headers["X-Enrich-Token"] ||
    (req.body && req.body.enrichToken);
  return String(got || "") === String(expected);
}

function normalizeId(raw) {
  return String(raw || "")
    .trim()
    .replace(/^PL/i, "")
    .replace(/[\s-]/g, "");
}

function nipChecksumOk(nip) {
  if (!/^\d{10}$/.test(nip)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(nip[i]) * NIP_WEIGHTS[i];
  const control = sum % 11;
  if (control === 10) return false;
  return control === Number(nip[9]);
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function pendingKey(companyId) {
  return `${companyId}:${todayYmd()}`;
}

async function createNoteOnCompany(companyId, title, markdown, opportunityId) {
  const noteRes = await twentyRequest("POST", "/notes", {
    title,
    bodyV2: { markdown },
  });
  if (noteRes.statusCode < 200 || noteRes.statusCode >= 300) {
    console.error("enrich note create failed", noteRes.statusCode, noteRes.rawBody);
    return null;
  }
  const noteId = extractCreatedId("notes", noteRes.body);
  if (!noteId) return null;
  if (companyId) {
    await twentyRequest("POST", "/noteTargets", {
      noteId,
      companyId,
    }).catch((err) => console.error("enrich noteTarget failed", err.message));
  }
  if (opportunityId) {
    await twentyRequest("POST", "/noteTargets", {
      noteId,
      opportunityId,
    }).catch((err) => console.error("enrich opp noteTarget failed", err.message));
  }
  return noteId;
}

function pickPreferredNip(...candidates) {
  for (const raw of candidates) {
    const n = normalizeId(raw);
    if (n && nipChecksumOk(n)) return n;
  }
  return "";
}

async function getOpportunityById(opportunityId) {
  const id = String(opportunityId || "").trim();
  if (!id) return null;
  const res = await twentyRequest(
    "GET",
    `/opportunities/${encodeURIComponent(id)}`,
  );
  if (res.statusCode === 404) return null;
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`get opportunity HTTP ${res.statusCode} ${res.rawBody}`);
  }
  return res.body?.data?.opportunity || res.body?.data || null;
}

async function createCompanyWithNip(nip) {
  const res = await twentyRequest("POST", "/companies", {
    name: `NIP ${nip}`,
    nip,
  });
  if (res.statusCode >= 200 && res.statusCode < 300) {
    const id =
      res.body?.data?.createCompany?.id ||
      res.body?.data?.company?.id ||
      extractCreatedId("companies", res.body);
    if (id) return id;
    throw new Error(`create company: no id ${res.rawBody}`);
  }
  const matches = await findCompanyByNip(nip);
  if (matches[0]?.id) return matches[0].id;
  throw new Error(`create company HTTP ${res.statusCode} ${res.rawBody}`);
}

/**
 * Lead NIP wins when valid. No company → find-or-create by NIP and attach.
 * Attached company with a different NIP → attach the taxpayer for the lead NIP
 * instead of overwriting the existing company.
 */
async function resolveCompanyForLead(record) {
  const opportunityId = String(record.opportunityId || "").trim();
  let companyId = String(record.companyId || record.id || "").trim();
  let opportunity = null;
  if (opportunityId) {
    opportunity = await getOpportunityById(opportunityId);
    if (!companyId) {
      companyId = String(
        opportunity?.companyId || opportunity?.company?.id || "",
      ).trim();
    }
  }
  const company = companyId ? await getCompanyById(companyId) : null;
  const nip = pickPreferredNip(opportunity?.nip, record.nip, company?.nip);
  if (!nip) {
    return {
      ok: false,
      skipped: "no_identifier",
      error: "uzupełnij NIP",
      companyId: companyId || null,
      opportunityId: opportunityId || null,
    };
  }

  const matches = await findCompanyByNip(nip);
  const existing = matches[0] || null;
  const companyNip = company ? normalizeId(company.nip) : "";
  const companyNipOk = Boolean(companyNip && nipChecksumOk(companyNip));

  let targetId = companyId;
  let created = false;
  let relinked = false;

  if (!targetId) {
    targetId = existing?.id || (await createCompanyWithNip(nip));
    created = !existing;
    if (opportunityId) {
      await patchTwentyRecord("opportunities", opportunityId, {
        companyId: targetId,
      });
      relinked = true;
    }
  } else if (existing && existing.id !== targetId) {
    targetId = existing.id;
    if (opportunityId) {
      await patchTwentyRecord("opportunities", opportunityId, {
        companyId: targetId,
      });
    }
    relinked = true;
  } else if (companyNipOk && companyNip !== nip) {
    targetId = existing?.id || (await createCompanyWithNip(nip));
    created = !existing;
    if (opportunityId) {
      await patchTwentyRecord("opportunities", opportunityId, {
        companyId: targetId,
      });
    }
    relinked = true;
  }

  return {
    ok: true,
    companyId: targetId,
    nip,
    opportunityId: opportunityId || null,
    created,
    relinked,
  };
}

function mapVatStatus(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s === "czynny" || s === "active") return "CZYNNY";
  if (s.includes("zwolnion")) return "ZWOLNIONY";
  return "NIEZAREJESTROWANY";
}

function parseMfAddress(subject) {
  const src =
    subject?.residenceAddress ||
    subject?.workingAddress ||
    subject?.address ||
    "";
  const text = String(src || "").trim();
  if (!text) return null;
  // Typical MF: "UL. FOO 1/2, 00-001 WARSZAWA"
  const m = text.match(/^(.+?),\s*(\d{2}-\d{3})\s+(.+)$/i);
  if (m) {
    return {
      addressStreet1: m[1].trim(),
      addressPostcode: m[2].trim(),
      addressCity: m[3].trim(),
      addressCountry: "Poland",
    };
  }
  return {
    addressStreet1: text,
    addressCountry: "Poland",
  };
}

async function fetchMfVat(nip) {
  const date = todayYmd();
  const url = `https://wl-api.mf.gov.pl/api/search/nip/${encodeURIComponent(nip)}?date=${date}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "owocni-enrich/1.0" },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const code = body?.code || body?.message || res.status;
    throw new Error(`MF VAT HTTP ${res.status}: ${code}`);
  }
  const result = body?.result || body;
  const subject = result?.subject || null;
  const requestId = result?.requestId || body?.requestId || null;
  return { subject, requestId, raw: body };
}

async function fetchKrs(krs) {
  const padded = String(krs).padStart(10, "0");
  const url = `https://api-krs.ms.gov.pl/api/krs/OdpisAktualny/${padded}?rejestr=P&format=json`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "owocni-enrich/1.0" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`KRS HTTP ${res.status}`);
  return res.json();
}

function extractKrsFields(odpis) {
  if (!odpis || typeof odpis !== "object") return {};
  const out = {};
  const blob = JSON.stringify(odpis);
  // Best-effort extraction — structure confirmed on G4; keep soft.
  const kapital = odpis?.dane?.dzial1?.kapital?.wysokoscKapitaluZakladowego
    || odpis?.odpis?.dane?.dzial1?.kapital?.wysokoscKapitaluZakladowego;
  if (kapital) {
    const n = Number(String(kapital).replace(/[^\d.,]/g, "").replace(",", "."));
    if (Number.isFinite(n)) {
      out.shareCapital = {
        amountMicros: Math.round(n * 1_000_000),
        currencyCode: "PLN",
      };
    }
  }
  const forma =
    odpis?.dane?.dzial1?.danePodmiotu?.formaPrawna
    || odpis?.odpis?.dane?.dzial1?.danePodmiotu?.formaPrawna;
  if (forma) out.legalForm = String(forma);

  const nazwa =
    odpis?.dane?.dzial1?.danePodmiotu?.nazwa
    || odpis?.odpis?.dane?.dzial1?.danePodmiotu?.nazwa;
  if (nazwa) out.legalName = String(nazwa);

  // Board members — soft scan
  const members = [];
  const re = /"imie"\s*:\s*"([^"]+)".*?"nazwisko"\s*:\s*"([^"]+)"/gi;
  let m;
  const seen = new Set();
  while ((m = re.exec(blob)) && members.length < 20) {
    const name = `${m[1]} ${m[2]}`.trim();
    if (!seen.has(name)) {
      seen.add(name);
      members.push(name);
    }
  }
  if (members.length) out.boardMembers = members.join("; ");
  return out;
}

async function findCompanyByNip(nip) {
  const path = buildTwentyListPath("companies", `nip[eq]:${nip}`, 5);
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) return [];
  return parseTwentyListRecords("companies", res.body).filter(
    (c) => normalizeId(c.nip) === nip,
  );
}

async function enrichOne(record) {
  const companyId = String(record.companyId || record.id || "").trim();
  const opportunityId = String(record.opportunityId || "").trim() || null;
  if (!companyId) return { ok: false, error: "missing companyId" };

  const nip = normalizeId(record.nip);
  const regon = normalizeId(record.regon);
  const krs = normalizeId(record.krs);
  const hasIdentifier = Boolean(nip || regon || krs);
  const company = await getCompanyById(companyId);

  if (!hasIdentifier) {
    await createNoteOnCompany(
      companyId,
      "Enrich: brak identyfikatora",
      "Uzupełnij **NIP** na leadzie (albo na Firmie) i kliknij ponownie „Uzupełnij dane (GUS/KRS)”.",
      opportunityId,
    );
    return { ok: false, skipped: "no_identifier", companyId, opportunityId };
  }

  if (nip && !nipChecksumOk(nip)) {
    await createNoteOnCompany(
      companyId,
      "Enrich: błędny NIP",
      `NIP \`${nip}\` nie przechodzi sumy kontrolnej. Popraw i kliknij ponownie.`,
      opportunityId,
    );
    return { ok: false, skipped: "bad_nip", companyId, nip, opportunityId };
  }

  const pk = pendingKey(companyId);
  if (PENDING.has(pk)) {
    return { ok: true, skipped: "pending_today", companyId, opportunityId };
  }
  PENDING.set(pk, true);

  const notes = [];
  const patch = {};
  const sources = [];

  if (nip) {
    const dupes = await findCompanyByNip(nip);
    const other = dupes.find((c) => c.id !== companyId);
    if (other) {
      await createNoteOnCompany(
        companyId,
        "Enrich: konflikt NIP",
        `NIP \`${nip}\` już istnieje na rekordzie [${other.name || other.id}](/object/company/${other.id}). Scal ręcznie — zero auto-merge.`,
        opportunityId,
      );
      PENDING.delete(pk);
      return { ok: false, skipped: "nip_unique_conflict", companyId, nip, otherId: other.id, opportunityId };
    }
    patch.nip = nip;
  }
  if (regon) patch.regon = regon;
  if (krs) patch.krs = krs;

  // MF VAT (no key)
  if (nip) {
    try {
      const mf = await fetchMfVat(nip);
      sources.push(`mf:${mf.requestId || "ok"}`);
      if (mf.subject) {
        if (mf.subject.name) patch.legalName = String(mf.subject.name);
        if (mf.subject.statusVat) patch.vatStatus = mapVatStatus(mf.subject.statusVat);
        const addr = parseMfAddress(mf.subject);
        if (addr) patch.registeredAddress = addr;
        if (mf.subject.krs && !patch.krs) patch.krs = normalizeId(mf.subject.krs);
        if (mf.subject.regon && !patch.regon) patch.regon = normalizeId(mf.subject.regon);
      } else {
        notes.push("MF: brak podmiotu w wykazie VAT na dziś.");
      }
    } catch (err) {
      notes.push(`MF VAT: ${err.message}`);
    }
  }

  // KRS (no key) — only when we have krs #
  const krsNo = patch.krs || krs;
  if (krsNo) {
    try {
      const odpis = await fetchKrs(krsNo);
      if (odpis) {
        sources.push("krs");
        Object.assign(patch, extractKrsFields(odpis));
      } else {
        notes.push(`KRS: brak odpisu dla ${krsNo}.`);
      }
    } catch (err) {
      notes.push(`KRS: ${err.message}`);
    }
  }

  // GUS BIR1.1 — prod key only (sandbox must not write to CRM).
  const gusKey = process.env.GUS_BIR_KEY;
  const gusAllowSandbox = process.env.GUS_ALLOW_SANDBOX === "true";
  if (!gusKey) {
    notes.push(
      "GUS: klucz BIR jeszcze nie skonfigurowany — wypełniono z MF/KRS.",
    );
  } else if (!gusAllowSandbox && isSandboxKey(gusKey)) {
    notes.push("GUS: klucz sandbox — pominięto zapis (⛔N16).");
  } else {
    try {
      const gus = await fetchGusEnrichment(
        {
          nip: nip || patch.nip,
          regon: patch.regon || regon,
          krs: patch.krs || krs,
        },
        gusKey,
      );
      if (!gus.search) {
        notes.push("GUS: brak podmiotu dla podanego NIP/REGON/KRS.");
      } else {
        sources.push(`gus:${gus.typ || "ok"}`);
        // GUS overrides MF for registry truth (name/address/regon/pkd/date/form)
        for (const [k, v] of Object.entries(gus.fields || {})) {
          if (v == null || v === "") continue;
          if (k === "registeredAddress" && typeof v === "object") {
            patch.registeredAddress = {
              ...(patch.registeredAddress || {}),
              ...v,
            };
          } else {
            patch[k] = v;
          }
        }
      }
    } catch (err) {
      notes.push(`GUS: ${err.message}`);
    }
  }

  const day = todayYmd();
  patch.enrichedAt = new Date().toISOString();
  patch.enrichmentSource = `gov-direct ${day}${sources.length ? ` [${sources.join(",")}]` : ""}`;
  if (patch.legalName) {
    const currentName = String(company?.name || "").trim();
    if (!currentName || currentName === nip || currentName === `NIP ${nip}`) {
      patch.name = patch.legalName;
    }
  }

  try {
    await patchTwentyRecord("companies", companyId, patch);
  } catch (err) {
    PENDING.delete(pk);
    await createNoteOnCompany(
      companyId,
      "Enrich FAILED",
      `Zapis do Twenty nieudany: ${err.message}`,
      opportunityId,
    );
    return { ok: false, error: err.message, companyId, opportunityId };
  }

  if (notes.length) {
    await createNoteOnCompany(
      companyId,
      "Enrich: uwagi",
      notes.map((n) => `- ${n}`).join("\n"),
      opportunityId,
    );
  }

  return {
    ok: true,
    companyId,
    opportunityId,
    fields: Object.keys(patch),
    notes,
    sources,
  };
}

/**
 * HTTP entry: action enrich_company_pl
 * Body: { records: [{ companyId?, opportunityId?, nip?, regon?, krs? }], mode?: single|bulk }
 * Lead NIP (opportunity.nip) wins over Company.nip. Missing company → find-or-create by NIP.
 */
async function handleEnrichCompanyPl(req) {
  if (!enrichTokenOk(req)) {
    return { statusCode: 401, body: { ok: false, error: "unauthorized" } };
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  let records = Array.isArray(body.records) ? body.records : null;
  if (!records && (body.companyId || body.id || body.opportunityId)) {
    records = [body];
  }
  if (!records || !records.length) {
    return {
      statusCode: 400,
      body: { ok: false, error: "records required" },
    };
  }

  // Cap bulk to protect MF daily budget
  const capped = records.slice(0, 100);
  const results = [];
  for (const rec of capped) {
    try {
      const resolved = await resolveCompanyForLead(rec);
      if (!resolved.ok) {
        results.push(resolved);
      } else {
        const enriched = await enrichOne({
          companyId: resolved.companyId,
          nip: resolved.nip,
          opportunityId: resolved.opportunityId,
        });
        results.push({
          ...enriched,
          created: resolved.created,
          relinked: resolved.relinked,
        });
      }
    } catch (err) {
      results.push({
        ok: false,
        companyId: rec.companyId || rec.id,
        opportunityId: rec.opportunityId,
        error: err.message,
      });
    }
    // pacing Twenty + MF courtesy
    await new Promise((r) => setTimeout(r, 700));
  }

  return {
    statusCode: 200,
    body: {
      ok: true,
      mode: body.mode || (capped.length > 1 ? "bulk" : "single"),
      count: results.length,
      results,
    },
  };
}

module.exports = {
  handleEnrichCompanyPl,
  enrichOne,
  resolveCompanyForLead,
  pickPreferredNip,
  nipChecksumOk,
  normalizeId,
};
