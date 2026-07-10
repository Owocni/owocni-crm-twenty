"use strict";

const crypto = require("crypto");
const {
  LEADS_AT_MESSAGE_CHANNEL_ID,
  PENDING_WRITE_TTL_MS,
} = require("../shared/config");
const {
  readTwentyStateDoc,
  writeTwentyStateDoc,
  readIdentityMapOid,
  readIdentityMapDoc,
  putIdentityMapDocument,
  writeIdentityMapProfile,
  putTaskDocument,
} = require("../shared/stapeStore");
const {
  twentyRequest,
  parseTwentyListRecords,
  buildTwentyListPath,
  patchOpportunity,
} = require("../shared/twentyRest");

const ADAPTER_ID = "inbound:twenty_webhook";
const IDENTITY_ADAPTER_ID = "identity:twenty_resolver";
const COLLECTION_PERSON_MINT_PREFIX = "twenty_person_";
const COLLECTION_TWENTY_STATE_PREFIX = "twenty_opp_";
const COLLECTION_PENDING_WRITE_PREFIX = "pending_write_twenty_";
const LEADS_AT_INTERNAL_DOMAIN = "@owocni.pl";
const COLLECTION_LEADS_AT_PREFIX = "leads_at_enqueue_";
const CREATE_LEAD_ADAPTER = "crm:twenty_create_lead";

const REASON_SKIP_DUPLICATE_DELIVERY = "SKIP_DUPLICATE_DELIVERY";
const REASON_SKIP_ECHO_OWN_WRITE = "SKIP_ECHO_OWN_WRITE";
const REASON_SKIP_COLD_START_BASELINE = "SKIP_COLD_START_BASELINE";
const REASON_SKIP_NO_RELEVANT_TRANSITION = "SKIP_NO_RELEVANT_TRANSITION";
const REASON_SKIP_QUALIFIED_WITHOUT_SQL_CONFIRM =
  "SKIP_QUALIFIED_WITHOUT_SQL_CONFIRM";
const REASON_SKIP_DUPLICATE_BUSINESS_EVENT = "SKIP_DUPLICATE_BUSINESS_EVENT";
const REASON_SKIP_UNSUPPORTED_OBJECT = "SKIP_UNSUPPORTED_OBJECT";
const REASON_SKIP_CAMPAIGN_REJECTED = "SKIP_CAMPAIGN_REJECTED";
const REASON_EMITTED = "EMITTED";

function makeString(value) {
  return String(value ?? "");
}

function normalizeSsoEventName(name) {
  if (!name) return name;
  if (name === "lead_won" || name === "closed_won") return "purchase";
  if (name === "lead_rejected") return "rejected_lead";
  return name;
}

function mergeWebhookPersonRecord(record, previous) {
  if (!record || typeof record !== "object") {
    return record;
  }
  if (!previous || typeof previous !== "object") {
    return record;
  }
  const merged = structuredClone(record);
  if (!merged.id && previous.id) {
    merged.id = previous.id;
  }
  if (!merged.idOid && previous.idOid) {
    merged.idOid = previous.idOid;
  }
  if (!merged.email && previous.email) {
    merged.email = previous.email;
  }
  if (!merged.phone && previous.phone) {
    merged.phone = previous.phone;
  }
  const prevEmails = previous.emails || {};
  const recEmails = merged.emails || {};
  if (!recEmails.primaryEmail && prevEmails.primaryEmail) {
    merged.emails = merged.emails || {};
    merged.emails.primaryEmail = prevEmails.primaryEmail;
  }
  const prevPhones = previous.phones || {};
  const recPhones = merged.phones || {};
  if (!recPhones.primaryPhoneNumber && prevPhones.primaryPhoneNumber) {
    merged.phones = merged.phones || {};
    merged.phones.primaryPhoneNumber = prevPhones.primaryPhoneNumber;
    merged.phones.primaryPhoneCallingCode =
      prevPhones.primaryPhoneCallingCode || "";
  }
  return merged;
}

function inferObjectTypeFromRecord(record, previous) {
  const r = record || {};
  const p = previous || {};
  if (r.stage !== undefined && r.stage !== null) {
    return "opportunity";
  }
  if (p.stage !== undefined && p.stage !== null) {
    return "opportunity";
  }
  if (r.campaignRejected !== undefined || r.pointOfContactId !== undefined) {
    return "opportunity";
  }
  if (r.bizProduct !== undefined || r.bizValueWon !== undefined) {
    return "opportunity";
  }
  if (r.emails !== undefined || p.emails !== undefined) {
    return "person";
  }
  if (
    r.firstName !== undefined ||
    r.lastName !== undefined ||
    p.firstName !== undefined ||
    p.lastName !== undefined
  ) {
    return "person";
  }
  if (r.name && typeof r.name === "object") {
    return "person";
  }
  if (r.jobTitle !== undefined || p.jobTitle !== undefined) {
    return "person";
  }
  return "";
}

