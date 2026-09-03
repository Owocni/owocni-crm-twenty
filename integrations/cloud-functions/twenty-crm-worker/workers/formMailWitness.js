"use strict";

/**
 * Backup when sGTM Sortownia does not enqueue crm:twenty_create_lead.
 *
 * Form PHP always mails leads@ with subject starting "Zapytanie".
 * Email Sync stores that Message, but From is the mailer — not the customer —
 * so person.created / leads_at inbound never fires.
 * This worker parses the body and enqueues the same create_lead job Sortownia would.
 */

const crypto = require("crypto");
const { putTaskDocument, putIdentityMapDocument, readIdentityMapDocument } =
  require("../shared/stapeStore");
const {
  twentyRequest,
  parseTwentyListRecords,
  buildTwentyListPath,
  findPersonByEmail,
  findOpenOpportunityByPersonId,
} = require("../shared/twentyRest");

const ADAPTER_ID = "crm:twenty_create_lead";
const GUARD_PREFIX = "form_mail_witness_";
const SUBJECT_PREFIX = "Zapytanie";

function generateULID() {
  const chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let result = "";
  const bytes = crypto.randomBytes(26);
  for (let i = 0; i < 26; i++) {
    result += chars.charAt(bytes[i] % 32);
  }
  return result;
}

function isEnabled() {
  const flag = process.env.FORM_MAIL_WITNESS_ENABLED;
  if (flag === undefined || flag === "") return true;
  return flag === "true" || flag === "1";
}

function lookbackMs() {
  const hours = Number(process.env.FORM_MAIL_WITNESS_LOOKBACK_HOURS || 72);
  return Math.max(1, hours) * 60 * 60 * 1000;
}

function messageLimit() {
  const n = Number(process.env.FORM_MAIL_WITNESS_LIMIT || 20);
  return Math.min(Math.max(n, 1), 40);
}

function field(blob, labels) {
  const text = String(blob || "");
  for (const label of labels) {
    const re = new RegExp(
      `${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:：]\\s*(.+)`,
      "i",
    );
    const m = text.match(re);
    if (!m) continue;
    let val = m[1].split("\n")[0].trim();
    val = val.split(
      /\s+(?=Imię|Mail|Telefon|Url|URL|GCLID|Client ID|UserAgent|Role|UTM|cid:|tid:)/,
    )[0];
    val = val.trim().replace(/^[-–—]\s*/, "");
    if (val && !/^(undefined|-|&nbsp;)$/i.test(val)) return val;
  }
  return "";
}

function inferProduct(subject, text, pageUrl) {
  const blob = `${subject || ""}\n${text || ""}`;
  const dla = blob.match(/Zapytanie dla\s+([a-ząćęłńóśźż]+)/i);
  if (dla) {
    const p = dla[1].toLowerCase();
    if (p.startsWith("stron")) return "strony";
    if (p.startsWith("logo")) return "logo";
    if (p.startsWith("nazw")) return "nazwa";
  }
  const url = String(pageUrl || subject || "").toLowerCase();
  if (url.includes("projektowanie-logo") || url.includes("logofirmowe")) {
    return "logo";
  }
  if (url.includes("strony.owocni") || url.includes("/cennik")) return "strony";
  if (url.includes("copywriting.pl") && url.includes("nazw")) return "nazwa";
  if (url.includes("copywriting")) return "copywriting";
  if (url.includes("tworzenie-nazw") || url.includes("/nazwa")) return "nazwa";
  return "";
}

function pageFromMail(subject, text) {
  const subj = String(subject || "");
  if (/Zapytanie z strony:/i.test(subj)) {
    return subj.split(/Zapytanie z strony:/i)[1].trim();
  }
  const fromBody = field(text, ["Zapytanie ze strony", "Url", "URL"]);
  if (fromBody) return fromBody;
  const m = subj.match(/Zapytanie:\s*(\S+)/i);
  return m ? m[1] : "";
}

function parseZapytanieMail(subject, text) {
  const blob = `${subject || ""}\n${text || ""}`;
  const email = String(field(blob, ["Mail", "E-mail", "Email"]) || "")
    .trim()
    .toLowerCase();
  const name = field(blob, ["Imię", "Imie"]);
  const phone = field(blob, ["Telefon", "Phone"]);
  const pageUrl = pageFromMail(subject, text);
  const message = field(blob, ["Wiadomość", "Wiadomosc"]) || String(text || "").trim();
  const product = inferProduct(subject, text, pageUrl);
  return {
    email,
    name,
    phone,
    pageUrl,
    message,
    product,
  };
}

function isFormZapytanieSubject(subject) {
  const s = String(subject || "").trim();
  if (!s) return false;
  if (/^re\s*:/i.test(s)) return false;
  return s.toLowerCase().startsWith(SUBJECT_PREFIX.toLowerCase());
}

function isInternalEmail(email) {
  return /@owocni\.pl$/i.test(String(email || "").trim());
}

