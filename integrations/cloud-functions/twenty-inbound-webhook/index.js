"use strict";

const functions = require("@google-cloud/functions-framework");
const { INBOUND_BUILD_ID, getRuntimeEnvironment } = require("./shared/config");
const { processTwentyWebhook } = require("./handlers/processWebhook");

function headerValue(req, ...names) {
  for (const name of names) {
    const v = req.get(name);
    if (v) return v;
  }
  return null;
}

functions.http("processTwentyInboundWebhook", async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  console.log("=== twenty-inbound-webhook START ===", INBOUND_BUILD_ID);

  let webhookBody = req.body;
  if (typeof webhookBody === "string") {
    try {
      webhookBody = JSON.parse(webhookBody);
    } catch {
      res.status(400).json({
        ok: false,
        build_id: INBOUND_BUILD_ID,
        error: "Invalid JSON body",
      });
      return;
    }
  }

  if (!webhookBody || typeof webhookBody !== "object") {
    console.log("INBOUND_TWENTY: brak raw body");
    res.status(400).json({
      ok: false,
      build_id: INBOUND_BUILD_ID,
      error: "Missing webhook body",
    });
    return;
  }

  const sig = headerValue(
    req,
    "twenty-webhook-signature",
    "twenty_webhook_signature",
    "x-twenty-webhook-signature",
  );
  const ts = headerValue(
    req,
    "twenty-webhook-timestamp",
    "twenty_webhook_timestamp",
    "x-twenty-webhook-timestamp",
  );

  if (sig && ts) {
    console.log(
      "INBOUND_TWENTY: HMAC headers present — full verify w kolejnym kroku",
    );
  } else {
    console.log(
      "INBOUND_TWENTY: SKIP_HMAC_NO_HEADERS (curl / brak nagłówków Twenty)",
    );
  }

  const runtimeEnvironment = getRuntimeEnvironment(
    headerValue(req, "x-owocni-runtime", "X-Owocni-Runtime"),
  );

  try {
    const result = await processTwentyWebhook(webhookBody, {
      runtimeEnvironment,
      webhookSignature: sig,
      webhookTimestamp: ts,
    });
    res.status(200).json({
      ok: true,
      build_id: INBOUND_BUILD_ID,
      result,
    });
  } catch (err) {
    console.error("twenty-inbound-webhook ERROR", err);
    res.status(500).json({
      ok: false,
      build_id: INBOUND_BUILD_ID,
      error: err.message,
    });
  }
});
