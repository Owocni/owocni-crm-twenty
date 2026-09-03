"use strict";

const crypto = require("crypto");

const META_EVENT_MAP = {
  generate_lead: "Lead",
  qualify_lead: "QualifiedLead",
  purchase: "Purchase",
  rejected_lead: "rejected",
};

function sha256HexLower(input) {
  return crypto.createHash("sha256").update(String(input), "utf8").digest("hex");
}

function resolveLeadId(taskData) {
  if (!taskData || typeof taskData !== "object") return "";
  return String(
    taskData.lead_id ||
      taskData.meta_leadgen_id ||
      taskData.metaLeadgenId ||
      "",
  ).trim();
}

function isInstantFormLead(taskData) {
  if (resolveLeadId(taskData)) return true;
  const src = String(
    (taskData && taskData.src_action_source) || "",
  ).toLowerCase();
  return src === "meta_instant_form";
}

function shouldSendMetaCapi(taskData, ssotEventName) {
  if (!META_EVENT_MAP[ssotEventName]) return false;
  if (isInstantFormLead(taskData) && ssotEventName === "generate_lead") {
    return false;
  }
  return true;
}

function buildWebsiteUserData(taskData) {
  const userData = {};
  const email = String((taskData && taskData.biz_email) || "")
    .toLowerCase()
    .trim();
  if (email) userData.em = [sha256HexLower(email)];
  if (taskData && taskData.biz_phone) {
    userData.ph = [sha256HexLower(taskData.biz_phone)];
  }
  if (taskData && taskData.id_oid) {
    userData.external_id = [sha256HexLower(String(taskData.id_oid).trim())];
  }
  if (taskData && taskData.attr_fbc) userData.fbc = String(taskData.attr_fbc);
  if (taskData && taskData.attr_fbp) userData.fbp = String(taskData.attr_fbp);
  if (taskData && taskData.ctx_ip_address) {
    userData.client_ip_address = String(taskData.ctx_ip_address);
  }
  if (taskData && taskData.ctx_user_agent) {
    userData.client_user_agent = String(taskData.ctx_user_agent);
  }
  return userData;
}

function crmCustomData(prepared, ssotName) {
  const custom = {
    lead_event_source: "Twenty CRM",
    event_source: "crm",
  };
  if (ssotName === "purchase" || (prepared && prepared.event_name === "Purchase")) {
    const num = Number(prepared && prepared.value);
    custom.currency = (prepared && prepared.currency) || "PLN";
    custom.value =
      prepared &&
      prepared.value != null &&
      prepared.value !== "" &&
      !Number.isNaN(num)
        ? num
        : 0.01;
  }
  return custom;
}

/**
 * Graph CAPI event (jeden element `data[]`).
 * Instant Form (lead_id): action_source=system_generated + CRM custom_data
 *   (lead_event_source / event_source=crm — bez tego Meta nie rejestruje Conversion Leads).
 * Website: action_source=website + hashed PII / fbc / fbp.
 */
function buildMetaCapiEvent(taskData, prepared) {
  if (!prepared || !prepared.event_name) return null;
  const ssotName = String((taskData && taskData.event_name) || "").trim();
  if (!shouldSendMetaCapi(taskData, ssotName)) return null;

  const leadId = resolveLeadId(taskData);
  const event = {
    event_name: prepared.event_name,
    event_time: prepared.event_time,
    event_id: prepared.event_id,
    action_source: leadId ? "system_generated" : "website",
    user_data: {},
  };

  if (leadId) {
    event.user_data.lead_id = leadId;
    event.custom_data = crmCustomData(prepared, ssotName);
    return event;
  }

  event.user_data = buildWebsiteUserData(taskData);
  if (prepared.value != null && prepared.value !== "") {
    const num = Number(prepared.value);
    if (!Number.isNaN(num)) {
      event.custom_data = {
        value: num,
        currency: prepared.currency || "PLN",
      };
    }
  }
  return event;
}

module.exports = {
  META_EVENT_MAP,
  resolveLeadId,
  isInstantFormLead,
  shouldSendMetaCapi,
  buildWebsiteUserData,
  buildMetaCapiEvent,
  sha256HexLower,
};
