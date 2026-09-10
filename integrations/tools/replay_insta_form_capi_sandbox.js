#!/usr/bin/env node
"use strict";

/**
 * One-shot: replay Instant Form SQL/WON that sandbox swallowed 4–8 IX 2026.
 * Payload = lead_id only (no email/phone). Robot flag META_INSTA_FORM_CAPI_FROM_SANDBOX
 * must already be ON.
 *
 * Usage (from inbound CF dir so .env.deploy is sourced by the runner):
 *   node replay_insta_form_capi_sandbox.js
 */

const STAPE_API_KEY = process.env.STAPE_API_KEY;
const STAPE_API_BASE = (
  process.env.STAPE_API_BASE || "https://uinpcbwf.eug.stape.io/stape-api"
).replace(/\/$/, "");

if (!STAPE_API_KEY) {
  console.error("Missing STAPE_API_KEY");
  process.exit(1);
}

const now = Date.now();
const RUN = "replay_insta_20260910";

const EVENTS = [
  {
    id_oid: "8S8TFSFYJWRZW2QH37SCMA8PPX",
    event_name: "qualify_lead",
    meta_leadgen_id: "2320568222106220",
    opportunity_id: "56606984-6d25-4bce-8111-b88eaa8271d4",
    time_occurred_iso_utc: "2026-09-04T10:17:52.714Z",
    stage: "QUALIFIED",
    label: "hexy SQL",
  },
  {
    id_oid: "V1PVJW7HFZGV36YJZHC3J6GXJF",
    event_name: "qualify_lead",
    meta_leadgen_id: "2915341172145966",
    opportunity_id: "b4750335-0747-430e-9e69-8835a71a232e",
    time_occurred_iso_utc: "2026-09-08T11:39:44.573Z",
    stage: "QUALIFIED",
    label: "neoneo SQL",
  },
  {
    id_oid: "V1PVJW7HFZGV36YJZHC3J6GXJF",
    event_name: "purchase",
    meta_leadgen_id: "2915341172145966",
    opportunity_id: "b4750335-0747-430e-9e69-8835a71a232e",
    time_occurred_iso_utc: "2026-09-08T11:49:53.087Z",
    stage: "WON",
    label: "neoneo WON",
  },
];

function taskKey(ev) {
  return `${RUN}_${ev.id_oid}_${ev.event_name}`;
}

function payload(ev, createdAt) {
  return {
    id_oid: ev.id_oid,
    id_event: `${RUN}_${ev.event_name}_${ev.meta_leadgen_id}`,
    event_name: ev.event_name,
    job_type: "analytics:ga4_mp",
    status: "pending",
    created_at: createdAt,
    environment: "sandbox",
    biz_product: "WEB",
    biz_pricing_key: ev.event_name === "qualify_lead" ? "sql_web" : undefined,
    src_system: "TWENTY_UI",
    src_action_source: "replay_insta_form_capi",
    adapter: "replay_insta_form_capi_sandbox",
    opportunity_id: ev.opportunity_id,
    stage: ev.stage,
    lead_id: ev.meta_leadgen_id,
    meta_leadgen_id: ev.meta_leadgen_id,
    owner: "platform:meta_ads",
    assist: "platform:meta_ads",
    time_occurred_iso_utc: ev.time_occurred_iso_utc,
    replay_of: RUN,
  };
}

async function putTask(key, body) {
  const url = `${STAPE_API_BASE}/${STAPE_API_KEY}/v2/store/collections/task_queue/documents/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PUT ${key} HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
}

async function getTask(key) {
  const url = `${STAPE_API_BASE}/${STAPE_API_KEY}/v2/store/collections/task_queue/documents/${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: "GET" });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GET ${key} HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  let parsed = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {};
  }
  const data = (parsed && parsed.data && parsed.data.data) || parsed.data || parsed;
  return {
    status: data.status,
    event_name: data.event_name,
    environment: data.environment,
    lead_id: data.lead_id || data.meta_leadgen_id,
    time_occurred_iso_utc: data.time_occurred_iso_utc,
  };
}

(async () => {
  const written = [];
  for (let i = 0; i < EVENTS.length; i += 1) {
    const ev = EVENTS[i];
    const key = taskKey(ev);
    const createdAt = now + i;
    await putTask(key, payload(ev, createdAt));
    const check = await getTask(key);
    if (check.status !== "pending" || check.environment !== "sandbox") {
      throw new Error(`verify fail ${key}: ${JSON.stringify(check)}`);
    }
    if (!check.lead_id) {
      throw new Error(`verify fail ${key}: missing lead_id`);
    }
    written.push({
      label: ev.label,
      key,
      event_name: ev.event_name,
      lead_id: ev.meta_leadgen_id,
      event_time: ev.time_occurred_iso_utc,
    });
  }
  console.log(JSON.stringify({ ok: true, count: written.length, tasks: written }, null, 2));
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