function normalizeWebhookObjectType(raw) {
  const t = makeString(raw).toLowerCase();
  if (t === "people") {
    return "person";
  }
  return t;
}

function sanitizeWebhookField(value) {
  const s = makeString(value).trim();
  if (!s || s === "undefined" || s === "null") {
    return null;
  }
  return s;
}

function parseTwentyPayload(eventData) {
  const payload = eventData || {};
  let record = payload.data || payload.record || payload;
  if (record && record.record && typeof record.record === "object") {
    record = record.record;
  }
  const previous = payload.previousRecord || null;
  let eventPlatform =
    payload.event ||
    payload.operation ||
    payload.type ||
    payload.name ||
    payload.eventName ||
    "";
  let objectType = "";
  if (eventPlatform && eventPlatform.indexOf(".") > -1) {
    objectType = normalizeWebhookObjectType(eventPlatform.split(".")[0]);
  }
  if (!objectType) {
    objectType = inferObjectTypeFromRecord(record, previous);
  }
  if (objectType === "person" && previous) {
    record = mergeWebhookPersonRecord(record, previous);
  }
  const emails = record.emails || {};
  const phones = record.phones || {};
  let phoneRaw = "";
  if (phones.primaryPhoneNumber) {
    phoneRaw =
      (phones.primaryPhoneCallingCode || "") + (phones.primaryPhoneNumber || "");
  }
  const isPerson = objectType === "person";
  return {
    objectType: objectType || "",
    opportunityId: isPerson ? "" : record.id || payload.id || "",
    personId: isPerson ? record.id || "" : record.pointOfContactId || "",
    pointOfContactId: record.pointOfContactId || null,
    stage: record.stage || null,
    bizSqlConfirmed: record.bizSqlConfirmed === true,
    bizLastNonSqlStage: record.bizLastNonSqlStage || null,
    campaignRejected: record.campaignRejected === true,
    personIdOid: sanitizeWebhookField(record.idOid),
    opportunityIdOid: isPerson ? null : sanitizeWebhookField(record.idOid),
    eventNamePlatform: eventPlatform,
    bizValueWon: record.bizValueWon || null,
    bizProduct: sanitizeWebhookField(record.bizProduct) || null,
    bizEmail:
      emails.primaryEmail ||
      (record.person && record.person.email) ||
      (record.pointOfContact && record.pointOfContact.email) ||
      record.email ||
      null,
    bizPhone: phoneRaw || record.phone || null,
    _personRecord: isPerson ? record : null,
  };
}

function storeKeyOpportunityState(opportunityId) {
  return COLLECTION_TWENTY_STATE_PREFIX + opportunityId;
}

function storeKeyPendingWrite(opportunityId) {
  return COLLECTION_PENDING_WRITE_PREFIX + opportunityId;
}

function extractWebhookRecord(payload) {
  let record = payload?.data || payload?.record || payload || {};
  if (record && record.record && typeof record.record === "object") {
    record = record.record;
  }
  return record;
}

function normalizeBizValueForTask(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const s = value.trim();
    if (!s || s === "null" || s === "undefined") return "";
    const n = Number(s);
    return Number.isFinite(n) ? n : s;
  }
  if (typeof value === "object") {
    const micros = value.amountMicros;
    if (micros === null || micros === undefined) return "";
    const n = Number(micros);
    if (!Number.isFinite(n)) return "";
    return n / 1_000_000;
  }
  return "";
}

function isMeaningfulBizValue(value) {
  return (
    value !== "" &&
    value !== null &&
    value !== undefined &&
    Number(value) > 0
  );
}

