"use strict";

/**
 * Czysta ocena H-* (SYSTEM_HEALTH.md §5.2–5.3, §5.8).
 * Bez I/O — testowalne. DOWN tylko z heartbeat, nigdy z ciszy rekordów (NR-1).
 */

const RANK = { OK: 0, SKIP: 0, DEGRADED: 1, UNKNOWN: 2, DOWN: 3 };

const MUST_ON_DATABASE = [
  {
    id: "wf-form-notify",
    label: "lead · formularz · powiadom owner",
    re: /formularz.*powiadom/i,
  },
  {
    id: "wf-mail-notify",
    label: "lead · mail · powiadom owner",
    re: /mail.*powiadom/i,
  },
  { id: "wf-track-stage", label: "Track Stage Time", re: /track stage time/i },
  {
    id: "wf-sql-stape",
    label: "deal · stage QUALIFIED → Stape",
    re: /qualified.*stape|stape v14/i,
  },
  {
    id: "wf-campaign-rejected",
    label: "deal · campaign rejected",
    re: /campaign rejected/i,
  },
  { id: "wf-guard-sql", label: "Opp · guard SQL", re: /guard sql/i },
  {
    id: "wf-guard-rejected",
    label: "Opp · guard odrzucony",
    re: /guard odrzucony/i,
  },
  {
    id: "wf-remember-stage",
    label: "Opp · zapamiętaj etap przed SQL",
    re: /zapami[eę]taj etap/i,
  },
];

const MUST_ON_MANUAL = [
  { id: "wf-accept-sql", label: "Przyjmij jako SQL", re: /przyjmij jako sql/i },
  { id: "wf-reject-lead", label: "Odrzuć leada", re: /odrzu[cć] leada/i },
  { id: "wf-merge", label: "Scal z leadem", re: /scal z leadem/i },
  { id: "wf-pin-call", label: "Przypnij do leada", re: /przypnij do leada/i },
  { id: "wf-create-from-call", label: "Utwórz lead", re: /utw[oó]rz lead/i },
];

const SCHEDULER_MATCH = {
  "H-CALL": [/telefony/i, /play[-_]?poll/i],
  "H-WORKER": [/twenty-crm-worker/i, /crm-worker/i],
  "H-ROBOT": [/robot-task-monitor/i, /robot-monitor/i],
  "H-LEAD-META": [/meta-lead-poll/i, /meta-lead/i],
};

function jobShortName(job) {
  const name = job?.name || job?.id || "";
  const parts = String(name).split("/");
  return parts[parts.length - 1] || name;
}

function schedulerOk(jobs, patterns) {
  const matches = (jobs || []).filter((job) =>
    patterns.some((re) => re.test(jobShortName(job)) || re.test(job.name || "")),
  );
  if (!matches.length) {
    return { found: false, ok: false, detail: "brak joba w Cloud Scheduler" };
  }
  const bad = matches.filter((job) => {
    const state = String(job.state || "").toUpperCase();
    if (state && state !== "ENABLED") return true;
    const code = job.status?.code;
    if (code !== undefined && code !== null && Number(code) !== 0) return true;
    return false;
  });
  const names = matches.map(jobShortName).join(", ");
  if (bad.length) {
    const first = bad[0];
    return {
      found: true,
      ok: false,
      detail: `${jobShortName(first)}: ${first.state || "last fail"}`,
    };
  }
  return { found: true, ok: true, detail: names };
}

function workflowActive(workflow) {
  const statuses = workflow?.statuses;
  const raw = Array.isArray(statuses) ? statuses[0] : workflow?.status;
  return String(raw || "").toUpperCase() === "ACTIVE";
}

function matchWorkflow(workflows, spec) {
  const matches = (workflows || []).filter((workflow) =>
    spec.re.test(workflow.name || ""),
  );
  if (!matches.length) return null;
  const active = matches.filter(workflowActive);
  return active[0] || matches[0];
}

function evaluateWorkflows(workflows, gateOpen) {
  const specs = [...MUST_ON_DATABASE, ...MUST_ON_MANUAL];
  const rows = specs.map((spec) => {
    const workflow = matchWorkflow(workflows, spec);
    const ok = Boolean(workflow && workflowActive(workflow));
    return {
      specId: spec.id,
      label: spec.label,
      name: workflow?.name || null,
      status: workflow ? (ok ? "ACTIVE" : "DEACTIVATED") : "MISSING",
      ok,
    };
  });
  const off = rows.filter((row) => !row.ok);
  if (gateOpen) {
    return {
      status: "OK",
      detail: `gate ON — ${off.length} OFF oczekiwane`,
      rows,
      offCount: off.length,
    };
  }
  if (off.length >= 3) {
    return {
      status: "DOWN",
      detail: `MUST_ON OFF (${off.length}): ${off.map((row) => row.label).join(", ")}`,
      rows,
      offCount: off.length,
    };
  }
  if (off.length >= 1) {
    return {
      status: "DEGRADED",
      detail: `MUST_ON OFF (${off.length}): ${off.map((row) => row.label).join(", ")}`,
      rows,
      offCount: off.length,
    };
  }
  return {
    status: "OK",
    detail: `${rows.length}/${rows.length} ACTIVE`,
    rows,
    offCount: 0,
  };
}