function guardKey(messageId) {
  return GUARD_PREFIX + String(messageId || "").trim();
}

async function listRecentZapytanieMessages() {
  const path =
    "/messages?filter=" +
    encodeURIComponent("subject[startsWith]:Zapytanie") +
    "&order_by=receivedAt[DescNullsLast]&limit=" +
    messageLimit();
  const res = await twentyRequest("GET", path);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`messages HTTP ${res.statusCode}`);
  }
  return parseTwentyListRecords("messages", res.body);
}

async function enqueueFromParsed(mail, messageId, receivedAt) {
  const idOid = generateULID();
  const timestamp = Date.now();
  const taskId = `${idOid}_${timestamp}_crm_twenty_create_lead`;
  const payload = {
    id_oid: idOid,
    id_event: timestamp + "_form_mail_witness",
    event_name: "generate_lead",
    job_type: ADAPTER_ID,
    status: "pending",
    created_at: timestamp,
    environment: "prod",
    adapter: ADAPTER_ID,
    src_system: "OWOCNI_SORTOWNIA",
    src_action_source: "form_mail_witness",
    biz_email: mail.email,
    biz_phone: mail.phone || null,
    biz_name: mail.name || null,
    biz_product: mail.product || null,
    biz_form_product: mail.product || null,
    biz_message: mail.message || null,
    ctx_page_url: mail.pageUrl || null,
    time_occurred_iso_utc: receivedAt || new Date().toISOString(),
    form_mail_message_id: messageId,
  };
  await putTaskDocument(taskId, payload);
  await putIdentityMapDocument(guardKey(messageId), {
    enqueued: true,
    id_oid: idOid,
    task_id: taskId,
    email: mail.email,
    enqueued_at: timestamp,
  });
  return { taskId, idOid };
}

async function processMessage(msg, cutoffMs) {
  const subject = msg.subject || "";
  if (!isFormZapytanieSubject(subject)) return { skipped: "subject" };
  const direction = String(msg.direction || "").toUpperCase();
  if (direction === "OUTGOING") return { skipped: "outgoing" };
  const mailboxes = msg.ourMailboxes || [];
  if (Array.isArray(mailboxes) && mailboxes.length && !mailboxes.includes("LEADS")) {
    return { skipped: "mailbox" };
  }
  const receivedAt = msg.receivedAt || msg.createdAt;
  const receivedMs = Date.parse(receivedAt || "");
  if (Number.isFinite(receivedMs) && receivedMs < cutoffMs) {
    return { skipped: "old" };
  }

  const parsed = parseZapytanieMail(subject, msg.text || "");
  if (!parsed.email || !parsed.email.includes("@")) {
    return { skipped: "no_email" };
  }
  if (isInternalEmail(parsed.email)) {
    return { skipped: "internal" };
  }

  const messageId = msg.id;
  const guard = await readIdentityMapDocument(guardKey(messageId));
  if (guard && guard.enqueued === true) {
    return { skipped: "already_enqueued" };
  }

  const person = await findPersonByEmail(parsed.email);
  if (person?.id) {
    const openOpp = await findOpenOpportunityByPersonId(person.id);
    if (openOpp?.id) {
      await putIdentityMapDocument(guardKey(messageId), {
        enqueued: true,
        skipped: "open_opportunity",
        opportunity_id: openOpp.id,
        email: parsed.email,
        enqueued_at: Date.now(),
      });
      return { skipped: "open_opportunity", opportunityId: openOpp.id };
    }
  }

  const queued = await enqueueFromParsed(parsed, messageId, receivedAt);
  console.log(
    "form_mail_witness enqueue",
    parsed.email,
    queued.taskId,
    "msg=",
    messageId,
  );
  return { enqueued: true, ...queued, email: parsed.email };
}

async function runFormMailWitnessWorker() {
  if (!isEnabled()) {
    console.log("form_mail_witness: disabled");
    return { skipped: "disabled" };
  }
  console.log("=== form_mail_witness worker ===");
  const cutoffMs = Date.now() - lookbackMs();
  const stats = { scanned: 0, enqueued: 0, skipped: 0 };
  let messages;
  try {
    messages = await listRecentZapytanieMessages();
  } catch (err) {
    console.error("form_mail_witness list FAIL", err.message);
    return { ...stats, error: err.message };
  }
  stats.scanned = messages.length;
  for (const msg of messages) {
    try {
      const result = await processMessage(msg, cutoffMs);
      if (result.enqueued) stats.enqueued += 1;
      else stats.skipped += 1;
    } catch (err) {
      stats.skipped += 1;
      console.error("form_mail_witness msg FAIL", msg.id, err.message);
    }
  }
  console.log(
    "form_mail_witness done scanned=",
    stats.scanned,
    "enqueued=",
    stats.enqueued,
    "skipped=",
    stats.skipped,
  );
  return stats;
}

module.exports = {
  runFormMailWitnessWorker,
  parseZapytanieMail,
  isFormZapytanieSubject,
  inferProduct,
  field,
};