function parseBizValueDisplay(display) {
  if (!display || typeof display !== "string") return "";
  const s = display.trim();
  if (!s || s === "0 PLN" || s === "Do ustalenia") return "";
  const matches = s.match(/\d[\d\s]*/g);
  if (!matches || !matches.length) return "";
  const numbers = matches
    .map((part) => Number(part.replace(/\s/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!numbers.length) return "";
  return Math.max(...numbers);
}

function resolveOpportunityBizValue(opp) {
  if (!opp || typeof opp !== "object") return "";
  const candidates = [
    opp.bizValueWon,
    opp.amount,
    opp.bizValueMax,
    opp.bizValueMin,
    parseBizValueDisplay(opp.bizValueDisplay),
  ];
  for (const candidate of candidates) {
    const normalized = normalizeBizValueForTask(candidate);
    if (isMeaningfulBizValue(normalized)) {
      return normalized;
    }
  }
  return "";
}

function deliveryFingerprint(webhookBody) {
  const payload = webhookBody || {};
  const record = extractWebhookRecord(payload);
  const previous = payload.previousRecord || {};
  const oppId = record.id || payload.id || "";
  const ev =
    payload.event ||
    payload.operation ||
    payload.type ||
    payload.name ||
    "";
  const stage = record.stage || "";
  const prevStage = previous.stage || "";
  const ts = payload.timestamp || record.updatedAt || "";
  return [ev, oppId, stage, prevStage, ts].join("|");
}

function resolveIdentityOid(parsed) {
  return (
    sanitizeWebhookField(parsed.opportunityIdOid) ||
    sanitizeWebhookField(parsed.personIdOid) ||
    null
  );
}

function detectBusinessEvent(parsed, prev) {
  if (!resolveIdentityOid(parsed)) {
    return { emit: "generate_lead", manual: true };
  }
  if (
    parsed.campaignRejected === true &&
    prev.last_stage !== parsed.stage &&
    (parsed.stage === "QUALIFIED" || parsed.stage === "WON")
  ) {
    return { skip: REASON_SKIP_CAMPAIGN_REJECTED };
  }
  if (prev.last_stage == null && prev.last_campaignRejected == null) {
    if (parsed.stage === "QUALIFIED") {
      if (parsed.bizSqlConfirmed === true) {
        return { emit: "qualify_lead" };
      }
      return { skip: REASON_SKIP_QUALIFIED_WITHOUT_SQL_CONFIRM };
    }
    if (parsed.stage === "WON") {
      return { emit: "purchase" };
    }
    if (parsed.campaignRejected === true) {
      return { emit: "rejected_lead" };
    }
    return { skip: REASON_SKIP_COLD_START_BASELINE };
  }
  if (prev.last_stage !== parsed.stage && parsed.stage === "QUALIFIED") {
    if (parsed.bizSqlConfirmed === true) {
      return { emit: "qualify_lead" };
    }
    return { skip: REASON_SKIP_QUALIFIED_WITHOUT_SQL_CONFIRM };
  }
  if (prev.last_stage !== parsed.stage && parsed.stage === "WON") {
    return { emit: "purchase" };
  }
  if (
    prev.last_campaignRejected === false &&
    parsed.campaignRejected === true
  ) {
    return { emit: "rejected_lead" };
  }
  if (
    prev.last_campaignRejected === true &&
    parsed.campaignRejected === true
  ) {
    return { skip: REASON_SKIP_DUPLICATE_BUSINESS_EVENT };
  }
  return { skip: REASON_SKIP_NO_RELEVANT_TRANSITION };
}

function personMintGuardKey(personId) {
  return COLLECTION_PERSON_MINT_PREFIX + personId;
}

function personIdentityBackfillTaskKey(personId) {
  return personMintGuardKey(personId) + "_identity_backfill";
}

function generateResolverULID() {
  const chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let result = "";
  const bytes = crypto.randomBytes(26);
  for (let i = 0; i < 26; i++) {
    result += chars.charAt(bytes[i] % 32);
  }
  return result;
}

async function putPersonMintGuardDoc(personId, idOid, env) {
  await putIdentityMapDocument(personMintGuardKey(personId), {
    id_oid: idOid,
    person_id: personId,
    environment: env,
    guard_type: "person_mint",
    updated_at: makeString(Date.now()),
  });
}

async function acquirePersonMintGuard(personId, env) {
  const doc = await readIdentityMapDoc(personMintGuardKey(personId));
  if (doc && doc.id_oid) {
    console.log("INBOUND_IDENTITY: MINT_GUARD_HIT", doc.id_oid);
    return doc.id_oid;
  }
  const candidate = generateResolverULID();
  await putPersonMintGuardDoc(personId, candidate, env);
  const finalDoc = await readIdentityMapDoc(personMintGuardKey(personId));
  if (!finalDoc || !finalDoc.id_oid) {
    throw new Error("MINT_GUARD_READBACK_FAIL");
  }
  if (finalDoc.id_oid !== candidate) {
    console.log(
      "INBOUND_IDENTITY: MINT_GUARD_COLLISION",
      candidate,
      "->",
      finalDoc.id_oid,
    );
  } else {
    console.log("INBOUND_IDENTITY: MINT_GUARD_CLAIM", finalDoc.id_oid);
  }
  return finalDoc.id_oid;
}

async function registerPersonMintGuard(personId, idOid, env) {
  const doc = await readIdentityMapDoc(personMintGuardKey(personId));
  if (doc && doc.id_oid) {
    if (doc.id_oid !== idOid) {
      console.log(
        "INBOUND_IDENTITY: MINT_GUARD_EXISTING",
        doc.id_oid,
        "requested",
        idOid,
      );
    }
    return doc.id_oid;
  }
  await putPersonMintGuardDoc(personId, idOid, env);
  return idOid;
}

async function resolvePersonIdOidForWrite(personId, decision, env) {
  if (decision.id_oid) {
    const guardOid = await registerPersonMintGuard(
      personId,
      decision.id_oid,
      env,
    );
    return { idOid: guardOid || decision.id_oid, tier: decision.tier };
  }
  const mintOid = await acquirePersonMintGuard(personId, env);
  return { idOid: mintOid, tier: "T3" };
}

function normalizeResolverEmail(raw) {
  if (!raw) return undefined;
  const str = makeString(raw).toLowerCase();
  const at = str.indexOf("@");
  if (at < 1) return undefined;
  return str;
}

function normalizeResolverPhone(raw) {
  if (!raw) return undefined;
  let digits = "";
  const s = makeString(raw);
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    if (c >= "0" && c <= "9") digits += c;
  }
  if (digits.length === 9) return "+48" + digits;
  if (digits.length >= 10) return "+" + digits;
  return undefined;
}

function resolveIdentityTier(emailOid, phoneOid) {
  const hasE = emailOid !== null && emailOid !== undefined && emailOid !== "";
  const hasP = phoneOid !== null && phoneOid !== undefined && phoneOid !== "";
  if (!hasE && !hasP) return { tier: "T3", id_oid: null };
  if (hasE && !hasP) return { tier: "T1", id_oid: emailOid };
  if (!hasE && hasP) return { tier: "T1", id_oid: phoneOid };
  if (emailOid === phoneOid) return { tier: "T2", id_oid: emailOid };
  return { tier: "T4", id_oid: null };
}

async function setPendingWrite(opportunityId) {
  const docKey = storeKeyPendingWrite(opportunityId);
  await writeTwentyStateDoc(docKey, {
    active: true,
    adapter: "inbound:sql_guard_revert",
    expires_at: Date.now() + PENDING_WRITE_TTL_MS,
  });
}

async function revertUnconfirmedSqlStage(parsed, prev) {
  const revertStage =
    (prev && prev.last_stage) || parsed.bizLastNonSqlStage || "NEW";
  if (!parsed.opportunityId || !revertStage || revertStage === "QUALIFIED") {
    return;
  }
  await setPendingWrite(parsed.opportunityId);
  try {
    await patchOpportunity(parsed.opportunityId, { stage: revertStage });
    console.log(
      "INBOUND_TWENTY: REVERT_UNCONFIRMED_SQL",
      parsed.opportunityId,
      "->",
      revertStage,
    );
  } catch (err) {
    console.log("INBOUND_TWENTY: REVERT_UNCONFIRMED_SQL_FAIL", err.message);
  }
}

function isInternalOwocniEmail(email) {
  const normalized = makeString(email).toLowerCase();
  if (!normalized) {
    return false;
  }
  const domainPos = normalized.indexOf(LEADS_AT_INTERNAL_DOMAIN);
  if (domainPos < 0) {
    return false;
  }
  return domainPos === normalized.length - LEADS_AT_INTERNAL_DOMAIN.length;
}

function buildPersonDisplayName(parsed) {
  const record = parsed && parsed._personRecord;
  if (record && record.name && typeof record.name === "object") {
    const first = makeString(record.name.firstName || "").trim();
    const last = makeString(record.name.lastName || "").trim();
    const full = (first + " " + last).trim();
    if (full) {
      return full;
    }
  }
  return "";
}

function leadsAtEnqueueGuardKey(personId) {
  return COLLECTION_LEADS_AT_PREFIX + personId;
}

async function writeLeadsAtEnqueueGuard(personId, idOid, env) {
  await putIdentityMapDocument(leadsAtEnqueueGuardKey(personId), {
    id_oid: idOid,
    person_id: personId,
    enqueued: true,
    environment: env,
    updated_at: makeString(Date.now()),
  });
}

async function checkParticipantMessagesForLeads(parts, index) {
  if (index >= parts.length || index >= 8) {
    return false;
  }
  const part = parts[index] || {};
  if (part.role && part.role !== "FROM") {
    return checkParticipantMessagesForLeads(parts, index + 1);
  }
  const msgId = part.messageId;
  if (!msgId) {
    return checkParticipantMessagesForLeads(parts, index + 1);
  }
  const path = buildTwentyListPath(
    "messageChannelMessageAssociations",
    "messageId[eq]:" + msgId,
    5,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error("assoc HTTP " + res.statusCode);
  }
  const assocs = parseTwentyListRecords(
    "messageChannelMessageAssociations",
    res.body,
  );
  for (const assoc of assocs) {
    if (
      assoc.messageChannelId === LEADS_AT_MESSAGE_CHANNEL_ID &&
      assoc.direction === "INCOMING"
    ) {
      return true;
    }
  }
  return checkParticipantMessagesForLeads(parts, index + 1);
}

async function finishFromParts(parts, nextStep) {
  if (!parts.length) {
    return nextStep();
  }
  const matched = await checkParticipantMessagesForLeads(parts, 0);
  if (matched) {
    return true;
  }
  return nextStep();
}

async function personHasLeadsAtIncoming(personId, email) {
  async function lookupByEmail() {
    const normalizedEmail = normalizeResolverEmail(email);
    if (!normalizedEmail) {
      return false;
    }
    const emailPath = buildTwentyListPath(
      "messageParticipants",
      "handle[eq]:" + normalizedEmail,
      15,
    );
    const emailRes = await twentyRequest("GET", emailPath);
    if (emailRes.statusCode < 200 || emailRes.statusCode >= 300) {
      throw new Error(
        "participants email HTTP " + emailRes.statusCode,
      );
    }
    const emailParts = parseTwentyListRecords(
      "messageParticipants",
      emailRes.body,
    );
    return finishFromParts(emailParts, async () => false);
  }

  if (!personId) {
    return lookupByEmail();
  }

  const path = buildTwentyListPath(
    "messageParticipants",
    "personId[eq]:" + personId,
    15,
  );
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error("participants HTTP " + res.statusCode);
  }
  const parts = parseTwentyListRecords("messageParticipants", res.body);
  return finishFromParts(parts, lookupByEmail);
}

