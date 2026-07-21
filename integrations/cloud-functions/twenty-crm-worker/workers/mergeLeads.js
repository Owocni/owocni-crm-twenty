"use strict";

const { PENDING_WRITE_TTL_MS } = require("../shared/config");
const {
  putTwentyStateDocument,
  readTwentyStateDocument,
  putIdentityMapDocument,
  readIdentityMapDocument,
  setPendingWrite,
  clearPendingWrite,
} = require("../shared/stapeStore");
const {
  twentyRequest,
  parseTwentyListRecords,
  patchTwentyRecord,
  buildTwentyListPath,
} = require("../shared/twentyRest");

const ADAPTER_ID = "crm:merge_leads";
const PAID_SRC = new Set(["OWOCNI_SORTOWNIA"]);

function transcriptCollection() {
  return process.env.CALL_TRANSCRIPT_OBJECT || "callTranscripts";
}

function participantCollection() {
  return process.env.CALL_TRANSCRIPT_PARTICIPANT_OBJECT ||
    "callTranscriptParticipants";
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function nationalNumber(value) {
  const digits = digitsOnly(value);
  if (digits.startsWith("48") && digits.length === 11) return digits.slice(2);
  if (digits.length === 9) return digits;
  return digits;
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

async function getRecord(collection, recordId) {
  const res = await twentyRequest(
    "GET",
    `/${collection}/${encodeURIComponent(recordId)}`,
  );
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`GET ${collection} HTTP ${res.statusCode}`);
  }
  const singular = collection.endsWith("s") ? collection.slice(0, -1) : collection;
  return (
    res.body?.data?.[singular] ||
    res.body?.data?.person ||
    res.body?.data?.opportunity ||
    res.body?.data?.callTranscript ||
    {}
  );
}

function isPaidOpportunity(opp) {
  const src = String(opp?.srcSystem || "").trim();
  const idOid = String(opp?.idOid || "").trim();
  return Boolean(idOid) && PAID_SRC.has(src);
}

function mergeAuditKey(loserId, survivorId) {
  return `merge_${loserId}_${survivorId}`;
}

async function listCallTranscriptsForOpportunity(opportunityId) {
  const path = buildTwentyListPath(
    transcriptCollection(),
    `opportunityId[eq]:${opportunityId}`,
    100,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`list callTranscripts HTTP ${res.statusCode}`);
  }
  return parseTwentyListRecords(transcriptCollection(), res.body);
}

async function listParticipantsForTranscript(transcriptId) {
  const path = buildTwentyListPath(
    participantCollection(),
    `callTranscriptId[eq]:${transcriptId}`,
    20,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`list participants HTTP ${res.statusCode}`);
  }
  return parseTwentyListRecords(participantCollection(), res.body);
}

function personPrimaryEmail(person) {
  return normalizeEmail(person?.emails?.primaryEmail);
}

function personAdditionalEmails(person) {
  const raw = person?.emails?.additionalEmails;
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeEmail).filter(Boolean);
}

function personPrimaryPhoneNational(person) {
  return nationalNumber(person?.phones?.primaryPhoneNumber);
}

function personAdditionalPhones(person) {
  const raw = person?.phones?.additionalPhones;
  if (!Array.isArray(raw)) return [];
  return raw;
}

/**
 * Merge loser Person contact fields into survivor Person (additional email/phone).
 * Does not delete loser Person.
 */
