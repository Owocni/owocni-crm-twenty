"use strict";

const functions = require("@google-cloud/functions-framework");
const { runUpdatePersonWorker } = require("./workers/updatePerson");
const { runCreateLeadWorker } = require("./workers/createLead");
const { runAdvanceNewToContactedWorker } = require("./workers/advanceNewToContacted");
const { CREATE_LEAD_BUILD_ID } = require("./shared/config");

functions.http("processTwentyCrmWorker", async (req, res) => {
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  console.log("=== twenty-crm-worker START ===", CREATE_LEAD_BUILD_ID);

  try {
    const updatePerson = await runUpdatePersonWorker();
    const createLead = await runCreateLeadWorker();
    const advanceContacted = await runAdvanceNewToContactedWorker();
    res.status(200).json({
      ok: true,
      build_id: CREATE_LEAD_BUILD_ID,
      update_person: updatePerson,
      create_lead: createLead,
      advance_new_to_contacted: advanceContacted,
    });
  } catch (err) {
    console.error("twenty-crm-worker ERROR", err);
    res.status(500).json({
      ok: false,
      build_id: CREATE_LEAD_BUILD_ID,
      error: err.message,
    });
  }
});