async function enqueueLeadsAtCreateLeadTask(parsed, idOid, env) {
  const timestamp = Date.now();
  const email = normalizeResolverEmail(parsed.bizEmail);
  const phone = normalizeResolverPhone(parsed.bizPhone);
  const taskId = idOid + "_" + timestamp + "_crm_twenty_create_lead";
  const payload = {
    id_oid: idOid,
    id_event: timestamp + "_leads_at_create_lead",
    event_name: "generate_lead",
    job_type: CREATE_LEAD_ADAPTER,
    status: "pending",
    created_at: timestamp,
    environment: env,
    adapter: CREATE_LEAD_ADAPTER,
    inbound_channel: "leads_at",
    src_system: "TWENTY_EMAIL",
    src_action_source: "leads_at_email_sync",
    existing_person_id: parsed.personId,
    person_id: parsed.personId,
    biz_email: email || null,
    biz_phone: phone || null,
    biz_name: buildPersonDisplayName(parsed) || null,
  };
  await putTaskDocument(taskId, payload);
  console.log("LEADS_AT_CREATE: task saved", taskId);
  await writeLeadsAtEnqueueGuard(parsed.personId, idOid, env);
  return taskId;
}

async function maybeEnqueueLeadsAtCreateLead(parsed, idOid, env) {
  const email = normalizeResolverEmail(parsed.bizEmail);
  if (email && isInternalOwocniEmail(email)) {
    console.log("LEADS_AT_CREATE: SKIP_INTERNAL", email);
    return;
  }
  if (!parsed.personId || !idOid) {
    return;
  }
  try {
    const hasLeads = await personHasLeadsAtIncoming(parsed.personId, email);
    if (!hasLeads) {
      console.log("LEADS_AT_CREATE: SKIP_NO_LEADS_AT");
      return;
    }
    const guard = await readIdentityMapDoc(leadsAtEnqueueGuardKey(parsed.personId));
    if (guard && guard.enqueued === true && guard.id_oid === idOid) {
      console.log("LEADS_AT_CREATE: SKIP_ALREADY_ENQUEUED");
      return;
    }
    await enqueueLeadsAtCreateLeadTask(parsed, idOid, env);
  } catch (checkErr) {
    console.log("LEADS_AT_CREATE: CHECK_FAIL", checkErr.message);
  }
}