async function mergePersonContacts(survivorPerson, loserPerson) {
  if (!survivorPerson?.id || !loserPerson?.id) {
    return { emailAdded: false, phoneAdded: false };
  }
  if (survivorPerson.id === loserPerson.id) {
    return { emailAdded: false, phoneAdded: false, samePerson: true };
  }

  const patch = {};
  let emailAdded = false;
  let phoneAdded = false;

  const loserEmail = personPrimaryEmail(loserPerson);
  const survivorEmail = personPrimaryEmail(survivorPerson);
  const additional = new Set(personAdditionalEmails(survivorPerson));
  if (loserEmail && loserEmail !== survivorEmail && !additional.has(loserEmail)) {
    additional.add(loserEmail);
    emailAdded = true;
  }
  for (const extra of personAdditionalEmails(loserPerson)) {
    if (extra && extra !== survivorEmail && !additional.has(extra)) {
      additional.add(extra);
      emailAdded = true;
    }
  }
  if (emailAdded || survivorEmail) {
    patch.emails = {
      primaryEmail: survivorEmail || loserEmail || undefined,
      additionalEmails: [...additional],
    };
  }

  const loserPhone = personPrimaryPhoneNational(loserPerson);
  const survivorPhone = personPrimaryPhoneNational(survivorPerson);
  const addPhones = [...personAdditionalPhones(survivorPerson)];
  const existingNationals = new Set(
    [survivorPhone, ...addPhones.map((p) => nationalNumber(p?.number || p))]
      .map((n) => nationalNumber(n))
      .filter(Boolean),
  );
  if (loserPhone && loserPhone !== survivorPhone && !existingNationals.has(loserPhone)) {
    addPhones.push({
      number: loserPhone,
      callingCode: loserPerson?.phones?.primaryPhoneCallingCode || "+48",
    });
    existingNationals.add(loserPhone);
    phoneAdded = true;
  }
  if (phoneAdded || survivorPhone) {
    const phonesPatch = {
      primaryPhoneCallingCode:
        survivorPerson?.phones?.primaryPhoneCallingCode ||
        (survivorPhone ? "+48" : loserPerson?.phones?.primaryPhoneCallingCode) ||
        "+48",
      primaryPhoneNumber: survivorPhone || loserPhone || "",
      additionalPhones: addPhones,
    };
    if (!survivorPhone && loserPhone) {
      phonesPatch.primaryPhoneNumber = loserPhone;
      phonesPatch.primaryPhoneCallingCode =
        loserPerson?.phones?.primaryPhoneCallingCode || "+48";
    }
    patch.phones = phonesPatch;
  }

  if (Object.keys(patch).length) {
    await patchTwentyRecord("people", survivorPerson.id, patch);
  }
  return { emailAdded, phoneAdded };
}

async function listMessageParticipantsForPerson(personId, limit = 100) {
  const path = buildTwentyListPath(
    "messageParticipants",
    `personId[eq]:${personId}`,
    limit,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`list messageParticipants HTTP ${res.statusCode}`);
  }
  return parseTwentyListRecords("messageParticipants", res.body);
}

/**
 * Email Sync timeline hangs off MessageParticipant.personId — must re-point
 * loser → survivor so both addresses show on the survivor Person card.
 */
async function relinkMessageParticipants(loserPersonId, survivorPersonId) {
  if (!loserPersonId || !survivorPersonId || loserPersonId === survivorPersonId) {
    return { moved: 0 };
  }
  let moved = 0;
  let cursorGuard = 0;
  while (cursorGuard < 20) {
    cursorGuard += 1;
    const parts = await listMessageParticipantsForPerson(loserPersonId, 50);
    if (!parts.length) break;
    for (const part of parts) {
      if (!part?.id) continue;
      await patchTwentyRecord("messageParticipants", part.id, {
        personId: survivorPersonId,
      });
      moved += 1;
    }
    if (parts.length < 50) break;
  }
  return { moved };
}

async function relinkCallTranscripts(loserOppId, survivorOppId, survivorPersonId) {
  const transcripts = await listCallTranscriptsForOpportunity(loserOppId);
  let moved = 0;
  let participantsPatched = 0;

  for (const tx of transcripts) {
    if (!tx?.id) continue;
    await patchTwentyRecord(transcriptCollection(), tx.id, {
      opportunityId: survivorOppId,
      matchStatus: "MATCHED",
    });
    moved += 1;

    if (!survivorPersonId) continue;
    const parts = await listParticipantsForTranscript(tx.id);
    for (const part of parts) {
      if (!part?.id || part.workspaceMemberId) continue;
      await patchTwentyRecord(participantCollection(), part.id, {
        personId: survivorPersonId,
      });
      participantsPatched += 1;
    }
  }

  return { moved, participantsPatched };
}

function maxIso(a, b) {
  const ta = Date.parse(a || "");
  const tb = Date.parse(b || "");
  if (!Number.isFinite(ta) && !Number.isFinite(tb)) return null;
  if (!Number.isFinite(ta)) return b;
  if (!Number.isFinite(tb)) return a;
  return ta >= tb ? a : b;
}