function worstStatus(statuses) {
  let worst = "OK";
  let hasKnown = false;
  for (const status of statuses) {
    if (status === "SKIP" || status === "UNKNOWN" || !status) continue;
    hasKnown = true;
    if ((RANK[status] || 0) > (RANK[worst] || 0)) worst = status;
  }
  return hasKnown ? worst : "UNKNOWN";
}

function itemKey(item) {
  return `${item.instance}:${item.id}`;
}

function evaluateInstance(input) {
  const instance = input.instance;
  const items = [];
  const push = (id, prio, status, detail) => {
    items.push({ instance, id, prio, status, detail });
  };

  if (input.skipped) {
    push("H-PLATFORM", "P0", "SKIP", "instancja nie skonfigurowana (nie DOWN)");
    return items;
  }

  if (input.twenty?.error) {
    push("H-PLATFORM", "P0", "DOWN", `Twenty REST: ${input.twenty.error}`);
    return items;
  }

  push("H-PLATFORM", "P0", "OK", "Twenty REST odpowiada");

  const wf = evaluateWorkflows(input.twenty?.workflows || [], input.gateOpen);
  push("H-WF", "P0", wf.status, wf.detail);

  const pin = wf.rows.filter(
    (row) => row.specId === "wf-pin-call" || row.specId === "wf-create-from-call",
  );
  const pinOff = pin.filter((row) => !row.ok).length;
  push(
    "H-CALL-LINK",
    "P1",
    pinOff === 0 ? "OK" : pinOff >= 2 ? "DOWN" : "DEGRADED",
    pin.map((row) => `${row.label}=${row.status}`).join("; "),
  );

  const merge = wf.rows.find((row) => row.specId === "wf-merge");
  push(
    "H-MERGE",
    "P2",
    merge?.ok ? "OK" : "DOWN",
    merge?.ok ? "Scal z leadem ACTIVE" : "Scal z leadem OFF",
  );

  const mailCount = input.twenty?.mailTemplateCount;
  if (mailCount === -1) {
    push("H-MAIL-TPL", "P0", "DOWN", "brak obiektu mailTemplate (app?)");
  } else if (mailCount === null || mailCount === undefined) {
    push("H-MAIL-TPL", "P0", "UNKNOWN", "brak odczytu mailTemplates");
  } else if (mailCount > 0) {
    push("H-MAIL-TPL", "P0", "OK", `szablonów ≥ ${mailCount}`);
  } else {
    push("H-MAIL-TPL", "P0", "DOWN", "0 szablonów");
  }

  if (input.twenty?.webhooksError) {
    push("H-INBOUND", "P1", "UNKNOWN", input.twenty.webhooksError);
  } else if (!(input.twenty?.webhooks || []).length) {
    push("H-INBOUND", "P1", "DOWN", "brak webhooków OUT");
  } else {
    push(
      "H-INBOUND",
      "P1",
      "OK",
      `${input.twenty.webhooks.length} webhook(ów)`,
    );
  }

  const mailWf = wf.rows.find((row) => row.specId === "wf-mail-notify");
  push(
    "H-LEAD-MAIL",
    "P0",
    mailWf?.ok ? "OK" : "DOWN",
    mailWf?.ok
      ? "workflow mail notify ACTIVE; H-SYNC = UNKNOWN"
      : "workflow mail notify OFF",
  );
  push("H-SYNC", "P1", "UNKNOWN", "connectedAccount poza Core API");

  return items;
}