async function enqueueIdentityBackfill(idOid, personId, tier, env, email, phone) {
  const timestamp = Date.now();
  const taskId = personIdentityBackfillTaskKey(personId);
  await putTaskDocument(taskId, {
    id_oid: idOid,
    id_event: timestamp + "_identity_resolve",
    event_name: "identity_resolve",
    job_type: "crm:twenty_update_person",
    status: "pending",
    created_at: timestamp,
    environment: env,
    biz_email: email,
    biz_phone: phone,
    person_id: personId,
    identity_tier: tier,
    src_system: "TWENTY_EMAIL",
    src_action_source: "identity_resolver",
    adapter: IDENTITY_ADAPTER_ID,
  });
  return taskId;
}

async function enrichFromIdentityMap(idOid, enriched) {
  if (!idOid) {
    return enriched;
  }
  try {
    const doc = await readIdentityMapDoc(idOid);
    if (doc) {
      const fields = [
        "biz_email",
        "biz_phone",
        "biz_name",
        "biz_product",
        "order_id",
        "attr_gclid",
        "ctx_page_url",
        "ga_client_id",
        "client_id",
        "consent_analytics_storage",
        "consent_ad_storage",
        "ctx_ip_address",
        "ctx_time_on_page_ms",
        "biz_message",
        "owner",
      ];
      for (const fieldName of fields) {
        const current = enriched[fieldName];
        if (
          (current === null || current === undefined || current === "") &&
          doc[fieldName]
        ) {
          enriched[fieldName] = doc[fieldName];
        }
      }
    }
  } catch {
    // match sGTM: enrich best-effort
  }
  return enriched;
}