async function aliasStapeIdentity({
  survivorOid,
  loserOid,
  loserEmail,
  loserPhone,
  survivorOppId,
  loserOppId,
  reason,
}) {
  const mergedAt = Date.now();
  const aliasPatch = {
    canonical_oid: survivorOid || null,
    merged_into: survivorOid || survivorOppId,
    merged_from_opportunity_id: loserOppId,
    merged_into_opportunity_id: survivorOppId,
    merged_at: mergedAt,
    merge_reason: String(reason || "manual_merge").slice(0, 500),
    merge_adapter: ADAPTER_ID,
  };

  const keys = [];
  if (loserOid) keys.push(loserOid);
  if (loserEmail) keys.push(normalizeEmail(loserEmail));
  const phoneDigits = digitsOnly(loserPhone);
  if (phoneDigits) {
    keys.push(phoneDigits);
    if (phoneDigits.length === 11 && phoneDigits.startsWith("48")) {
      keys.push(phoneDigits.slice(2));
    }
  }

  const aliasedKeys = [];
  for (const key of [...new Set(keys)].filter(Boolean)) {
    const existing = (await readIdentityMapDocument(key)) || {};
    const next = {
      ...existing,
      ...aliasPatch,
      id_oid: survivorOid || existing.id_oid || null,
    };
    if (survivorOid && existing.id_oid && existing.id_oid !== survivorOid) {
      next.previous_id_oid = existing.id_oid;
    }
    await putIdentityMapDocument(key, next);
    aliasedKeys.push(key);
  }
  return { aliasedKeys, mergedAt };
}

/**
 * Manual merge: loser Opportunity → survivor Opportunity.
 * @param {{ survivorOpportunityId: string, loserOpportunityId: string, reason?: string, adminConfirmed?: boolean, actor?: string }} input
 */