/** Play / worker / Robot / Meta / n8n — jedna kopia, nie per instancja Twenty. */
function evaluateShared(input) {
  const instance = "shared";
  const items = [];
  const push = (id, prio, status, detail) => {
    items.push({ instance, id, prio, status, detail });
  };
  const jobs = input.schedulers || [];
  const worker = schedulerOk(jobs, SCHEDULER_MATCH["H-WORKER"]);
  const play = schedulerOk(jobs, SCHEDULER_MATCH["H-CALL"]);
  const robot = schedulerOk(jobs, SCHEDULER_MATCH["H-ROBOT"]);
  const meta = schedulerOk(jobs, SCHEDULER_MATCH["H-LEAD-META"]);

  let n8nStatus = "DOWN";
  let n8nDetail = "n8n nie podpięte (brak API / nieaktywne)";
  if (input.n8n?.skipped) {
    n8nStatus = "DOWN";
    n8nDetail = "n8n nie podpięte (brak API / nieaktywne)";
  } else if (input.n8n?.error) {
    n8nStatus = "DOWN";
    n8nDetail = `n8n API: ${input.n8n.error}`;
  } else if (input.n8n?.active) {
    n8nStatus = "OK";
    n8nDetail = input.n8n.name || "Play PBX ACTIVE";
  } else {
    n8nStatus = "DOWN";
    n8nDetail = "n8n Play PBX nieaktywny";
  }

  if (!play.found || !play.ok) {
    push("H-CALL", "P0", "DOWN", play.detail);
    push("H-MISSED", "P0", "DOWN", play.detail);
  } else {
    push("H-CALL", "P0", n8nStatus, `${play.detail}; ${n8nDetail}`);
    push("H-MISSED", "P0", "OK", `${play.detail} (n8n poza ścieżką)`);
  }

  const workerStatus = worker.found && worker.ok ? "OK" : "DOWN";
  push("H-LEAD-FORM", "P0", workerStatus, worker.detail);
  push("H-UPDATE-PERSON", "P1", workerStatus, worker.detail);
  push(
    "H-MAIL-DIR",
    "P1",
    workerStatus,
    "direction = GCP worker (workflow OFF = zamierzone)",
  );
  push(
    "H-LEAD-META",
    "P0",
    meta.found && meta.ok ? "OK" : "DOWN",
    meta.detail,
  );
  push(
    "H-ROBOT",
    "P1",
    robot.found && robot.ok ? "OK" : "DOWN",
    robot.detail,
  );
  push("H-STAPE", "P1", "UNKNOWN", "nie pingujemy Store (budżet Stape)");

  return items;
}

function overallStatus(items) {
  const p0 = (items || [])
    .filter((item) => item.prio === "P0")
    .map((item) => item.status);
  return worstStatus(p0.length ? p0 : (items || []).map((item) => item.status));
}

/**
 * Pager tylko przy zmianie na DOWN albo recovery.
 * Brak baseline (pierwszy run) → zero maili awarii (digest i tak wyjdzie rano).
 */
function diffAlerts(previousItems, currentItems, hasBaseline) {
  if (!hasBaseline) return [];
  const prev = new Map((previousItems || []).map((item) => [itemKey(item), item]));
  const alerts = [];
  for (const current of currentItems || []) {
    if (current.status === "SKIP") continue;
    const old = prev.get(itemKey(current));
    const wasDown = old?.status === "DOWN";
    const isDown = current.status === "DOWN";
    if (isDown && !wasDown) {
      alerts.push({ type: "down", item: current });
    } else if (wasDown && !isDown && current.status !== "UNKNOWN") {
      alerts.push({ type: "recovery", item: current });
    }
  }
  return alerts;
}

function formatWarsaw(date = new Date()) {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function buildDigestEmail(items, overall) {
  const when = formatWarsaw();
  const down = items.filter((item) => item.status === "DOWN");
  const degraded = items.filter((item) => item.status === "DEGRADED");
  const unknown = items.filter((item) => item.status === "UNKNOWN");
  const subject =
    overall === "OK"
      ? `[Owocni CRM] Stan systemu — OK — ${when}`
      : `[Owocni CRM] Stan systemu — ${overall} — ${when}`;

  const line = (item) =>
    `${item.status.padEnd(9)} ${item.id} @ ${item.instance}  ${item.detail}`;

  const body = [
    `Semafor (P0): ${overall}`,
    `Czas: ${when} (Europe/Warsaw)`,
    "",
    down.length ? "DOWN:" : null,
    ...down.map(line),
    down.length ? "" : null,
    degraded.length ? "DEGRADED (nie paging):" : null,
    ...degraded.map(line),
    degraded.length ? "" : null,
    "Wszystkie pozycje:",
    ...items.map(line),
    "",
    unknown.length
      ? `UNKNOWN (${unknown.length}) — m.in. H-SYNC: connectedAccount poza Core API.`
      : null,
    "Źródło: GCP system-health-check (Faza A). Cisza biznesowa ≠ awaria.",
  ]
    .filter((row) => row !== null)
    .join("\n");

  return { subject, body };
}

function buildAlertEmail(alert) {
  const item = alert.item;
  const when = formatWarsaw();
  if (alert.type === "recovery") {
    return {
      subject: `[Owocni CRM] Wróciło — ${item.id} @ ${item.instance}`,
      body: `${item.id} @ ${item.instance} wróciło do ${item.status}.\n${item.detail}\n${when}`,
    };
  }
  return {
    subject: `[Owocni CRM] AWARIA — ${item.id} @ ${item.instance} — ${String(item.detail).slice(0, 80)}`,
    body: `${item.id} @ ${item.instance} = DOWN\n${item.detail}\n${when}\n\nPlaybook: owocni-crm/ops/SYSTEM_HEALTH.md §5.4`,
  };
}

module.exports = {
  MUST_ON_DATABASE,
  MUST_ON_MANUAL,
  SCHEDULER_MATCH,
  evaluateWorkflows,
  evaluateInstance,
  evaluateShared,
  schedulerOk,
  overallStatus,
  worstStatus,
  diffAlerts,
  itemKey,
  buildDigestEmail,
  buildAlertEmail,
  formatWarsaw,
};
