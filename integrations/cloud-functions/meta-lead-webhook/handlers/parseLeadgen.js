"use strict";

/**
 * Extract leadgen change payloads from Meta Page webhook body.
 * @returns {Array<{leadgen_id:string,page_id:string,form_id:string,ad_id:string,adgroup_id:string,created_time:string|number}>}
 */
function parseLeadgenEvents(body) {
  const events = [];
  if (!body || typeof body !== "object") return events;
  const entries = Array.isArray(body.entry) ? body.entry : [];
  for (const entry of entries) {
    const pageId = String(entry?.id || "").trim();
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      if (String(change?.field || "") !== "leadgen") continue;
      const value = change.value || {};
      const leadgenId = String(value.leadgen_id || "").trim();
      if (!leadgenId) continue;
      events.push({
        leadgen_id: leadgenId,
        page_id: String(value.page_id || pageId || "").trim(),
        form_id: String(value.form_id || "").trim(),
        ad_id: String(value.ad_id || "").trim(),
        adgroup_id: String(value.adgroup_id || "").trim(),
        created_time: value.created_time || "",
      });
    }
  }
  return events;
}

function handleVerifyGet(req, res, verifyToken) {
  const mode = String(req.query["hub.mode"] || "");
  const token = String(req.query["hub.verify_token"] || "");
  const challenge = String(req.query["hub.challenge"] || "");
  if (mode === "subscribe" && token && token === verifyToken && challenge) {
    res.status(200).send(challenge);
    return true;
  }
  res.status(403).send("Forbidden");
  return false;
}

module.exports = { parseLeadgenEvents, handleVerifyGet };
