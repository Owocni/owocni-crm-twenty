"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveContinuityOwner,
  isAllowedOwner,
} = require("../shared/resolveContinuityOwner");
const { resolveOpportunityOwnerId } = require("./createLead");

const MARTA = "4704e0c0-8d77-4640-ad1e-1875294294df";
const GOSIA = "ccac533d-a34b-4cfc-a036-9e75ee3f8910";
const MACIEJ = "7fddba1d-e443-47d4-97b7-a3a829efd8c1";
const ROBERT = "23ac9976-0232-4097-b056-5dc391bf7c34";
const EWA = "b9e2b31e-0b4a-4936-9d2a-2e5b4a3e0b16";

const ALLOWED = new Set([MARTA, GOSIA, MACIEJ, ROBERT]);

describe("continuity — unit T1/T2/T3/T5", () => {
  let prevFlag;

  beforeEach(() => {
    prevFlag = process.env.CONTINUITY_ROUTING_ENABLED;
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.CONTINUITY_ROUTING_ENABLED;
    else process.env.CONTINUITY_ROUTING_ENABLED = prevFlag;
  });

  it("T1: disabled → resolveContinuityOwner returns null (fallback routing unchanged)", async () => {
    const fallback = resolveOpportunityOwnerId("LOGO", "oid-even", {});
    // "oid-even" char sum even → gosia in current hash
    assert.equal(typeof fallback, "string");

    const continuity = await resolveContinuityOwner({
      personId: "person-1",
      companyId: "company-1",
      enabled: false,
      allowedOwnerIds: ALLOWED,
      getCompanyById: async () => ({ accountOwnerId: MARTA }),
      findLatestSqlOpportunityByPersonId: async () => ({ ownerId: GOSIA }),
    });
    assert.equal(continuity, null);
  });

  it("T1b: FACEBOOK still maps to Robert when continuity off", () => {
    process.env.CONTINUITY_ROUTING_ENABLED = "false";
    const owner = resolveOpportunityOwnerId("LOGO", "x", {
      src_action_source: "meta_instant_form",
      lead_id: "123",
    });
    assert.equal(owner, ROBERT);
  });

  it("T2: Person with prior SQL owned by Marta → Marta", async () => {
    const continuity = await resolveContinuityOwner({
      personId: "person-marta",
      companyId: null,
      enabled: true,
      allowedOwnerIds: ALLOWED,
      getCompanyById: async () => {
        throw new Error("should not call getCompany without companyId");
      },
      findLatestSqlOpportunityByPersonId: async (pid) => {
        assert.equal(pid, "person-marta");
        return { ownerId: MARTA, bizSqlConfirmed: true };
      },
    });
    assert.equal(continuity, MARTA);
  });

  it("T3: Company.accountOwner=Gosia wins over Person SQL", async () => {
    const continuity = await resolveContinuityOwner({
      personId: "person-other",
      companyId: "company-gosia",
      enabled: true,
      allowedOwnerIds: ALLOWED,
      getCompanyById: async (cid) => {
        assert.equal(cid, "company-gosia");
        return { accountOwnerId: GOSIA };
      },
      findLatestSqlOpportunityByPersonId: async () => ({ ownerId: MARTA }),
    });
    assert.equal(continuity, GOSIA);
  });

  it("T5: lookup error → null (caller keeps fallback routing)", async () => {
    const continuity = await resolveContinuityOwner({
      personId: "person-err",
      companyId: "company-err",
      enabled: true,
      allowedOwnerIds: ALLOWED,
      getCompanyById: async () => {
        throw new Error("HTTP 500");
      },
      findLatestSqlOpportunityByPersonId: async () => ({ ownerId: MARTA }),
    });
    assert.equal(continuity, null);
  });

  it("Ewa is not an allowed continuity owner", () => {
    assert.equal(isAllowedOwner(EWA, ALLOWED), false);
    assert.equal(isAllowedOwner(MARTA, ALLOWED), true);
  });

  it("SQL owner Ewa is ignored → null", async () => {
    const continuity = await resolveContinuityOwner({
      personId: "person-ewa-sql",
      companyId: null,
      enabled: true,
      allowedOwnerIds: ALLOWED,
      getCompanyById: async () => null,
      findLatestSqlOpportunityByPersonId: async () => ({ ownerId: EWA }),
    });
    assert.equal(continuity, null);
  });
});
