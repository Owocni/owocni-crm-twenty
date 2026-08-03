"use strict";

const { getConfig } = require("../shared/config");
const { fetchLeadById, fetchFormName } = require("../shared/graphApi");
const { parseLeadgenEvents, handleVerifyGet } = require("./parseLeadgen");

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

async function processOneLeadgenEvent(event, cfg) {
  const lead = await fetchLeadById(
    event.leadgen_id,
    cfg.pageAccessToken,
    cfg.graphApiVersion,
  );
  const formId = String(lead.form_id || event.form_id || "").trim();
  let formName = "";
  try {
    formName = await fetchFormName(
      formId,
      cfg.pageAccessToken,
      cfg.graphApiVersion,
    );
  } catch (err) {
    console.warn("form name warn", err.message);
  }

  const ingestPayload = {
    environment: cfg.environment,
    leadgen_id: event.leadgen_id,
    page_id: event.page_id || cfg.pageId,
    form_id: formId,
    form_name: formName,
    ad_id: String(lead.ad_id || event.ad_id || "").trim(),
    adgroup_id: String(event.adgroup_id || "").trim(),
    field_data: lead.field_data || [],
    created_time: lead.created_time || event.created_time,
  };

  const workerResult = await postToWorker(cfg.workerUrl, ingestPayload);
  return { leadgen_id: event.leadgen_id, workerResult };
}

async function handleMetaLeadWebhook(req, res) {
  const cfg = getConfig();

  if (req.method === "GET") {
    handleVerifyGet(req, res, cfg.verifyToken);
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  // Meta requires fast 200; process synchronously for sandbox volume (low-n).
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const events = parseLeadgenEvents(body);
  console.log("meta-lead-webhook events", events.length);

  const results = [];
  for (const event of events) {
    try {
      if (cfg.pageId && event.page_id && event.page_id !== cfg.pageId) {
        results.push({
          leadgen_id: event.leadgen_id,
          skipped: "page_id_mismatch",
          page_id: event.page_id,
        });
        continue;
      }
      results.push(await processOneLeadgenEvent(event, cfg));
    } catch (err) {
      console.error("leadgen process fail", event.leadgen_id, err.message);
      results.push({
        leadgen_id: event.leadgen_id,
        ok: false,
        error: err.message,
      });
    }
  }

  res.status(200).json({
    ok: true,
    processed: results.length,
    results,
  });
}

module.exports = { handleMetaLeadWebhook, processOneLeadgenEvent };
