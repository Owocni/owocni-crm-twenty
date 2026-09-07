"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  evaluateWorkflows,
  evaluateInstance,
  evaluateShared,
  evaluateLeadForm,
  diffAlerts,
  overallStatus,
  schedulerOk,
  buildDigestEmail,
} = require("./evaluate");

const ACTIVE_WORKFLOWS = [
  { name: "lead · formularz · powiadom owner v3", statuses: ["ACTIVE"] },
  { name: "lead · mail · powiadom owner v1", statuses: ["ACTIVE"] },
  { name: "Track Stage Time v3", statuses: ["ACTIVE"] },
  { name: "Opp · guard SQL v6", statuses: ["ACTIVE"] },
  { name: "Opp · guard odrzucony v1", statuses: ["ACTIVE"] },
  { name: "Opp · zapamiętaj etap przed SQL v4e", statuses: ["ACTIVE"] },
  { name: "Przyjmij jako SQL", statuses: ["ACTIVE"] },
  { name: "Odrzuć leada", statuses: ["ACTIVE"] },
  { name: "Scal z leadem v2", statuses: ["ACTIVE"] },
  { name: "Rozmowa · Przypnij do leada v1", statuses: ["ACTIVE"] },
  { name: "Rozmowa · Utwórz lead v2", statuses: ["ACTIVE"] },
];

describe("evaluateWorkflows", () => {
  it("OK when all MUST_ON match ACTIVE", () => {
    const result = evaluateWorkflows(ACTIVE_WORKFLOWS, false);
    assert.equal(result.status, "OK");
    assert.equal(result.offCount, 0);
  });

  it("DEGRADED when 1–2 MUST_ON off", () => {
    const workflows = ACTIVE_WORKFLOWS.filter(
      (w) => !/formularz/.test(w.name),
    );
    const result = evaluateWorkflows(workflows, false);
    assert.equal(result.status, "DEGRADED");
    assert.equal(result.offCount, 1);
  });

  it("DOWN when ≥3 MUST_ON off", () => {
    const workflows = ACTIVE_WORKFLOWS.slice(0, 5);
    const result = evaluateWorkflows(workflows, false);
    assert.equal(result.status, "DOWN");
    assert.ok(result.offCount >= 3);
  });

  it("prefers ACTIVE vN when old version is DEACTIVATED", () => {
    const workflows = [
      { name: "Track Stage Time v2", statuses: ["DEACTIVATED"] },
      { name: "Opp · Przyjmij jako SQL v4", statuses: ["DEACTIVATED"] },
      { name: "Opp · Scal z leadem v1", statuses: ["DEACTIVATED"] },
      { name: "Track Stage Time v3", statuses: ["ACTIVE"] },
      { name: "Opp · Przyjmij jako SQL v5", statuses: ["ACTIVE"] },
      { name: "Opp · Scal z leadem v2", statuses: ["ACTIVE"] },
      ...ACTIVE_WORKFLOWS.filter(
        (w) =>
          !/track stage time|przyjmij jako sql|scal z leadem/i.test(w.name),
      ),
    ];
    const result = evaluateWorkflows(workflows, false);
    assert.equal(result.status, "OK", result.detail);
    assert.equal(result.offCount, 0);
  });

  it("gate window keeps WF OK even if OFF", () => {
    const result = evaluateWorkflows([], true);
    assert.equal(result.status, "OK");
    assert.match(result.detail, /gate ON/);
  });
});

describe("schedulerOk", () => {
  it("ENABLED + code 0 = ok", () => {
    const result = schedulerOk(
      [
        {
          name: "projects/p/locations/l/jobs/telefony-play-poller",
          state: "ENABLED",
          status: { code: 0 },
        },
      ],
      [/play[-_]?poll/i],
    );
    assert.equal(result.found, true);
    assert.equal(result.ok, true);
  });

  it("matches robot-monitor-every-minute", () => {
    const result = schedulerOk(
      [{ name: "robot-monitor-every-minute", state: "ENABLED" }],
      [/robot-task-monitor/i, /robot-monitor/i],
    );
    assert.equal(result.found, true);
    assert.equal(result.ok, true);
  });

  it("PAUSED = not ok", () => {
    const result = schedulerOk(
      [{ name: "robot-task-monitor", state: "PAUSED" }],
      [/robot-task-monitor/i],
    );
    assert.equal(result.ok, false);
  });
});

