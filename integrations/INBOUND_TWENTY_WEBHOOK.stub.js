/**
 * INBOUND_TWENTY_WEBHOOK.stub.js
 * Szkielet adaptera Stape dla inbound:twenty_webhook.
 *
 * Cel: odwzorować logikę EVENT_CONTRACT §5.4–5.6:
 * - verify HMAC
 * - filter unsupported object
 * - cold-start baseline
 * - transition detection (last_stage, last_campaignRejected)
 * - pending-write loop prevention
 * - mapowanie do event_name: generate_lead / qualify_lead / purchase / rejected_lead
 *
 * UWAGA:
 * - Ten plik to STUB. Nie deployuj 1:1 bez podpięcia API Stape Store/Twenty.
 * - Sekrety i klucze tylko przez env (nigdy w repo).
 */

const REASON = {
  SKIP_DUPLICATE_DELIVERY: 'SKIP_DUPLICATE_DELIVERY',
  SKIP_ECHO_OWN_WRITE: 'SKIP_ECHO_OWN_WRITE',
  SKIP_COLD_START_BASELINE: 'SKIP_COLD_START_BASELINE',
  SKIP_NO_RELEVANT_TRANSITION: 'SKIP_NO_RELEVANT_TRANSITION',
  SKIP_DUPLICATE_BUSINESS_EVENT: 'SKIP_DUPLICATE_BUSINESS_EVENT',
  SKIP_UNSUPPORTED_OBJECT: 'SKIP_UNSUPPORTED_OBJECT',
  EMITTED: 'EMITTED',
};

function normalizeEventName(name) {
  if (name === 'lead_won' || name === 'closed_won') return 'purchase';
  if (name === 'lead_rejected') return 'rejected_lead';
  return name;
}

function verifyHmacOrThrow(_rawBody, _headers, _secret) {
  // TODO: uzupełnij zgodnie z ops/OPS_NOTES.md (nagłówki + signed-string).
  return true;
}

function parseTwentyPayload(payload) {
  // TODO: dopasuj po preflight (runbooks/PREFLIGHT_TWENTY_WEBHOOK.md)
  const objectType = payload?.data?.object?.__typename || payload?.object || '';
  const opportunityId = payload?.data?.id || payload?.id || '';
  const stage = payload?.data?.stage || payload?.record?.stage || null;
  const campaignRejected = payload?.data?.campaignRejected ?? payload?.record?.campaignRejected ?? null;
  const personIdOid = payload?.data?.person?.idOid ?? payload?.record?.person?.idOid ?? null;
  const eventNamePlatform = payload?.event || '';

  return { objectType, opportunityId, stage, campaignRejected, personIdOid, eventNamePlatform };
}

async function getStoreState(_opportunityId) {
  // TODO: Stape Store read: last_stage + last_campaignRejected
  return { last_stage: null, last_campaignRejected: null };
}

async function saveStoreState(_opportunityId, _stage, _campaignRejected) {
  // TODO: Stape Store write baseline/nowy stan
}

async function isPendingWriteEcho(_opportunityId) {
  // TODO: odczyt pending_write:{opportunityId}
  return false;
}

function detectBusinessEvent({ stage, campaignRejected, personIdOid }, prev) {
  if (!personIdOid) return { emit: 'generate_lead' }; // manual create / update
  if (prev.last_stage == null && prev.last_campaignRejected == null) {
    return { skip: REASON.SKIP_COLD_START_BASELINE };
  }

  if (prev.last_stage !== stage && stage === 'QUALIFIED') return { emit: 'qualify_lead' };
  if (prev.last_stage !== stage && stage === 'WON') return { emit: 'purchase' };

  if (prev.last_campaignRejected === false && campaignRejected === true) return { emit: 'rejected_lead' };
  if (prev.last_campaignRejected === true && campaignRejected === true) {
    return { skip: REASON.SKIP_DUPLICATE_BUSINESS_EVENT };
  }

  return { skip: REASON.SKIP_NO_RELEVANT_TRANSITION };
}

async function emitRoutingEvent(_eventName, _context) {
  // TODO: environment=sandbox -> safe sink; prod -> routing platformowy
}

async function inboundTwentyWebhookHandler(req, res) {
  try {
    verifyHmacOrThrow(req.rawBody, req.headers, process.env.TWENTY_WEBHOOK_SECRET);

    const parsed = parseTwentyPayload(req.body || {});
    const allowed = ['Opportunity', 'Person'];
    if (!allowed.includes(parsed.objectType)) {
      return res.status(200).json({ ok: true, reason: REASON.SKIP_UNSUPPORTED_OBJECT });
    }

    if (!parsed.opportunityId) {
      return res.status(400).json({ ok: false, error: 'Missing opportunityId' });
    }

    if (await isPendingWriteEcho(parsed.opportunityId)) {
      return res.status(200).json({ ok: true, reason: REASON.SKIP_ECHO_OWN_WRITE });
    }

    const prev = await getStoreState(parsed.opportunityId);
    const decision = detectBusinessEvent(parsed, prev);
    await saveStoreState(parsed.opportunityId, parsed.stage, parsed.campaignRejected);

    if (decision.skip) {
      return res.status(200).json({ ok: true, reason: decision.skip });
    }

    const eventName = normalizeEventName(decision.emit);
    await emitRoutingEvent(eventName, {
      source: 'inbound:twenty_webhook',
      opportunityId: parsed.opportunityId,
      stage: parsed.stage,
      campaignRejected: parsed.campaignRejected,
      personIdOid: parsed.personIdOid,
      eventNamePlatform: parsed.eventNamePlatform,
    });

    return res.status(200).json({ ok: true, reason: REASON.EMITTED, event_name: eventName });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}

module.exports = {
  inboundTwentyWebhookHandler,
  detectBusinessEvent,
  normalizeEventName,
  REASON,
};