async function fetchTwentyPersonPii(personId) {
  const res = await twentyRequest(
    "GET",
    "/people/" + encodeURIComponent(personId),
  );
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error("HTTP " + res.statusCode);
  }
  const person = (res.body.data && res.body.data.person) || {};
  const emails = person.emails || {};
  const phones = person.phones || {};
  let phoneRaw = "";
  if (phones.primaryPhoneNumber) {
    phoneRaw =
      (phones.primaryPhoneCallingCode || "") +
      (phones.primaryPhoneNumber || "");
  }
  return {
    email: emails.primaryEmail || person.email || null,
    phone: phoneRaw || person.phone || null,
    idOid: person.idOid || null,
    name: person.name || null,
  };
}

async function enrichInboundTaskFromTwenty(taskPayload, parsed) {
  const enriched = structuredClone(taskPayload);
  if (!parsed.opportunityId) {
    return enrichFromIdentityMap(enriched.id_oid, enriched);
  }

  const oppRes = await twentyRequest(
    "GET",
    "/opportunities/" + encodeURIComponent(parsed.opportunityId),
  );
  if (oppRes.statusCode >= 200 && oppRes.statusCode < 300) {
    const opp = (oppRes.body.data && oppRes.body.data.opportunity) || {};
    if (!enriched.id_oid && opp.idOid) {
      enriched.id_oid = sanitizeWebhookField(opp.idOid);
    }
    if (!enriched.biz_email && opp.bizCardEmail) {
      enriched.biz_email = opp.bizCardEmail;
    }
    if (!enriched.biz_phone && opp.bizCardPhone) {
      enriched.biz_phone = opp.bizCardPhone;
    }
    if (!enriched.biz_name && opp.name) {
      enriched.biz_name = opp.name;
    }
    if (!enriched.biz_product && opp.bizProduct) {
      enriched.biz_product = opp.bizProduct;
    }
    if (enriched.biz_value === undefined || enriched.biz_value === null || enriched.biz_value === "") {
      enriched.biz_value = resolveOpportunityBizValue(opp);
    } else {
      enriched.biz_value = normalizeBizValueForTask(enriched.biz_value);
    }
    if (!parsed.pointOfContactId && opp.pointOfContactId) {
      parsed.pointOfContactId = opp.pointOfContactId;
    }
  }

  const personId = parsed.pointOfContactId;
  if ((!enriched.biz_email || !enriched.biz_phone) && personId) {
    try {
      const pii = await fetchTwentyPersonPii(personId);
      if (pii) {
        if (!enriched.biz_email && pii.email) {
          enriched.biz_email = pii.email;
        }
        if (!enriched.biz_phone && pii.phone) {
          enriched.biz_phone = pii.phone;
        }
        if (!enriched.biz_name && pii.name) {
          enriched.biz_name = pii.name;
        }
      }
    } catch {
      // best-effort
    }
  }

  return enrichFromIdentityMap(
    enriched.id_oid || parsed.opportunityIdOid,
    enriched,
  );
}

async function enqueueTaskQueue(taskPayload) {
  const taskId =
    (taskPayload.id_oid || "no_oid") +
    "_" +
    taskPayload.created_at +
    "_" +
    taskPayload.event_name;
  await putTaskDocument(taskId, taskPayload);
  console.log("INBOUND_TWENTY: task_queue saved", taskId);
  return taskId;
}

