"use strict";

/**
 * Fakturownia ↔ Twenty — wystawianie dokumentów + lustro Faktura.
 * ⛔F1: tylko client_id (nigdy buyer_* dla istniejących)
 * ⛔F7: link Company wyłącznie przez external_id = Twenty Company ID
 * ⛔F9: worker = jedyny writer do Twenty i Fakturowni
 */

const {
  twentyRequest,
  extractCreatedId,
  patchTwentyRecord,
  buildTwentyListPath,
  parseTwentyListRecords,
} = require("../shared/twentyRest");

function invoiceTokenOk(req) {
  const expected = process.env.X_INVOICE_TOKEN;
  if (!expected) return false;
  const got =
    req.headers["x-invoice-token"] ||
    req.headers["X-Invoice-Token"] ||
    (req.body && req.body.invoiceToken);
  return String(got || "") === String(expected);
}

function fakturowniaConfig() {
  const domain = (process.env.FAKTUROWNIA_DOMAIN || "owocni.fakturownia.pl").replace(
    /^https?:\/\//,
    "",
  );
  const apiToken = process.env.FAKTUROWNIA_API_TOKEN;
  if (!apiToken) throw new Error("Missing FAKTUROWNIA_API_TOKEN");
  return {
    domain,
    apiToken,
    base: `https://${domain}`,
  };
}

async function faktRequest(method, path, body) {
  const cfg = fakturowniaConfig();
  const url = new URL(path, cfg.base);
  if (method === "GET" || method === "DELETE") {
    url.searchParams.set("api_token", cfg.apiToken);
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "owocni-invoice-worker/1.0",
    },
    body:
      body !== undefined
        ? JSON.stringify({ api_token: cfg.apiToken, ...body })
        : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  return { statusCode: res.status, body: parsed, rawBody: text };
}

async function createNote(target, title, markdown) {
  const noteRes = await twentyRequest("POST", "/notes", {
    title,
    bodyV2: { markdown },
  });
  if (noteRes.statusCode < 200 || noteRes.statusCode >= 300) return null;
  const noteId = extractCreatedId("notes", noteRes.body);
  if (!noteId) return null;
  const payload = { noteId };
  if (target.companyId) payload.companyId = target.companyId;
  if (target.opportunityId) payload.opportunityId = target.opportunityId;
  if (target.fakturaId) payload.fakturaId = target.fakturaId;
  await twentyRequest("POST", "/noteTargets", payload).catch(() => null);
  return noteId;
}

function normalizeId(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    const nested = value.id ?? value.companyId ?? null;
    return normalizeId(nested);
  }
  const s = String(value).trim();
  if (!s || s === "undefined" || s === "null" || s === "[object Object]") {
    return "";
  }
  return s;
}

function mapKindToFakturownia(kind) {
  const k = String(kind || "").toLowerCase().trim();
  if (k === "proforma") return "proforma";
  if (k === "vat" || k === "faktura" || k === "invoice") return "vat";
  const err = new Error(
    `Nieobsługiwany rodzaj dokumentu: ${kind || "(pusty)"}. Wybierz Proforma albo Faktura VAT.`,
  );
  err.status = 400;
  throw err;
}

function mapKindToTwenty(kind) {
  return mapKindToFakturownia(kind) === "vat" ? "VAT" : "PROFORMA";
}

function mapStatusToTwenty(status) {
  const s = String(status || "").toLowerCase();
  if (s === "paid") return "PAID";
  if (s === "partial") return "PARTIAL";
  if (s === "issued" || s === "sent") return "ISSUED";
  return "ISSUED";
}

function addressParts(addr) {
  if (!addr || typeof addr !== "object") return {};
  return {
    street: [addr.addressStreet1, addr.addressStreet2].filter(Boolean).join(" ").trim(),
    post_code: addr.addressPostcode || "",
    city: addr.addressCity || "",
    country: addr.addressCountry === "Poland" ? "PL" : addr.addressCountry || "PL",
  };
}

function companyReadyForInvoice(company) {
  const nip = String(company.nip || "").replace(/\D/g, "");
  const legalName = String(company.legalName || "").trim();
  const addr = company.registeredAddress || {};
  const hasAddr = Boolean(
    addr.addressStreet1 || addr.addressCity || addr.addressPostcode,
  );
  const missing = [];
  if (!/^\d{10}$/.test(nip)) missing.push("nip");
  if (!legalName) missing.push("legalName");
  if (!hasAddr) missing.push("registeredAddress");
  return { ok: missing.length === 0, missing, nip, legalName };
}

async function getCompany(companyId) {
  const id = normalizeId(companyId);
  if (!id) return null;
  const res = await twentyRequest(
    "GET",
    `/companies/${encodeURIComponent(id)}`,
  );
  if (res.statusCode < 200 || res.statusCode >= 300) {
    return null;
  }
  return res.body?.data?.company || res.body?.data || null;
}

