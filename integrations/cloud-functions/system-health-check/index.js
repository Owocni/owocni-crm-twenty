"use strict";

const functions = require("@google-cloud/functions-framework");
const {
  getInstances,
  probeTwenty,
  probeN8n,
  probeSchedulers,
  loadState,
  saveState,
} = require("./probes");
const {
  evaluateInstance,
  evaluateShared,
  overallStatus,
  diffAlerts,
  buildDigestEmail,
  buildAlertEmail,
} = require("./evaluate");
const { sendHealthEmail } = require("./email");

const BUILD_ID = "2026-08-17-health-a1";

function gateOpen() {
  const until = process.env.HEALTH_GATE_UNTIL;
  if (!until) return false;
  const ts = Date.parse(until);
  return Number.isFinite(ts) && Date.now() < ts;
}

async function collectReport() {
  const instances = getInstances();
  const [n8n, schedulers] = await Promise.all([probeN8n(), probeSchedulers()]);
  const items = [];
  const twentyByInstance = {};

  if (!instances.length) {
    items.push({
      instance: "none",
      id: "H-PLATFORM",
      prio: "P0",
      status: "DOWN",
      detail: "brak HEALTH_INSTANCES / TWENTY_API_KEY",
    });
  }

  for (const instance of instances) {
    if (!instance.apiKey) {
      items.push(
        ...evaluateInstance({ instance: instance.id, skipped: true }),
      );
      continue;
    }
    const twenty = await probeTwenty(instance);
    twentyByInstance[instance.id] = {
      ok: !twenty.error,
      workflowCount: (twenty.workflows || []).length,
    };
    items.push(
      ...evaluateInstance({
        instance: instance.id,
        twenty,
        gateOpen: gateOpen(),
      }),
    );
  }

  items.push(
    ...evaluateShared({
      n8n,
      schedulers: schedulers.jobs || [],
    }),
  );

  if (schedulers.error) {
    items.push({
      instance: "gcp",
      id: "H-SCHEDULER-API",
      prio: "P1",
      status: "UNKNOWN",
      detail: schedulers.error,
    });
  }

  return {
    items,
    overall: overallStatus(items),
    n8n: n8n.skipped ? "skipped" : n8n.error || (n8n.active ? "active" : "inactive"),
    twentyByInstance,
  };
}

async function run(mode) {
  const report = await collectReport();
  const previous = await loadState();
  const hasBaseline = Boolean(previous?.items);
  const sent = [];

  try {
    if (mode === "digest") {
      const mail = buildDigestEmail(report.items, report.overall);
      sent.push(await sendHealthEmail(mail));
    } else {
      const alerts = diffAlerts(previous?.items, report.items, hasBaseline);
      for (const alert of alerts) {
        sent.push(await sendHealthEmail(buildAlertEmail(alert)));
      }
    }
  } catch (err) {
    console.error("health email failed", err.code || "", err.message);
    sent.push({ skipped: true, error: String(err.message || err).slice(0, 200) });
  }

  await saveState({
    savedAt: new Date().toISOString(),
    mode,
    overall: report.overall,
    items: report.items,
  });

  return {
    ok: true,
    build_id: BUILD_ID,
    mode,
    overall: report.overall,
    itemCount: report.items.length,
    emails: sent,
    n8n: report.n8n,
    twenty: report.twentyByInstance,
  };
}

functions.http("processSystemHealthCheck", async (req, res) => {
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  const mode =
    (req.body && req.body.mode) || req.query.mode || "probe";
  if (mode !== "probe" && mode !== "digest") {
    res.status(400).json({ ok: false, error: "mode must be probe|digest" });
    return;
  }
  try {
    const result = await run(mode);
    res.status(200).json(result);
  } catch (err) {
    console.error("system-health-check ERROR", err);
    res.status(500).json({
      ok: false,
      build_id: BUILD_ID,
      error: err.message,
    });
  }
});

module.exports = { run, collectReport, BUILD_ID };
