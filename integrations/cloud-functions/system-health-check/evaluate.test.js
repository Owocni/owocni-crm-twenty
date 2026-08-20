"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  evaluateWorkflows,
  evaluateInstance,
  evaluateShared,
  diffAlerts,
  overallStatus,
  schedulerOk,
  buildDigestEmail,
} = require("./evaluate");

const ACTIVE_WORKFLOWS = [
  { name: "lead · formularz · powiadom owner v3", statuses: ["ACTIVE"] },
  { name: "lead · mail · powiadom owner v1", statuses: ["ACTIVE"] },
  { name: "Track Stage Time v3", statuses: ["ACTIVE"] },
  { name: "deal · stage QUALIFIED → Stape v14b", statuses: ["ACTIVE"] },
  { name: "deal · campaign rejected · event do orkiestracji", statuses: ["ACTIVE"] },
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
      { name: "deal · stage QUALIFIED → Stape v14", statuses: ["DEACTIVATED"] },
      { name: "Opp · Przyjmij jako SQL v4", statuses: ["DEACTIVATED"] },
      { name: "Opp · Scal z leadem v1", statuses: ["DEACTIVATED"] },
      { name: "deal · stage QUALIFIED → Stape v14b", statuses: ["ACTIVE"] },
      { name: "Opp · Przyjmij jako SQL v5", statuses: ["ACTIVE"] },
      { name: "Opp · Scal z leadem v2", statuses: ["ACTIVE"] },
      ...ACTIVE_WORKFLOWS.filter(
        (w) =>
          !/qualified.*stape|przyjmij jako sql|scal z leadem/i.test(w.name),
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