async function getOpportunity(opportunityId) {
  if (!opportunityId) return null;
  const res = await twentyRequest(
    "GET",
    `/opportunities/${encodeURIComponent(opportunityId)}`,
  );
  if (res.statusCode < 200 || res.statusCode >= 300) return null;
  return res.body?.data?.opportunity || res.body?.data || null;
}

async function findFakturaByFakturowniaId(fakturowniaId) {
  const path = buildTwentyListPath(
    "faktury",
    `fakturowniaId[eq]:${fakturowniaId}`,
    1,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) return null;
  const rows = parseTwentyListRecords("faktury", res.body);
  return rows[0] || null;
}

async function provisionClient(company) {
  const externalId = company.id;
  const lookup = await faktRequest(
    "GET",
    `/clients.json?external_id=${encodeURIComponent(externalId)}`,
  );
  const list = Array.isArray(lookup.body) ? lookup.body : [];
  if (list.length) {
    return { clientId: list[0].id, created: false };
  }

  const addr = addressParts(company.registeredAddress);
  const create = await faktRequest("POST", "/clients.json", {
    client: {
      name: company.legalName,
      tax_no: String(company.nip).replace(/\D/g, ""),
      external_id: externalId,
      street: addr.street || undefined,
      post_code: addr.post_code || undefined,
      city: addr.city || undefined,
      country: addr.country || "PL",
    },
  });
  if (create.statusCode >= 400 || create.body?.code === "error") {
    throw new Error(
      `Fakturownia create client: ${JSON.stringify(create.body?.message || create.body)}`,
    );
  }
  if (!create.body?.id) {
    throw new Error(`Fakturownia create client: no id ${create.rawBody}`);
  }
  return { clientId: create.body.id, created: true };
}

function buildPositions(opportunity, override) {
  if (Array.isArray(override) && override.length) return override;
  const name =
    (opportunity && (opportunity.name || opportunity.bizProduct)) || "Usługa";
  let gross = 0;
  const amount = opportunity?.amount;
  if (amount && typeof amount === "object" && amount.amountMicros != null) {
    gross = Number(amount.amountMicros) / 1_000_000;
  } else if (typeof opportunity?.amount === "number") {
    gross = opportunity.amount;
  }
  if (!Number.isFinite(gross) || gross <= 0) {
    // Placeholder — handlowiec poprawia w Fakturowni (wariant A / tor Company)
    gross = 1;
  }
  return [
    {
      name: String(name).slice(0, 200),
      tax: 23,
      quantity: "1",
      total_price_gross: String(gross.toFixed(2)),
    },
  ];
}

async function createMirror(record) {
  const res = await twentyRequest("POST", "/faktury", record);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`create faktura HTTP ${res.statusCode} ${res.rawBody}`);
  }
  const id = extractCreatedId("faktury", res.body);
  if (!id) {
    // fallback shapes
    const data = res.body?.data || {};
    return data.createFaktura?.id || data.faktura?.id || null;
  }
  return id;
}

/**
 * Body:
 * {
 *   action: "issue_invoice",
 *   companyId, opportunityId?, kind: proforma|vat,
 *   issuedBy?: workspaceMemberId,
 *   positions?: [...]
 * }
 */
