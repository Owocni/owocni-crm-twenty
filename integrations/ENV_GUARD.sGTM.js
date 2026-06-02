/**
 * ENV_GUARD.sGTM.js — fragment do wklejenia w tagi Stape (Sortownia, inbound:twenty_webhook).
 * sGTM nie obsługuje require() — ten plik jest źródłem prawdy do copy-paste.
 *
 * SSOT: ARCHITECTURE.md §5.4
 */

function getRuntimeEnvironment() {
  var raw =
    getEventDataWithFallback("environment") ||
    getEventDataWithFallback("runtime_environment") ||
    "prod";
  var normalized = makeString(raw).toLowerCase();
  return normalized === "sandbox" ? "sandbox" : "prod";
}

function isSandboxRuntime() {
  return getRuntimeEnvironment() === "sandbox";
}

function shouldRouteToProdPlatforms() {
  if (isSandboxRuntime()) {
    logToConsole("ENV_GUARD: sandbox — SKIP prod platform routing (safe-sink only)");
    return false;
  }
  return true;
}

// Przy zapisie task_queue zawsze ustaw pole environment (audyt + Robot env-guard)
function resolveTaskEnvironment() {
  return getRuntimeEnvironment();
}