describe("evaluateInstance NR-1", () => {
  it("does not DOWN on missing business records (no CallTranscript in input)", () => {
    const items = evaluateInstance({
      instance: "sandbox",
      twenty: {
        workflows: ACTIVE_WORKFLOWS,
        mailTemplateCount: 19,
        webhooks: [{ id: "wh1" }],
      },
    });
    const shared = evaluateShared({
      schedulers: [
        { name: "telefony-play-poller", state: "ENABLED", status: { code: 0 } },
        { name: "twenty-crm-worker-sandbox", state: "ENABLED", status: { code: 0 } },
        { name: "robot-task-monitor", state: "ENABLED", status: { code: 0 } },
        { name: "meta-lead-poll-every-5min", state: "ENABLED", status: { code: 0 } },
      ],
      n8n: { active: true, name: "Play PBX" },
    });
    const call = shared.find((i) => i.id === "H-CALL");
    assert.equal(call.status, "OK");
    assert.equal(overallStatus([...items, ...shared]), "OK");
  });

  it("unconfigured instance is SKIP not DOWN", () => {
    const items = evaluateInstance({ instance: "prod", skipped: true });
    assert.equal(items[0].status, "SKIP");
    assert.equal(overallStatus(items), "UNKNOWN");
  });

  it("n8n inactive → H-CALL DOWN, H-MISSED still OK", () => {
    const items = evaluateShared({
      schedulers: [
        { name: "telefony-play-poller", state: "ENABLED" },
        { name: "twenty-crm-worker-sandbox", state: "ENABLED" },
      ],
      n8n: { active: false, name: "Play PBX" },
    });
    assert.equal(items.find((i) => i.id === "H-CALL").status, "DOWN");
    assert.equal(items.find((i) => i.id === "H-MISSED").status, "OK");
  });

  it("n8n not configured → H-CALL DOWN (fail-closed), H-MISSED OK", () => {
    const items = evaluateShared({
      schedulers: [{ name: "telefony-play-poller", state: "ENABLED" }],
      n8n: { skipped: true },
    });
    assert.equal(items.find((i) => i.id === "H-CALL").status, "DOWN");
    assert.equal(items.find((i) => i.id === "H-MISSED").status, "OK");
  });

  it("missing scheduler → DOWN not UNKNOWN", () => {
    const items = evaluateShared({
      schedulers: [{ name: "telefony-play-poller", state: "ENABLED" }],
      n8n: { active: true, name: "Play PBX" },
    });
    assert.equal(items.find((i) => i.id === "H-LEAD-FORM").status, "DOWN");
    assert.equal(items.find((i) => i.id === "H-ROBOT").status, "DOWN");
    assert.equal(items.find((i) => i.id === "H-LEAD-META").status, "DOWN");
  });
});

