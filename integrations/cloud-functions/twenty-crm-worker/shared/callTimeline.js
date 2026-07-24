"use strict";

const {
  putTwentyStateDocument,
  readTwentyStateDocument,
} = require("./stapeStore");
const {
  twentyRequest,
  extractCreatedId,
} = require("./twentyRest");

const STATE_PREFIX = "call_timeline_";
const CALL_TRANSCRIPT_OBJECT_METADATA_ID =
  process.env.CALL_TRANSCRIPT_OBJECT_METADATA_ID ||
  "99378ad6-dc68-4a2c-a89c-93f17f86d9e5";

function workspaceBaseUrl() {
  return (
    process.env.TWENTY_WORKSPACE_URL ||
    "https://zany-maroon-panther.twenty.com"
  ).replace(/\/$/, "");
}

function formatWarsaw(iso) {
  const ms = Date.parse(iso || "");
  if (!Number.isFinite(ms)) return iso || "";
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      timeZone: "Europe/Warsaw",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString();
  }
}

function directionLabel(direction) {
  return String(direction || "").toUpperCase() === "INBOUND"
    ? "przychodząca"
    : "wychodząca";
}

function transcriptDeepLink(transcriptId) {
  return `${workspaceBaseUrl()}/object/callTranscript/${transcriptId}`;
}

function buildNoteMarkdown(transcript) {
  const when = formatWarsaw(transcript.startedAt || transcript.createdAt);
  const dir = directionLabel(transcript.direction);
  const phone = transcript.clientPhone || "?";
  const our = transcript.ourPhone || "?";
  const recordingUrl =
    transcript.recording?.primaryLinkUrl ||
    transcript.recordingWebUrl ||
    "";
  const summaryRaw =
    transcript.summary?.markdown ||
    transcript.summary ||
    transcript.transcript?.markdown ||
    "";
  const summary = String(summaryRaw).trim().slice(0, 800);
  const link = transcriptDeepLink(transcript.id);

  const lines = [
    `**Rozmowa telefoniczna** (${dir}) · ${when}`,
    "",
    `Klient: ${phone} · My: ${our}`,
    "",
    `[Otwórz transkrypt w Twenty](${link})`,
  ];
  if (recordingUrl) {
    lines.push("", `[Nagranie Play](${recordingUrl})`);
  }
  if (summary) {
    lines.push("", "**Skrót / fragment:**", summary);
  }
  return lines.join("\n");
}

function buildNoteTitle(transcript) {
  const when = formatWarsaw(transcript.startedAt || transcript.createdAt);
  const phone = transcript.clientPhone || "";
  return `Rozmowa telefoniczna · ${when}${phone ? ` · ${phone}` : ""}`;
}

async function createRecord(collection, body) {
  const res = await twentyRequest("POST", `/${collection}`, body);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(
      `create ${collection} HTTP ${res.statusCode} ${res.rawBody?.slice?.(0, 400)}`,
    );
  }
  return extractCreatedId(collection, res.body);
}

/**
 * Note + linked timeline entry on Opportunity (and Person) after a matched call.
 * Idempotent via Stape twenty_state/call_timeline_{transcriptId}.
 */
async function postCallTimelineOnLead({
  transcript,
  opportunityId,
  personId,
}) {
  if (!transcript?.id || !opportunityId) {
    return { skipped: "missing_ids" };
  }

  const stateKey = STATE_PREFIX + transcript.id;
  const existing = await readTwentyStateDocument(stateKey);
  if (existing?.posted === true) {
    return {
      skipped: "already_posted",
      noteId: existing.note_id || null,
      timelineActivityId: existing.timeline_activity_id || null,
    };
  }

  const title = buildNoteTitle(transcript);
  const markdown = buildNoteMarkdown(transcript);
  const happensAt =
    transcript.startedAt || transcript.createdAt || new Date().toISOString();

  const noteId = await createRecord("notes", {
    title,
    bodyV2: { markdown },
  });
  if (!noteId) throw new Error("POST notes — brak id");

  await createRecord("noteTargets", {
    noteId,
    opportunityId,
  });
  if (personId) {
    await createRecord("noteTargets", {
      noteId,
      personId,
    }).catch(() => null);
  }

  const timelineActivityId = await createRecord("timelineActivities", {
    name: "linked-callTranscript.created",
    happensAt,
    targetOpportunityId: opportunityId,
    linkedRecordId: transcript.id,
    linkedObjectMetadataId: CALL_TRANSCRIPT_OBJECT_METADATA_ID,
    linkedRecordCachedName:
      transcript.title || transcript.name || title,
  });

  try {
    await putTwentyStateDocument(stateKey, {
      posted: true,
      transcript_id: transcript.id,
      opportunity_id: opportunityId,
      person_id: personId || null,
      note_id: noteId,
      timeline_activity_id: timelineActivityId || null,
      updated_at: Date.now(),
    });
  } catch (err) {
    console.warn(
      "call timeline Stape state skipped:",
      String(err?.message || err),
    );
  }

  return { noteId, timelineActivityId, posted: true };
}

module.exports = {
  postCallTimelineOnLead,
  transcriptDeepLink,
  buildNoteTitle,
  CALL_TRANSCRIPT_OBJECT_METADATA_ID,
};