async function mergeLeads(input) {
  const survivorId = String(
    input.survivorOpportunityId || input.survivorId || "",
  ).trim();
  const loserId = String(
    input.loserOpportunityId || input.loserId || "",
  ).trim();
  const reason = String(input.reason || "").trim();
  const adminConfirmed =
    input.adminConfirmed === true ||
    input.adminConfirmed === "true" ||
    input.adminConfirmed === "1";

  if (!survivorId || !loserId) {
    throw new Error("survivorOpportunityId and loserOpportunityId required");
  }
  if (survivorId === loserId) {
    throw new Error("survivor and loser must differ");
  }

  const forceRelink =
    input.forceRelink === true ||
    input.forceRelink === "true" ||
    input.relinkEmails === true ||
    input.relinkEmails === "true";

  const auditKey = mergeAuditKey(loserId, survivorId);
  const existingAudit = await readTwentyStateDocument(auditKey);
  if (existingAudit?.merged === true && !forceRelink) {
    return {
      skipped: "already_merged",
      survivorOpportunityId: survivorId,
      loserOpportunityId: loserId,
      auditKey,
    };
  }

  const survivor = await getRecord("opportunities", survivorId);
  const loser = await getRecord("opportunities", loserId);
  if (!survivor?.id) throw new Error("survivor opportunity not found");
  if (!loser?.id) throw new Error("loser opportunity not found");

  // Repair path: only re-link emails/calls on an already-merged pair
  if (existingAudit?.merged === true && forceRelink) {
    const survivorPersonId =
      existingAudit.survivor_person_id || survivor.pointOfContactId || null;
    const loserPersonId =
      existingAudit.loser_person_id || loser.pointOfContactId || null;
    const emails = await relinkMessageParticipants(
      loserPersonId,
      survivorPersonId,
    );
    const transcripts = await relinkCallTranscripts(
      loserId,
      survivorId,
      survivorPersonId,
    );
    await putTwentyStateDocument(auditKey, {
      ...existingAudit,
      emails_moved: (existingAudit.emails_moved || 0) + emails.moved,
      transcripts_moved:
        (existingAudit.transcripts_moved || 0) + transcripts.moved,
      participants_patched:
        (existingAudit.participants_patched || 0) +
        transcripts.participantsPatched,
      relinked_at: Date.now(),
    });
    return {
      ok: true,
      repaired: true,
      survivorOpportunityId: survivorId,
      loserOpportunityId: loserId,
      emailsMoved: emails.moved,
      transcriptsMoved: transcripts.moved,
      participantsPatched: transcripts.participantsPatched,
      auditKey,
    };
  }

  if (isPaidOpportunity(survivor) && isPaidOpportunity(loser) && !adminConfirmed) {
    return {
      skipped: "needs_admin_t5",
      message:
        "Oba leady mają paid idOid (OWOCNI_SORTOWNIA) — ustaw adminConfirmed=true",
      survivorOpportunityId: survivorId,
      loserOpportunityId: loserId,
      survivorIdOid: survivor.idOid,
      loserIdOid: loser.idOid,
    };
  }

  const survivorPersonId = survivor.pointOfContactId || null;
  const loserPersonId = loser.pointOfContactId || null;
  let survivorPerson = survivorPersonId
    ? await getRecord("people", survivorPersonId)
    : null;
  let loserPerson = loserPersonId
    ? await getRecord("people", loserPersonId)
    : null;

  if (!survivorPersonId && loserPersonId) {
    await patchTwentyRecord("opportunities", survivorId, {
      pointOfContactId: loserPersonId,
    });
    survivorPerson = loserPerson;
  }

  const contactMerge =
    survivorPerson && loserPerson
      ? await mergePersonContacts(survivorPerson, loserPerson)
      : { emailAdded: false, phoneAdded: false };

  const finalSurvivorPersonId =
    survivorPerson?.id || survivorPersonId || loserPersonId || null;

  await setPendingWrite(survivorId, ADAPTER_ID, PENDING_WRITE_TTL_MS);
  await setPendingWrite(loserId, ADAPTER_ID, PENDING_WRITE_TTL_MS);

  const transcripts = await relinkCallTranscripts(
    loserId,
    survivorId,
    finalSurvivorPersonId,
  );
  const emails = await relinkMessageParticipants(
    loserPersonId,
    finalSurvivorPersonId,
  );

  const loserOid = String(loser.idOid || "").trim();
  const survivorOid = String(survivor.idOid || "").trim();
  const auditNote =
    `Scalony z leadem ${survivor.name || survivorId} (${survivorId}). ` +
    `loser idOid=${loserOid || "—"} → survivor idOid=${survivorOid || "—"}. ` +
    (reason ? `Powód: ${reason}. ` : "") +
    `Adapter ${ADAPTER_ID}.`;

  await patchTwentyRecord("opportunities", loserId, {
    stage: "LOST",
    rejectionReason: "DUPLICATE",
    lossDescription: auditNote.slice(0, 2000),
  });

  const survivorPatch = {};
  const lastContact = maxIso(survivor.lastContactAt, loser.lastContactAt);
  if (lastContact && lastContact !== survivor.lastContactAt) {
    survivorPatch.lastContactAt = lastContact;
    survivorPatch.bizLastContactLabel = "Godzin: 0";
  }
  if (!survivor.bizCardEmail && (loser.bizCardEmail || personPrimaryEmail(loserPerson))) {
    survivorPatch.bizCardEmail =
      loser.bizCardEmail || personPrimaryEmail(loserPerson);
  }
  if (!survivor.bizCardPhone && (loser.bizCardPhone || loserPerson?.phones?.primaryPhoneNumber)) {
    const phone =
      loser.bizCardPhone ||
      `${loserPerson?.phones?.primaryPhoneCallingCode || "+48"}${loserPerson?.phones?.primaryPhoneNumber || ""}`;
    survivorPatch.bizCardPhone = phone;
  }
  if (Object.keys(survivorPatch).length) {
    await patchTwentyRecord("opportunities", survivorId, survivorPatch);
  }

  const stape = await aliasStapeIdentity({
    survivorOid: survivorOid || null,
    loserOid: loserOid || null,
    loserEmail:
      personPrimaryEmail(loserPerson) || normalizeEmail(loser.bizCardEmail),
    loserPhone:
      loser.bizCardPhone ||
      (loserPerson?.phones?.primaryPhoneNumber
        ? `${loserPerson.phones.primaryPhoneCallingCode || ""}${loserPerson.phones.primaryPhoneNumber}`
        : ""),
    survivorOppId: survivorId,
    loserOppId: loserId,
    reason,
  });

  await putTwentyStateDocument(auditKey, {
    merged: true,
    adapter: ADAPTER_ID,
    survivor_opportunity_id: survivorId,
    loser_opportunity_id: loserId,
    survivor_id_oid: survivorOid || null,
    loser_id_oid: loserOid || null,
    survivor_person_id: finalSurvivorPersonId,
    loser_person_id: loserPersonId,
    transcripts_moved: transcripts.moved,
    participants_patched: transcripts.participantsPatched,
    emails_moved: emails.moved,
    contact_merge: contactMerge,
    stape_aliased_keys: stape.aliasedKeys,
    reason: reason || null,
    actor: input.actor || null,
    admin_confirmed: adminConfirmed,
    merged_at: stape.mergedAt,
  });

  await clearPendingWrite(survivorId, ADAPTER_ID);
  await clearPendingWrite(loserId, ADAPTER_ID);

  return {
    ok: true,
    survivorOpportunityId: survivorId,
    loserOpportunityId: loserId,
    survivorIdOid: survivorOid || null,
    loserIdOid: loserOid || null,
    survivorPersonId: finalSurvivorPersonId,
    transcriptsMoved: transcripts.moved,
    participantsPatched: transcripts.participantsPatched,
    emailsMoved: emails.moved,
    contactMerge,
    stape,
    auditKey,
  };
}

module.exports = {
  ADAPTER_ID,
  mergeLeads,
};
