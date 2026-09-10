/**
 * envGuard.js — rozdzielenie sandbox/prod (Robot / Node).
 * SSOT: ARCHITECTURE.md §5.4, INTEGRATIONS_PARITY P10
 *
 * Furtka Insta Form (właściciel 10 IX 2026): sandbox Twenty zostaje;
 * SQL/WON/rejected Instant Form mogą iść na Meta CAPI za flagą
 * META_INSTA_FORM_CAPI_FROM_SANDBOX (domyślnie wyłączona). Google Ads / GA4 MP
 * bez zmian. Payload CAPI = lead_id (metaCapi.js) — bez PII.
 */

const { RUNTIME_ENV } = require('./ssotPaths');
const { resolveLeadId } = require('./metaCapi');

const META_INSTA_FORM_CAPI_FLAG = 'META_INSTA_FORM_CAPI_FROM_SANDBOX';
const INSTA_FORM_CAPI_EVENTS = new Set([
  'qualify_lead',
  'purchase',
  'rejected_lead',
]);

function isEnvFlagOn(name, env) {
  const raw = env && env[name];
  if (raw === undefined || raw === null) return false;
  const v = String(raw).trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

function isInstaFormCapiFromSandboxEnabled(env) {
  return isEnvFlagOn(META_INSTA_FORM_CAPI_FLAG, env || process.env);
}

function getTaskEnvironment(taskData) {
  if (!taskData || typeof taskData !== 'object') {
    return RUNTIME_ENV.PROD;
  }
  const raw =
    taskData.environment ||
    taskData.runtime_environment ||
    process.env.OWOCNI_RUNTIME_ENV ||
    RUNTIME_ENV.PROD;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === RUNTIME_ENV.SANDBOX ? RUNTIME_ENV.SANDBOX : RUNTIME_ENV.PROD;
}

function isSandboxTask(taskData) {
  return getTaskEnvironment(taskData) === RUNTIME_ENV.SANDBOX;
}

function shouldSkipProdPlatformApis(taskData) {
  return isSandboxTask(taskData);
}

/**
 * Sandbox + Instant Form + SQL/WON/rejected + flaga ON + jest lead_id.
 * Bez lead_id nie puszczamy — CAPI Insta Form nie ma czego spiąć, a website
 * PII jest zastrzeżone dla właściciela.
 */
function isSandboxInstaFormMetaCapiEvent(taskData, env) {
  if (!isInstaFormCapiFromSandboxEnabled(env)) return false;
  if (!isSandboxTask(taskData)) return false;
  const eventName = String((taskData && taskData.event_name) || '')
    .trim()
    .toLowerCase();
  if (!INSTA_FORM_CAPI_EVENTS.has(eventName)) return false;
  return Boolean(resolveLeadId(taskData));
}

function selectMetaCapiTasks(prodTasks, sandboxTasks, env) {
  const extra = [];
  (sandboxTasks || []).forEach((task) => {
    if (isSandboxInstaFormMetaCapiEvent(task.data || {}, env)) {
      extra.push(task);
    }
  });
  return {
    tasks: (prodTasks || []).concat(extra),
    sandboxInstaFormAllowed: extra.length,
  };
}

function partitionTasksByEnvironment(tasks) {
  const prod = [];
  const sandbox = [];
  (tasks || []).forEach((task) => {
    const data = task.data || {};
    if (isSandboxTask(data)) sandbox.push(task);
    else prod.push(task);
  });
  return { prod, sandbox };
}

function logSandboxPlatformSkip(count) {
  if (count > 0) {
    console.log(
      `🧪 env-guard: ${count} sandbox task(s) — SKIP Google/Meta/GA4 MP prod; safe-sink → GOOGLE_SHEET_ID_SANDBOX`
    );
  }
}

/** Prod → GOOGLE_SHEET_ID; sandbox → GOOGLE_SHEET_ID_SANDBOX (nigdy prod arkusz). */
function getSpreadsheetId(taskData, prodSheetId, sandboxSheetId) {
  if (!isSandboxTask(taskData)) {
    return prodSheetId || null;
  }
  if (!sandboxSheetId) {
    return null;
  }
  return sandboxSheetId;
}

module.exports = {
  META_INSTA_FORM_CAPI_FLAG,
  getTaskEnvironment,
  isSandboxTask,
  shouldSkipProdPlatformApis,
  isInstaFormCapiFromSandboxEnabled,
  isSandboxInstaFormMetaCapiEvent,
  selectMetaCapiTasks,
  partitionTasksByEnvironment,
  logSandboxPlatformSkip,
  getSpreadsheetId,
};
