/**
 * ssotPaths.js — kanoniczne nazwy ścieżek/adapters (Node + dokumentacja LLM).
 * Stape tagi: skopiuj wartości do const na górze pliku tagu (brak require w sGTM).
 *
 * SSOT: owocni-crm/ARCHITECTURE.md, EVENT_CONTRACT.md
 */

const ADAPTERS = {
  INBOUND_TWENTY_WEBHOOK: 'inbound:twenty_webhook',
  CRM_TWENTY_CREATE_LEAD: 'crm:twenty_create_lead',
  CRM_TWENTY_UPDATE_PERSON: 'crm:twenty_update_person',
};

const HTTP_PATHS = {
  INBOUND_TWENTY_WEBHOOK: '/inbound/twenty_webhook',
};

const STAPE_COLLECTIONS = {
  TASK_QUEUE: 'task_queue',
  IDENTITY_MAP: 'identity_map',
  TWENTY_STATE_PREFIX: 'twenty:opp:', // + opportunityId → last_stage / last_campaignRejected
  PENDING_WRITE_PREFIX: 'pending_write:twenty:', // + opportunityId, TTL w preflight
};

const CANONICAL_EVENT_NAMES = [
  'generate_lead',
  'qualify_lead',
  'purchase',
  'rejected_lead',
  'consent_update',
  'oid_init',
];

const LEGACY_EVENT_ALIASES = {
  lead_won: 'purchase',
  closed_won: 'purchase',
  lead_rejected: 'rejected_lead',
};

const RUNTIME_ENV = {
  PROD: 'prod',
  SANDBOX: 'sandbox',
};

module.exports = {
  ADAPTERS,
  HTTP_PATHS,
  STAPE_COLLECTIONS,
  CANONICAL_EVENT_NAMES,
  LEGACY_EVENT_ALIASES,
  RUNTIME_ENV,
};
