"use strict";

const fs = require("fs");
const path = require("path");
const { listSchedulerJobs, gcsReadJson, gcsWriteJson } = require("./gcp");

function parseJsonEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in ${name}`);
  }
}

function uniqueInstances(instances) {
  const seen = new Set();
  const out = [];
  for (const inst of instances) {
    if (!inst.apiKey) {
      out.push(inst);
      continue;
    }
    const key = `${inst.restUrl}::${inst.apiKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(inst);
  }
  return out;
}

function getInstances() {
  const fromEnv = parseJsonEnv("HEALTH_INSTANCES", null);
  if (Array.isArray(fromEnv) && fromEnv.length) {
    return uniqueInstances(
      fromEnv.map((row) => ({
        id: row.id,
        restUrl: String(row.restUrl || "").replace(/\/$/, ""),
        apiKey: row.apiKey || process.env[row.apiKeyEnv] || "",
      })),
    );
  }
  const instances = [];
  if (process.env.TWENTY_API_KEY_SANDBOX || process.env.TWENTY_API_KEY) {
    instances.push({
      id: "sandbox",
      restUrl: (
        process.env.TWENTY_REST_URL_SANDBOX ||
        process.env.TWENTY_REST_URL ||
        "https://api.twenty.com/rest"
      ).replace(/\/$/, ""),
      apiKey: process.env.TWENTY_API_KEY_SANDBOX || process.env.TWENTY_API_KEY,
    });
  }
  if (process.env.TWENTY_API_KEY_PROD) {
    instances.push({
      id: "prod",
      restUrl: (
        process.env.TWENTY_REST_URL_PROD || "https://api.twenty.com/rest"
      ).replace(/\/$/, ""),
      apiKey: process.env.TWENTY_API_KEY_PROD,
    });
  }
  return uniqueInstances(instances);
}

async function twentyGet(restUrl, apiKey, pathname) {
  const res = await fetch(`${restUrl}${pathname}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "User-Agent": "owocni-system-health-check/1.0",
    },
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed, text };
}

function collection(body, name) {
  const data = body?.data || {};
  if (Array.isArray(data[name])) return data[name];
  if (Array.isArray(body?.[name])) return body[name];
  if (Array.isArray(body)) return body;
  return [];
}

async function probeTwenty(instance) {
  if (!instance.apiKey) {
    return { error: "brak API key" };
  }
  const workflowsRes = await twentyGet(
    instance.restUrl,
    instance.apiKey,
    "/workflows?limit=60",
  );
  if (workflowsRes.status < 200 || workflowsRes.status >= 300) {
    return {
      error: `HTTP ${workflowsRes.status} ${workflowsRes.text.slice(0, 160)}`,
    };
  }
  const workflows = collection(workflowsRes.body, "workflows");

  let mailTemplateCount = null;
  const tplRes = await twentyGet(
    instance.restUrl,
    instance.apiKey,
    "/mailTemplates?limit=1",
  );
  if (tplRes.status === 404) {
    mailTemplateCount = -1;
  } else if (tplRes.status >= 200 && tplRes.status < 300) {
    const pageTotal = tplRes.body?.pageInfo?.totalCount;
    const rows = collection(tplRes.body, "mailTemplates");
    mailTemplateCount =
      typeof pageTotal === "number" ? pageTotal : rows.length > 0 ? 1 : 0;
  }

  let webhooks = [];
  let webhooksError = null;
  const whRes = await twentyGet(
    instance.restUrl,
    instance.apiKey,
    "/webhooks?limit=50",
  );
  if (whRes.status >= 200 && whRes.status < 300) {
    webhooks = collection(whRes.body, "webhooks");
  } else {
    webhooksError = `webhooks HTTP ${whRes.status}`;
  }

  return { workflows, mailTemplateCount, webhooks, webhooksError };
}

async function probeN8n() {
  const base = (process.env.N8N_BASE_URL || "").replace(/\/$/, "");
  const key = process.env.N8N_API_KEY || "";
  if (!base || !key) {
    return { skipped: true };
  }
  const res = await fetch(`${base}/api/v1/workflows?limit=50`, {
    headers: { "X-N8N-API-KEY": key, Accept: "application/json" },
  });
  if (!res.ok) {
    return { error: `HTTP ${res.status}` };
  }
  const body = await res.json();
  const list = body.data || body || [];
  const play = (Array.isArray(list) ? list : []).find((wf) =>
    /play\s*pbx|play-pbx|calltranscript/i.test(wf.name || ""),
  );
  if (!play) {
    return { error: "nie znaleziono workflow Play PBX" };
  }
  return { active: Boolean(play.active), name: play.name };
}

async function probeSchedulers() {
  const project = process.env.GCP_PROJECT;
  const location = process.env.GCP_REGION || "europe-central2";
  if (!project) {
    return { error: "brak GCP_PROJECT", jobs: [] };
  }
  try {
    const jobs = await listSchedulerJobs(project, location);
    return { jobs };
  } catch (err) {
    return { error: err.message, jobs: [] };
  }
}

const STATE_OBJECT = "system-health/last.json";

async function loadState() {
  const local = process.env.HEALTH_STATE_FILE;
  if (local) {
    try {
      return JSON.parse(fs.readFileSync(path.resolve(local), "utf8"));
    } catch {
      return null;
    }
  }
  const bucket = process.env.HEALTH_GCS_BUCKET;
  if (!bucket) return null;
  try {
    return await gcsReadJson(bucket, STATE_OBJECT);
  } catch (err) {
    console.error("loadState", err.message);
    return null;
  }
}

async function saveState(state) {
  const local = process.env.HEALTH_STATE_FILE;
  if (local) {
    fs.writeFileSync(path.resolve(local), JSON.stringify(state, null, 2));
    return;
  }
  const bucket = process.env.HEALTH_GCS_BUCKET;
  if (!bucket) return;
  await gcsWriteJson(bucket, STATE_OBJECT, state);
}

module.exports = {
  getInstances,
  uniqueInstances,
  probeTwenty,
  probeN8n,
  probeSchedulers,
  loadState,
  saveState,
};
