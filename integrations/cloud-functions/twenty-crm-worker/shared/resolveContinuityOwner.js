"use strict";

/**
 * Continuity owner lookup (RULE_CONTINUITY).
 * Pure orchestration — fetchers injected for unit tests.
 *
 * Priority:
 * 1. Company.accountOwnerId (if allowed)
 * 2. Latest Opportunity of Person with bizSqlConfirmed=true (if owner allowed)
 * 3. null → caller uses existing routing
 */

function extractOwnerId(record) {
  if (!record) return null;
  const direct = record.ownerId || record.accountOwnerId;
  if (direct) return String(direct).trim() || null;
  const nested = record.owner?.id || record.accountOwner?.id;
  return nested ? String(nested).trim() : null;
}

function isAllowedOwner(ownerId, allowedOwnerIds) {
  if (!ownerId) return false;
  if (!allowedOwnerIds || typeof allowedOwnerIds.has !== "function") {
    return false;
  }
  return allowedOwnerIds.has(ownerId);
}

/**
 * @param {object} opts
 * @param {string} opts.personId
 * @param {string|null|undefined} opts.companyId
 * @param {boolean} opts.enabled
 * @param {Set<string>} opts.allowedOwnerIds
 * @param {(id: string) => Promise<object|null>} opts.getCompanyById
 * @param {(personId: string) => Promise<object|null>} opts.findLatestSqlOpportunityByPersonId
 * @returns {Promise<string|null>}
 */
async function resolveContinuityOwner(opts) {
  const {
    personId,
    companyId,
    enabled,
    allowedOwnerIds,
    getCompanyById,
    findLatestSqlOpportunityByPersonId,
  } = opts || {};

  if (!enabled) return null;
  if (!personId) return null;

  try {
    if (companyId) {
      const company = await getCompanyById(companyId);
      const accountOwnerId = extractOwnerId(
        company
          ? {
              accountOwnerId: company.accountOwnerId,
              accountOwner: company.accountOwner,
            }
          : null,
      );
      if (isAllowedOwner(accountOwnerId, allowedOwnerIds)) {
        return accountOwnerId;
      }
    }

    const sqlOpp = await findLatestSqlOpportunityByPersonId(personId);
    const sqlOwnerId = extractOwnerId(sqlOpp);
    if (isAllowedOwner(sqlOwnerId, allowedOwnerIds)) {
      return sqlOwnerId;
    }

    return null;
  } catch (err) {
    console.warn(
      "resolveContinuityOwner failed — fallback to default routing:",
      err && err.message ? err.message : err,
    );
    return null;
  }
}

module.exports = {
  resolveContinuityOwner,
  extractOwnerId,
  isAllowedOwner,
};