async function processPersonIdentityFromWebhook(parsed, env) {
  const isPersonEvent =
    parsed.objectType === "person" ||
    parsed.eventNamePlatform.indexOf("person.") === 0;
  if (!isPersonEvent) {
    return { status: "skipped", reason: "not_person_event" };
  }
  if (!parsed.personId) {
    console.log("INBOUND_IDENTITY: SKIP_NO_PERSON_ID");
    return { status: "skipped", reason: "no_person_id" };
  }

  async function runResolver() {
    if (parsed.personIdOid) {
      await registerPersonMintGuard(parsed.personId, parsed.personIdOid, env);
      console.log("INBOUND_IDENTITY: SKIP_ALREADY_HAS_IDOID");
      await maybeEnqueueLeadsAtCreateLead(parsed, parsed.personIdOid, env);
      return { status: "ok", id_oid: parsed.personIdOid };
    }

    const email = normalizeResolverEmail(parsed.bizEmail);
    const phone = normalizeResolverPhone(parsed.bizPhone);
    if (!email && !phone) {
      console.log("INBOUND_IDENTITY: SKIP_NO_PII");
      return { status: "skipped", reason: "no_pii" };
    }

    let emailOid = null;
    if (email) {
      try {
        emailOid = await readIdentityMapOid(email);
      } catch (eErr) {
        console.log("INBOUND_IDENTITY: FAIL_CLOSED email", eErr.message);
        throw eErr;
      }
    }

    let phoneOid = null;
    if (phone) {
      try {
        phoneOid = await readIdentityMapOid(phone);
      } catch (pErr) {
        console.log("INBOUND_IDENTITY: FAIL_CLOSED phone", pErr.message);
        throw pErr;
      }
    }

    const decision = resolveIdentityTier(emailOid, phoneOid);
    console.log(
      "INBOUND_IDENTITY:",
      decision.tier,
      "person=",
      parsed.personId,
    );

    if (decision.tier === "T4") {
      console.log("INBOUND_IDENTITY: T4_NEEDS_REVIEW");
      return { status: "skipped", reason: "T4_NEEDS_REVIEW" };
    }

    const { idOid, tier: writeTier } = await resolvePersonIdOidForWrite(
      parsed.personId,
      decision,
      env,
    );
    if (!idOid) {
      throw new Error("MINT_GUARD_FAIL");
    }

    await writeIdentityMapProfile(
      idOid,
      email,
      phone,
      writeTier,
      env,
      IDENTITY_ADAPTER_ID,
    );
    await enqueueIdentityBackfill(
      idOid,
      parsed.personId,
      writeTier,
      env,
      email,
      phone,
    );
    console.log("INBOUND_IDENTITY: RESOLVED", idOid);
    await maybeEnqueueLeadsAtCreateLead(parsed, idOid, env);
    return { status: "ok", id_oid: idOid, tier: writeTier };
  }

  const emailSeed = normalizeResolverEmail(parsed.bizEmail);
  const phoneSeed = normalizeResolverPhone(parsed.bizPhone);
  if (!emailSeed && !phoneSeed) {
    console.log("INBOUND_IDENTITY: FETCH_PERSON", parsed.personId);
    try {
      const pii = await fetchTwentyPersonPii(parsed.personId);
      if (pii.email) {
        parsed.bizEmail = pii.email;
      }
      if (pii.phone) {
        parsed.bizPhone = pii.phone;
      }
      if (pii.idOid) {
        parsed.personIdOid = pii.idOid;
      }
      if (pii.name) {
        parsed._personRecord = { name: pii.name };
      }
    } catch (fetchErr) {
      console.log("INBOUND_IDENTITY: FETCH_PERSON_FAIL", fetchErr.message);
      return { status: "skipped", reason: "fetch_person_fail" };
    }
  }

  return runResolver();
}

