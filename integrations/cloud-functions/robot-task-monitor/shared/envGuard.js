/**
 * envGuard.js — rozdzielenie sandbox/prod (Robot / Node).
 * SSOT: ARCHITECTURE.md §5.4, INTEGRATIONS_PARITY P10
 */

const { RUNTIME_ENV } = require('./ssotPaths');

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
  getTaskEnvironment,
  isSandboxTask,
  shouldSkipProdPlatformApis,
  partitionTasksByEnvironment,
  logSandboxPlatformSkip,
  getSpreadsheetId,
};
