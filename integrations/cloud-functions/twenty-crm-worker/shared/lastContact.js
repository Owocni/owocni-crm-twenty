"use strict";

/**
 * lastContactAt may only move forward (email OR phone).
 * Older delayed email sync must not overwrite a newer call (or vice versa).
 */

function parseIsoMs(value) {
  if (!value) return NaN;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : NaN;
}

function maxIso(...values) {
  let best = null;
  let bestMs = -Infinity;
  for (const value of values) {
    const ms = parseIsoMs(value);
    if (!Number.isFinite(ms)) continue;
    if (ms >= bestMs) {
      bestMs = ms;
      best = value;
    }
  }
  return best;
}

/**
 * @returns {{ lastContactAt: string|null, advanced: boolean }}
 * lastContactAt is set only when candidate is strictly newer than existing
 * (or existing is empty). Equal timestamps → no write.
 */
function resolveForwardLastContactAt(existingIso, candidateIso) {
  const candidateMs = parseIsoMs(candidateIso);
  if (!Number.isFinite(candidateMs)) {
    return { lastContactAt: null, advanced: false };
  }
  const existingMs = parseIsoMs(existingIso);
  if (Number.isFinite(existingMs) && candidateMs <= existingMs) {
    return { lastContactAt: null, advanced: false };
  }
  return {
    lastContactAt: new Date(candidateMs).toISOString(),
    advanced: true,
  };
}

module.exports = {
  maxIso,
  parseIsoMs,
  resolveForwardLastContactAt,
};
