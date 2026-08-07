"use strict";

const { getConfig } = require("../shared/config");
const { listFormLeadsSince, fetchFormName } = require("../shared/graphApi");

async function postToWorker(workerUrl, payload) {
  const res = await fetch(workerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "ingest_meta_lead",
      data: payload,
    }),
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`worker ${res.status}: ${text.slice(0, 500)}`);
  }
  return body;
}

function resolveFormIds(cfg, body) {
  const fromBody = String(body?.form_ids || body?.formIds || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromBody.length) return fromBody;
  const fromEnv = String(process.env.META_FORM_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  // Domyślny Instant Form Owocni (wyższy próg)
  return ["1073605628462622"];
}

function authOk(req, cfg) {
  const header =
    String(req.get?.("x-meta-poll-secret") || req.headers?.["x-meta-poll-secret"] || "").trim();
  const q = String(req.query?.secret || "").trim();
  const bodySecret = String(req.body?.secret || "").trim();
  const expected = String(
    process.env.META_LEAD_POLL_SECRET || cfg.verifyToken || "",
  ).trim();
  if (!expected) return false;
  return header === expected || q === expected || bodySecret === expected;
}

/**
 * Pull leadów z Graph (fallback gdy Meta nie pushuje webhooków).
 * POST { action: "poll_meta_leads", lookback_hours?: 48, max_leads?: 15 }
 */
async function handlePollMetaLeads(req, res) {
  const cfg = getConfig();
  if (!authOk(req, cfg)) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const lookbackHours = Math.min(
    168,
    Math.max(1, Number(body.lookback_hours || body.lookbackHours || 72) || 72),
  );
  const maxLeads = Math.min(
    40,
    Math.max(1, Number(body.max_leads || body.maxLeads || 15) || 15),
  );
  const sinceMs = Date.now() - lookbackHours * 3600 * 1000;
  const formIds = resolveFormIds(cfg, body);

  const results = [];
  let ingested = 0;
  let skipped = 0;
  let failed = 0;

  for (const formId of formIds) {
    if (ingested + skipped + failed >= maxLeads) break;
    let formName = "";
    try {
      formName = await fetchFormName(
        formId,
        cfg.pageAccessToken,
        cfg.graphApiVersion,
      );
    } catch (err) {
      console.warn("poll form name warn", formId, err.message);
    }

    let leads = [];
    try {
      leads = await listFormLeadsSince(
        formId,
        cfg.pageAccessToken,
        cfg.graphApiVersion,
        sinceMs,
        maxLeads,
      );
    } catch (err) {
      failed += 1;
      results.push({ form_id: formId, ok: false, error: err.message });
      continue;
    }

    for (const lead of leads) {
      if (ingested + skipped + failed >= maxLeads) break;
      const leadgenId = String(lead.id || "").trim();
      if (!leadgenId) continue;
      try {
        const workerResult = await postToWorker(cfg.workerUrl, {
          environment: cfg.environment,
          leadgen_id: leadgenId,
          page_id: cfg.pageId,
          form_id: String(lead.form_id || formId).trim(),
          form_name: formName,
          ad_id: String(lead.ad_id || "").trim(),
          adgroup_id: "",
          field_data: lead.field_data || [],
          created_time: lead.created_time,
        });
        const already =
          workerResult?.enqueue?.skipped === "already_exists" ||
          workerResult?.create_lead?.skipped > 0;
        if (already) {
          skipped += 1;
          results.push({
            leadgen_id: leadgenId,
            skipped: "already_exists",
          });
        } else if (workerResult?.ok === false) {
          failed += 1;
          results.push({
            leadgen_id: leadgenId,
            ok: false,
            workerResult,
          });
        } else {
          ingested += 1;
          results.push({
            leadgen_id: leadgenId,
            ok: true,
            email: workerResult?.enqueue?.email,
            create_lead: workerResult?.create_lead,
          });
        }
      } catch (err) {
        failed += 1;
        results.push({
          leadgen_id: leadgenId,
          ok: false,
          error: err.message,
        });
      }
      // Odstęp — ochrona przed Twenty 429
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  console.log(
    "meta-lead-poll",
    JSON.stringify({ lookbackHours, ingested, skipped, failed }),
  );
  res.status(200).json({
    ok: true,
    mode: "poll_meta_leads",
    lookback_hours: lookbackHours,
    ingested,
    skipped,
    failed,
    results,
  });
}

module.exports = { handlePollMetaLeads };
