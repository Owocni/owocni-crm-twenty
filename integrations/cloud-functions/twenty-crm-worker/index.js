"use strict";

const functions = require("@google-cloud/functions-framework");
const { runUpdatePersonWorker } = require("./workers/updatePerson");
const { runCreateLeadWorker } = require("./workers/createLead");
const { runAdvanceNewToContactedWorker, processEmailContactWebhook } = require("./workers/advanceNewToContacted");
const {
  enqueueCallTranscriptTask,
  runCallTranscriptIngestWorker,
} = require("./workers/callTranscriptIngest");
const {
  linkCallTranscriptToOpportunity,
  createLeadFromCallTranscript,
  processCallTranscriptWebhook,
} = require("./workers/callTranscriptLink");
const { mergeLeads } = require("./workers/mergeLeads");
const { CREATE_LEAD_BUILD_ID } = require("./shared/config");

functions.http("processTwentyCrmWorker", async (req, res) => {
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  console.log("=== twenty-crm-worker START ===", CREATE_LEAD_BUILD_ID);

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const eventName = String(
      body.event || body.eventName || body.type || body.name || "",
    );
    if (
      req.method === "POST" &&
      eventName.startsWith("messageChannelMessageAssociation.")
    ) {
      const emailContact = await processEmailContactWebhook(body);
      res.status(200).json({
        ok: true,
        build_id: CREATE_LEAD_BUILD_ID,
        mode: "email_contact_webhook",
        event: eventName,
        email_contact: emailContact,
      });
      return;
    }

    if (req.method === "POST" && body.action === "link_call_transcript") {
      const data = body.data || body;
      const linked = await linkCallTranscriptToOpportunity(
        data.transcriptId || data.callTranscriptId,
        data.opportunityId,
      );
      res.status(200).json({
        ok: true,
        build_id: CREATE_LEAD_BUILD_ID,
        mode: "call_transcript_link",
        link: linked,
      });
      return;
    }

    if (req.method === "POST" && body.action === "create_lead_from_call") {
      const data = body.data || body;
      const created = await createLeadFromCallTranscript({
        transcriptId: data.transcriptId || data.callTranscriptId,
        contactName: data.contactName || data.name || null,
      });
      res.status(200).json({
        ok: true,
        build_id: CREATE_LEAD_BUILD_ID,
        mode: "create_lead_from_call",
        create: created,
      });
      return;
    }

    if (req.method === "POST" && body.action === "merge_leads") {
      const data = body.data || body;
      const merged = await mergeLeads({
        survivorOpportunityId:
          data.survivorOpportunityId || data.survivorId || data.targetOpportunityId,
        loserOpportunityId:
          data.loserOpportunityId || data.loserId || data.sourceOpportunityId,
        reason: data.reason || null,
        adminConfirmed: data.adminConfirmed,
        actor: data.actor || null,
        forceRelink: data.forceRelink || data.relinkEmails,
      });
      const status =
        merged?.skipped === "needs_admin_t5" ? 400 : 200;
      res.status(status).json({
        ok: !merged?.skipped || merged.skipped === "already_merged",
        build_id: CREATE_LEAD_BUILD_ID,
        mode: "merge_leads",
        merge: merged,
      });
      return;
    }

    const callTranscriptObject = String(
      body.objectMetadata?.nameSingular ||
        body.objectName ||
        body.data?.objectMetadata?.nameSingular ||
        "",
    ).toLowerCase();
    const isCallTranscriptWebhook =
      req.method === "POST" &&
      (eventName.toLowerCase().includes("calltranscript") ||
        callTranscriptObject === "calltranscript");
    if (isCallTranscriptWebhook) {
      const callTranscriptWebhook = await processCallTranscriptWebhook(body);
      res.status(200).json({
        ok: true,
        build_id: CREATE_LEAD_BUILD_ID,
        mode: "call_transcript_webhook",
        call_transcript: callTranscriptWebhook,
      });
      return;
    }

    if (
      req.method === "POST" &&
      (body.action === "enqueue_call_transcript" ||
        body.job_type === "crm:call_transcript_ingest_enqueue")
    ) {
      const enqueue = await enqueueCallTranscriptTask(
        body.data || body,
        body.environment,
      );
      res.status(200).json({
        ok: true,
        build_id: CREATE_LEAD_BUILD_ID,
        mode: "call_transcript_enqueue",
        enqueue,
      });
      return;
    }

    const updatePerson = await runUpdatePersonWorker();
    const createLead = await runCreateLeadWorker();
    const advanceContacted = await runAdvanceNewToContactedWorker();
    const callTranscript = await runCallTranscriptIngestWorker();
    res.status(200).json({
      ok: true,
      build_id: CREATE_LEAD_BUILD_ID,
      update_person: updatePerson,
      create_lead: createLead,
      advance_new_to_contacted: advanceContacted,
      call_transcript_ingest: callTranscript,
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
