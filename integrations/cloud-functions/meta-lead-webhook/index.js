"use strict";

const functions = require("@google-cloud/functions-framework");
const { handleMetaLeadWebhook } = require("./handlers/processMetaLeadWebhook");

functions.http("processMetaLeadWebhook", async (req, res) => {
  try {
    await handleMetaLeadWebhook(req, res);
  } catch (err) {
    console.error("meta-lead-webhook fatal", err);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: err.message || String(err) });
    }
  }
});
