"use strict";

const crypto = require("crypto");
const { putTaskDocument } = require("../shared/stapeStore");
const { findOpportunityByMetaLeadgenId } = require("../shared/twentyRest");
const { runCreateLeadWorker, ADAPTER_ID } = require("./createLead");

function generateULID() {
  const chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let result = "";
  const bytes = crypto.randomBytes(26);
  for (let i = 0; i < 26; i++) {
    result += chars.charAt(bytes[i] % 32);
  }
  return result;
}

function fieldMap(fieldData) {
  const out = {};
  for (const item of fieldData || []) {
    const name = String(item?.name || "")
      .trim()
      .toLowerCase();
    const values = item?.values;
    const value = Array.isArray(values) ? values[0] : values;
    if (name) out[name] = value == null ? "" : String(value).trim();
  }
  return out;
}

function pickEmail(fields) {
  return (
    fields.email ||
    fields.work_email ||
    fields.email_address ||
    fields["e-mail"] ||
    ""
  );
}

function pickPhone(fields) {
  return (
    fields.phone_number ||
    fields.phone ||
    fields.work_phone_number ||
    fields.mobile ||
    ""
  );
}

function pickFullName(fields) {
  if (fields.full_name) return fields.full_name;
  const first = fields.first_name || fields.firstname || "";
  const last = fields.last_name || fields.lastname || "";
  return `${first} ${last}`.trim();
}

function inferBizProduct(formName, fields) {
  const hay = `${formName || ""} ${fields.product || ""} ${fields.service || ""}`.toLowerCase();
  if (hay.includes("logo")) return "logo";
  if (hay.includes("copy") || hay.includes("tekst") || hay.includes("naming")) {
    return "copywriting";
  }
  if (hay.includes("marketing") || hay.includes("strateg")) return "marketing";
  if (hay.includes("opakowan")) return "opakowanie";
  return "strony";
}

function buildCreateLeadTaskData(payload) {
  const leadgenId = String(payload.leadgen_id || payload.leadgenId || "").trim();
  if (!leadgenId) throw new Error("missing leadgen_id");

  const fields = fieldMap(payload.field_data || payload.fieldData);
  const email = pickEmail(fields);
  if (!email) throw new Error("missing email in field_data");

  const fullName = pickFullName(fields) || email.split("@")[0];
  const phone = pickPhone(fields);
  const formName = String(payload.form_name || payload.formName || "");
  const bizProduct = inferBizProduct(formName, fields);
  const idOid = String(payload.id_oid || payload.idOid || "").trim() || generateULID();
  const createdAt = Date.now();

  return {
    job_type: ADAPTER_ID,
    status: "pending",
    created_at: createdAt,
    environment: payload.environment || "sandbox",
    adapter: ADAPTER_ID,
    event_name: "generate_lead",
    id_oid: idOid,
    src_system: "OWOCNI_SORTOWNIA",
    src_action_source: "meta_instant_form",
    inbound_channel: "meta_instant_form",
    owner: "platform:meta_ads",
    assist: "platform:meta_ads",
    lead_id: leadgenId,
    meta_leadgen_id: leadgenId,
    meta_ad_id: String(payload.ad_id || payload.adId || "").trim(),
    meta_adgroup_id: String(payload.adgroup_id || payload.adgroupId || "").trim(),
    meta_form_id: String(payload.form_id || payload.formId || "").trim(),
    meta_page_id: String(payload.page_id || payload.pageId || "").trim(),
    meta_form_name: formName,
    biz_email: email,
    biz_phone: phone,
    biz_name: fullName,
    biz_product: bizProduct,
    biz_message: [
      "Lead Meta Instant Form",
      formName ? `Formularz: ${formName}` : "",
      fields.company_name ? `Firma: ${fields.company_name}` : "",
      Object.entries(fields)
        .filter(
          ([k]) =>
            ![
              "email",
              "phone_number",
              "phone",
              "full_name",
              "first_name",
              "last_name",
              "work_email",
            ].includes(k),
        )
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n"),
    ]
      .filter(Boolean)
      .join("\n"),
    attr_utm_source: "facebook",
    attr_utm_medium: "paid",
  };
}

async function enqueueMetaLeadTask(payload) {
  const leadgenId = String(payload.leadgen_id || payload.leadgenId || "").trim();
  if (!leadgenId) throw new Error("missing leadgen_id");

  const existing = await findOpportunityByMetaLeadgenId(leadgenId);
  if (existing?.id) {
    return {
      skipped: "already_exists",
      opportunityId: existing.id,
      leadgenId,
    };
  }

  const taskData = buildCreateLeadTaskData(payload);
  const taskId = `meta_leadgen_${leadgenId}_create_lead`;
  await putTaskDocument(taskId, taskData);
  return {
    taskId,
    enqueued: true,
    idOid: taskData.id_oid,
    leadgenId,
    email: taskData.biz_email,
  };
}

async function ingestMetaLead(payload) {
  const enqueue = await enqueueMetaLeadTask(payload);
  if (enqueue.skipped) return { enqueue, create_lead: null };
  const createLead = await runCreateLeadWorker();
  return { enqueue, create_lead: createLead };
}

module.exports = {
  enqueueMetaLeadTask,
  ingestMetaLead,
  buildCreateLeadTaskData,
  fieldMap,
  ADAPTER_ID,
};
