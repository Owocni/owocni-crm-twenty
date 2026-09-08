"use strict";

const INTERNAL_DOMAIN = "@owocni.pl";
const HANDOFF_SUBJECT_MARK = "[wewnętrzne]";

/**
 * CLIENT_* = uczestnik spoza @owocni.pl (istniejący tor isFollowUp / lastContact / M2).
 * personId na MessageParticipant NIE jest wymagany — Twenty nie auto-linkuje
 * kontaktów (incydent freemail); Thunderbird i karty ręczne często mają tylko handle.
 * INTERNAL_* = wątek ręcznie przypięty do Opportunity, bez adresu klienta (przekazanie).
 * Freelancer poza @owocni.pl: temat [Wewnętrzne] (nie CLIENT_*).
 * SKIP = nie ruszać leada.
 */
function selectExternalClientParticipant(parts) {
  for (const part of parts || []) {
    const handle = String(part.handle || "").toLowerCase();
    if (!handle) continue;
    if (handle.includes(INTERNAL_DOMAIN)) continue;
    return part;
  }
  return null;
}

function isInternalHandoffSubject(subject) {
  return String(subject || "").toLowerCase().includes(HANDOFF_SUBJECT_MARK);
}

function resolveEmailContactKind({
  clientParticipant,
  threadOpportunityId,
  direction,
  subject,
}) {
  const dir = String(direction || "").toUpperCase();
  if (isInternalHandoffSubject(subject)) {
    if (threadOpportunityId) {
      return dir === "INCOMING" ? "INTERNAL_IN" : "INTERNAL_OUT";
    }
    return "SKIP";
  }
  if (clientParticipant) {
    return dir === "INCOMING" ? "CLIENT_IN" : "CLIENT_OUT";
  }
  if (threadOpportunityId) {
    return dir === "INCOMING" ? "INTERNAL_IN" : "INTERNAL_OUT";
  }
  return "SKIP";
}

function pickResolvedOpportunity(candidates) {
  return (
    candidates?.byLinkedPersonId ||
    candidates?.byEmailPerson ||
    candidates?.byCardEmail ||
    candidates?.byThread ||
    null
  );
}

module.exports = {
  INTERNAL_DOMAIN,
  HANDOFF_SUBJECT_MARK,
  selectExternalClientParticipant,
  isInternalHandoffSubject,
  resolveEmailContactKind,
  pickResolvedOpportunity,
};