describe("evaluateLeadForm witness (incydent 2026-08-31)", () => {
  const workerOk = {
    found: true,
    ok: true,
    detail: "twenty-crm-worker-sandbox",
  };
  const now = Date.parse("2026-09-01T12:00:00Z");
  const jobs = [
    { name: "telefony-play-poller", state: "ENABLED" },
    { name: "twenty-crm-worker-sandbox", state: "ENABLED" },
    { name: "robot-task-monitor", state: "ENABLED" },
    { name: "meta-lead-poll-every-5min", state: "ENABLED" },
  ];

  it("worker OFF is still DOWN even with matching form+opp", () => {
    const result = evaluateLeadForm(
      { found: true, ok: false, detail: "PAUSED" },
      {
        lastFormMailAt: "2026-09-01T11:00:00Z",
        lastSortowniaAt: "2026-09-01T11:02:00Z",
      },
      now,
    );
    assert.equal(result.status, "DOWN");
  });

  it("no Zapytanie mail = OK (NR-1 cisza)", () => {
    const result = evaluateLeadForm(
      workerOk,
      { lastFormMailAt: null, lastSortowniaAt: "2026-08-20T10:00:00Z" },
      now,
    );
    assert.equal(result.status, "OK");
    assert.match(result.detail, /cisza/);
  });

  it("only JuicyLogos Zapytanie left after probe filter = OK (cisza)", () => {
    const result = evaluateLeadForm(
      workerOk,
      {
        lastFormMailAt: null,
        lastFormMailSubject: null,
        lastSortowniaAt: "2026-09-06T22:55:06.890Z",
      },
      Date.parse("2026-09-07T05:00:00Z"),
    );
    assert.equal(result.status, "OK");
  });

  it("fresh Zapytanie within grace while Sortownia lags = OK", () => {
    const result = evaluateLeadForm(
      workerOk,
      {
        lastFormMailAt: "2026-09-01T11:30:00Z",
        lastFormMailSubject: "Zapytanie: strony.owocni.pl",
        lastSortowniaAt: "2026-08-31T07:45:00Z",
      },
      now,
    );
    assert.equal(result.status, "OK");
    assert.match(result.detail, /okno 45 min/);
  });

  it("Zapytanie 2h ago without newer Sortownia = DOWN (empty API key)", () => {
    const result = evaluateLeadForm(
      workerOk,
      {
        lastFormMailAt: "2026-09-01T09:21:00Z",
        lastFormMailSubject:
          "Zapytanie: logofirmowe.pl/projektowanie-logo-lublin?gad_source=1",
        lastSortowniaAt: "2026-08-31T07:45:05Z",
      },
      now,
    );
    assert.equal(result.status, "DOWN");
    assert.match(result.detail, /OWOCNI_SORTOWNIA/);
  });

  it("Sortownia newer than last Zapytanie = OK", () => {
    const result = evaluateLeadForm(
      workerOk,
      {
        lastFormMailAt: "2026-09-01T09:21:00Z",
        lastFormMailSubject: "Zapytanie: logofirmowe.pl",
        lastSortowniaAt: "2026-09-01T11:14:00Z",
      },
      now,
    );
    assert.equal(result.status, "OK");
  });

  it("probe error = DEGRADED not pager DOWN", () => {
    const result = evaluateLeadForm(
      workerOk,
      { error: "messages HTTP 403" },
      now,
    );
    assert.equal(result.status, "DEGRADED");
  });

  it("evaluateShared pages H-LEAD-FORM DOWN on stale witness", () => {
    const items = evaluateShared({
      schedulers: jobs,
      n8n: { active: true, name: "Play PBX" },
      nowMs: now,
      formFlow: {
        lastFormMailAt: "2026-09-01T09:21:00Z",
        lastFormMailSubject: "Zapytanie: logofirmowe.pl",
        lastSortowniaAt: "2026-08-31T07:45:05Z",
      },
    });
    assert.equal(items.find((i) => i.id === "H-LEAD-FORM").status, "DOWN");
    assert.equal(items.find((i) => i.id === "H-UPDATE-PERSON").status, "OK");
  });
});

describe("diffAlerts", () => {
  const down = {
    instance: "sandbox",
    id: "H-CALL",
    prio: "P0",
    status: "DOWN",
    detail: "n8n OFF",
  };
  const ok = { ...down, status: "OK", detail: "job ok" };

  it("no alerts without baseline (first run)", () => {
    assert.deepEqual(diffAlerts([], [down], false), []);
  });

  it("pages on new DOWN", () => {
    const alerts = diffAlerts([ok], [down], true);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, "down");
  });

  it("does not re-page same DOWN", () => {
    assert.deepEqual(diffAlerts([down], [down], true), []);
  });

  it("pages recovery", () => {
    const alerts = diffAlerts([down], [ok], true);
    assert.equal(alerts[0].type, "recovery");
  });
});

describe("digest", () => {
  it("OK subject when overall OK", () => {
    const items = [
      {
        instance: "sandbox",
        id: "H-WF",
        prio: "P0",
        status: "OK",
        detail: "13/13",
      },
    ];
    const mail = buildDigestEmail(items, "OK");
    assert.match(mail.subject, /Stan systemu — OK/);
    assert.match(mail.body, /Semafor \(P0\): OK/);
  });
});
