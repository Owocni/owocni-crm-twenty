"use strict";

/**
 * „Do odpisania” (Opportunity.isFollowUp).
 * ON = czeka na ruch handlowca (nowy lead albo mail od klienta).
 * OFF = odpisaliśmy / ostatni ruch był nasz.
 *
 * Guard cutoverAt: receivedAt < cutoverAt → skutek biznesowy (flaga) NIE;
 * projekcje techniczne (lastContact) zostają. Brak/nieparsowalny receivedAt = fail-closed.
 */

const DEFAULT_CUTOVER_AT = "2026-08-31T00:00:00+02:00";

function parseCutoverAtMs(raw) {
  const source =
    raw === undefined || raw === null || String(raw).trim() === ""
      ? DEFAULT_CUTOVER_AT
      : String(raw).trim();
  const ms = Date.parse(source);
  if (!Number.isFinite(ms)) {
    throw new Error(`CUTOVER_AT nieparsowalny: ${source}`);
  }
  return ms;
}

function getCutoverAtMs() {
  return parseCutoverAtMs(process.env.CUTOVER_AT);
}

function parseReceivedAtMs(receivedAt) {
  if (receivedAt === undefined || receivedAt === null || receivedAt === "") {
    return null;
  }
  const ms = Date.parse(receivedAt);
  return Number.isFinite(ms) ? ms : null;
}

/** Czy wolno ruszyć isFollowUp dla tej wiadomości. */
function shouldApplyFollowUpFlag(receivedAt, cutoverAtMs) {
  const receivedMs = parseReceivedAtMs(receivedAt);
  if (receivedMs === null) return false;
  const cutover =
    cutoverAtMs === undefined ? getCutoverAtMs() : Number(cutoverAtMs);
  if (!Number.isFinite(cutover)) return false;
  return receivedMs >= cutover;
}

/**
 * @param {"INCOMING"|"OUTGOING"|string} direction
 * @returns {boolean|null} true=ON, false=OFF, null=nie ruszać
 */
function resolveFollowUpFlag(direction) {
  const dir = String(direction || "").toUpperCase();
  if (dir === "INCOMING") return true;
  if (dir === "OUTGOING") return false;
  return null;
}

function desiredFollowUpFromOpenLead(stage) {
  return String(stage || "").toUpperCase() === "NEW";
}

module.exports = {
  DEFAULT_CUTOVER_AT,
  parseCutoverAtMs,
  getCutoverAtMs,
  parseReceivedAtMs,
  shouldApplyFollowUpFlag,
  resolveFollowUpFlag,
  desiredFollowUpFromOpenLead,
};