async function processTwentyWebhook(webhookBody, options = {}) {
  const env = options.runtimeEnvironment || "sandbox";
  const parsed = parseTwentyPayload(webhookBody);
  const allowedTypes = ["opportunity", "person"];

  console.log("=== INBOUND_TWENTY_WEBHOOK ===", ADAPTER_ID, "env=", env);
  console.log(
    "platform event:",
    parsed.eventNamePlatform,
    "objectType:",
    parsed.objectType,
    "oppId:",
    parsed.opportunityId,
    "personId:",
    parsed.personId,
    "stage:",
    parsed.stage,
  );

  if (
    parsed.objectType &&
    allowedTypes.indexOf(parsed.objectType.toLowerCase()) === -1
  ) {
    console.log("INBOUND_TWENTY:", REASON_SKIP_UNSUPPORTED_OBJECT, parsed.objectType);
    return { status: "skipped", reason: REASON_SKIP_UNSUPPORTED_OBJECT };
  }

  if (parsed.objectType === "person") {
    const identityResult = await processPersonIdentityFromWebhook(parsed, env);
    return { status: "ok", path: "person", ...identityResult };
  }

  if (!parsed.opportunityId) {
    console.log("INBOUND_TWENTY: brak oppId — skip");
    return { status: "skipped", reason: "no_opportunity_id" };
  }

  const stateKey = storeKeyOpportunityState(parsed.opportunityId);
  const pendingKey = storeKeyPendingWrite(parsed.opportunityId);

  const pendingDoc = await readTwentyStateDoc(pendingKey);
  if (pendingDoc && pendingDoc.active === true) {
    const pendingExpiresAt = pendingDoc.expires_at;
    const pendingStillActive =
      !pendingExpiresAt || pendingExpiresAt > Date.now();
    if (pendingStillActive) {
      console.log("INBOUND_TWENTY:", REASON_SKIP_ECHO_OWN_WRITE);
      return { status: "skipped", reason: REASON_SKIP_ECHO_OWN_WRITE };
    }
    console.log("INBOUND_TWENTY: pending_write expired — continue", pendingKey);
  }

  let prev = await readTwentyStateDoc(stateKey);
  if (!prev) prev = { last_stage: null, last_campaignRejected: null };

  const fp = deliveryFingerprint(webhookBody);
  if (prev.last_delivery_fingerprint && prev.last_delivery_fingerprint === fp) {
    console.log("INBOUND_TWENTY:", REASON_SKIP_DUPLICATE_DELIVERY);
    return { status: "skipped", reason: REASON_SKIP_DUPLICATE_DELIVERY };
  }

  const decision = detectBusinessEvent(parsed, prev);

  if (decision.skip === REASON_SKIP_QUALIFIED_WITHOUT_SQL_CONFIRM) {
    console.log("INBOUND_TWENTY:", decision.skip);
    await revertUnconfirmedSqlStage(parsed, prev);
    await writeTwentyStateDoc(stateKey, {
      last_stage:
        (prev && prev.last_stage) ||
        parsed.bizLastNonSqlStage ||
        parsed.stage,
      last_campaignRejected: parsed.campaignRejected,
      last_delivery_fingerprint: fp,
      updated_at: Date.now(),
    });
    return { status: "skipped", reason: REASON_SKIP_QUALIFIED_WITHOUT_SQL_CONFIRM };
  }

  await writeTwentyStateDoc(stateKey, {
    last_stage: parsed.stage,
    last_campaignRejected: parsed.campaignRejected,
    last_delivery_fingerprint: fp,
    updated_at: Date.now(),
  });

  if (decision.skip) {
    console.log("INBOUND_TWENTY:", decision.skip);
    return { status: "skipped", reason: decision.skip };
  }

  const eventName = normalizeSsoEventName(decision.emit);
  const timestamp = Date.now();
  const idOid = resolveIdentityOid(parsed) || "pending_mint";

  const taskPayload = {
    id_oid: idOid,
    id_event: timestamp + "_" + eventName,
    event_name: eventName,
    job_type: "analytics:ga4_mp",
    status: "pending",
    created_at: timestamp,
    environment: env,
    biz_email: parsed.bizEmail,
    biz_phone: parsed.bizPhone,
    biz_product: parsed.bizProduct,
    biz_value: normalizeBizValueForTask(parsed.bizValueWon) || "",
    src_system: "TWENTY_UI",
    src_action_source: decision.manual ? "manual_create" : "crm_webhook",
    adapter: ADAPTER_ID,
    opportunity_id: parsed.opportunityId,
    stage: parsed.stage,
    campaign_rejected: parsed.campaignRejected,
  };

  if (decision.manual) {
    taskPayload.job_type = "crm:twenty_update_person";
    if (parsed.pointOfContactId) {
      taskPayload.person_id = parsed.pointOfContactId;
    }
  }

  const finalPayload = await enrichInboundTaskFromTwenty(taskPayload, parsed);
  const taskId = await enqueueTaskQueue(finalPayload);
  console.log("INBOUND_TWENTY:", REASON_EMITTED, eventName, "taskId=", taskId);

  return {
    status: "emitted",
    reason: REASON_EMITTED,
    event_name: eventName,
    task_id: taskId,
  };
}

module.exports = {
  parseTwentyPayload,
  detectBusinessEvent,
  deliveryFingerprint,
  normalizeBizValueForTask,
  parseBizValueDisplay,
  resolveOpportunityBizValue,
  processTwentyWebhook,
  processPersonIdentityFromWebhook,
  REASON_EMITTED,
  REASON_SKIP_UNSUPPORTED_OBJECT,
  REASON_SKIP_CAMPAIGN_REJECTED,
};