async function handleIssueInvoice(req) {
  if (!invoiceTokenOk(req)) {
    return { statusCode: 401, body: { ok: false, error: "unauthorized" } };
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const data = body.data && typeof body.data === "object" ? body.data : body;
  let companyId = normalizeId(data.companyId);
  const opportunityId = normalizeId(data.opportunityId) || null;
  let kindF;
  try {
    kindF = mapKindToFakturownia(data.kind);
  } catch (err) {
    return {
      statusCode: err.status || 400,
      body: { ok: false, error: err.message },
    };
  }
  const issuedBy = normalizeId(data.issuedBy) || null;

  let opportunity = null;
  if (opportunityId) {
    opportunity = await getOpportunity(opportunityId);
    const oppCompanyId = normalizeId(
      opportunity?.companyId ?? opportunity?.company?.id,
    );
    if (oppCompanyId && !companyId) {
      companyId = oppCompanyId;
    }
    if (
      oppCompanyId &&
      companyId &&
      oppCompanyId !== companyId
    ) {
      await createNote(
        { companyId, opportunityId },
        "Faktura: mismatch Opportunity↔Company",
        "Powiązanie deala pominięte — companyId z Form ≠ company Opportunity.",
      );
    }
  }

  if (!companyId) {
    await createNote(
      { opportunityId },
      "Brak firmy na Opportunity",
      "Nie da się wystawić dokumentu: Opportunity nie ma powiązanej Firmy.\n\nDodaj Firmę do deala albo wystaw dokument z karty Firmy (po uzupełnieniu NIP/adresu).",
    );
    return {
      statusCode: 422,
      body: {
        ok: false,
        error: "company_required",
        message:
          "Opportunity nie ma powiązanej Firmy. Dodaj Firmę albo wystaw z karty Company.",
      },
    };
  }

  const company = await getCompany(companyId);
  if (!company) {
    return {
      statusCode: 404,
      body: {
        ok: false,
        error: "company not found",
        companyId,
      },
    };
  }

  const ready = companyReadyForInvoice(company);
  if (!ready.ok) {
    await createNote(
      { companyId, opportunityId },
      "Uzupełnij dane firmy (GUS/KRS)",
      `Brakuje pól do faktury/KSeF: **${ready.missing.join(", ")}**.\n\nUżyj przycisku „Uzupełnij dane (GUS/KRS)” na Firmie, potem wystaw ponownie.`,
    );
    return {
      statusCode: 422,
      body: {
        ok: false,
        error: "company_incomplete",
        missing: ready.missing,
      },
    };
  }

  const { clientId } = await provisionClient(company);
  const positions = buildPositions(opportunity, data.positions);
  const oid = crypto.randomUUID();

  const invoicePayload = {
    invoice: {
      kind: kindF,
      client_id: clientId,
      oid,
      seller_person: data.sellerPerson || undefined,
      positions,
      department_id: process.env.FAKTUROWNIA_DEPARTMENT_ID
        ? Number(process.env.FAKTUROWNIA_DEPARTMENT_ID)
        : undefined,
    },
  };

  const created = await faktRequest("POST", "/invoices.json", invoicePayload);
  if (created.statusCode >= 400 || created.body?.code === "error" || !created.body?.id) {
    await createNote(
      { companyId, opportunityId },
      "Faktura FAILED",
      `Fakturownia: ${JSON.stringify(created.body?.message || created.body)}`,
    );
    return {
      statusCode: 502,
      body: { ok: false, error: "fakturownia_create_failed", detail: created.body },
    };
  }

  const inv = created.body;
  const cfg = fakturowniaConfig();
  const viewUrl =
    inv.view_url ||
    `https://${cfg.domain}/invoices/${inv.id}`;
  const editUrl = `https://${cfg.domain}/invoices/${inv.id}`;

  const mirror = {
    name: inv.number || `${kindF.toUpperCase()} ${inv.id}`,
    kind: mapKindToTwenty(kindF),
    invoiceNumber: inv.number || null,
    status: mapStatusToTwenty(inv.status),
    ksefStatus: kindF === "proforma" ? "NONE" : "NONE",
    issueDate: inv.issue_date || null,
    paymentTo: inv.payment_to || null,
    amountGross: inv.price_gross
      ? {
          amountMicros: Math.round(Number(inv.price_gross) * 1_000_000),
          currencyCode: inv.currency || "PLN",
        }
      : undefined,
    fakturowniaId: String(inv.id),
    fakturowniaUrl: {
      primaryLinkUrl: editUrl,
      primaryLinkLabel: "Otwórz w Fakturowni",
    },
    pdfUrl: inv.view_url
      ? { primaryLinkUrl: inv.view_url, primaryLinkLabel: "PDF / podgląd" }
      : undefined,
    companyId,
    opportunityId:
      opportunityId &&
      (!opportunity?.companyId ||
        String(opportunity.companyId) === companyId ||
        String(opportunity.company?.id) === companyId)
        ? opportunityId
        : undefined,
    issuedById: issuedBy || undefined,
  };

  // strip undefined
  Object.keys(mirror).forEach((k) => mirror[k] === undefined && delete mirror[k]);

  let fakturaId = null;
  try {
    fakturaId = await createMirror(mirror);
  } catch (err) {
    // existing by fakturowniaId?
    const existing = await findFakturaByFakturowniaId(String(inv.id));
    if (existing) {
      fakturaId = existing.id;
      await patchTwentyRecord("faktury", fakturaId, mirror).catch(() => null);
    } else {
      await createNote(
        { companyId, opportunityId },
        "Lustro Faktura FAILED",
        `Dokument w Fakturowni utworzony (id=${inv.id}, ${inv.number}), ale lustro w Twenty padło: ${err.message}\n\n[Otwórz](${editUrl})`,
      );
      return {
        statusCode: 207,
        body: {
          ok: true,
          partial: true,
          fakturowniaId: inv.id,
          number: inv.number,
          url: editUrl,
          error: err.message,
        },
      };
    }
  }

  await createNote(
    { companyId, opportunityId, fakturaId },
    `Dokument ${inv.number || inv.id}`,
    `Utworzono **${mapKindToTwenty(kindF)}** w Fakturowni.\n\n` +
      `- Numer: ${inv.number}\n` +
      `- [Otwórz / popraw w Fakturowni](${editUrl})\n` +
      (kindF === "vat"
        ? `\n⚠ Faktura VAT — wysyłka do KSeF dopiero po świadomym zatwierdzeniu w Fakturowni.`
        : `\nProforma — bez KSeF. Po opłaceniu: konwersja do VAT w Fakturowni.`),
  );

  return {
    statusCode: 200,
    body: {
      ok: true,
      fakturaId,
      fakturowniaId: inv.id,
      number: inv.number,
      kind: kindF,
      url: editUrl,
      viewUrl,
      clientId,
      oid,
    },
  };
}

module.exports = {
  handleIssueInvoice,
  companyReadyForInvoice,
  mapKindToFakturownia,
};
