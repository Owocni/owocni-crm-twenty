"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveEmailContactKind,
  selectExternalClientParticipant,
  pickResolvedOpportunity,
} = require("./emailContactKind");

describe("resolveEmailContactKind", () => {
  it("client TO/FROM wins over a thread target", () => {
    assert.equal(
      resolveEmailContactKind({
        clientParticipant: { personId: "p1" },
        threadOpportunityId: "opp",
        direction: "OUTGOING",
      }),
      "CLIENT_OUT",
    );
    assert.equal(
      resolveEmailContactKind({
        clientParticipant: { personId: "p1" },
        threadOpportunityId: "opp",
        direction: "INCOMING",
      }),
      "CLIENT_IN",
    );
  });

  it("internal handoff without client participant uses the thread target", () => {
    assert.equal(
      resolveEmailContactKind({
        clientParticipant: null,
        threadOpportunityId: "opp",
        direction: "OUTGOING",
      }),
      "INTERNAL_OUT",
    );
    assert.equal(
      resolveEmailContactKind({
        clientParticipant: null,
        threadOpportunityId: "opp",
        direction: "INCOMING",
      }),
      "INTERNAL_IN",
    );
  });

  it("freelancer on [Wewnętrzne] is INTERNAL even without @owocni.pl", () => {
    assert.equal(
      resolveEmailContactKind({
        clientParticipant: { handle: "ania@gmail.com", personId: "p-free" },
        threadOpportunityId: "opp",
        direction: "OUTGOING",
        subject: "[Wewnętrzne] Re: Wycena",
      }),
      "INTERNAL_OUT",
    );
    assert.equal(
      resolveEmailContactKind({
        clientParticipant: { handle: "ania@gmail.com", personId: null },
        threadOpportunityId: "opp",
        direction: "INCOMING",
        subject: "Re: [Wewnętrzne] Re: Wycena",
      }),
      "INTERNAL_IN",
    );
  });

  it("unattached [Wewnętrzne] to a freelancer does not count as client contact", () => {
    assert.equal(
      resolveEmailContactKind({
        clientParticipant: { handle: "ania@gmail.com" },
        threadOpportunityId: null,
        direction: "OUTGOING",
        subject: "[Wewnętrzne] wątek leada",
      }),
      "SKIP",
    );
  });

  it("unattached internal mail does not touch a lead", () => {
    assert.equal(
      resolveEmailContactKind({
        clientParticipant: null,
        threadOpportunityId: null,
        direction: "INCOMING",
      }),
      "SKIP",
    );
  });

  it("external handle without personId is still a client", () => {
    assert.equal(
      resolveEmailContactKind({
        clientParticipant: { handle: "klient@wp.pl", personId: null },
        threadOpportunityId: null,
        direction: "OUTGOING",
      }),
      "CLIENT_OUT",
    );
  });
});

describe("selectExternalClientParticipant", () => {
  it("returns the first non-owocni handle even without personId", () => {
    const picked = selectExternalClientParticipant([
      { handle: "copywriting@owocni.pl", role: "FROM", personId: null },
      { handle: "projektwysocki@wp.pl", role: "TO", personId: null },
    ]);
    assert.equal(picked.handle, "projektwysocki@wp.pl");
  });

  it("skips empty and internal handles", () => {
    assert.equal(
      selectExternalClientParticipant([
        { handle: "", personId: "p1" },
        { handle: "marta@owocni.pl", personId: "p2" },
      ]),
      null,
    );
  });

  it("skips mailer-daemon so a bounce is not a client FROM", () => {
    assert.equal(
      selectExternalClientParticipant([
        {
          handle: "mailer-daemon@d28.thecamels.org",
          displayName: "Mail Delivery System",
          personId: "ghost",
        },
        { handle: "gosia@owocni.pl", personId: null },
      ]),
      null,
    );
  });
});

describe("pickResolvedOpportunity", () => {
  it("prefers linked person, then email person, then card email, then thread", () => {
    assert.equal(
      pickResolvedOpportunity({
        byLinkedPersonId: { id: "a" },
        byCardEmail: { id: "c" },
      }).id,
      "a",
    );
    assert.equal(
      pickResolvedOpportunity({
        byEmailPerson: { id: "b" },
        byCardEmail: { id: "c" },
        byThread: { id: "d" },
      }).id,
      "b",
    );
    assert.equal(
      pickResolvedOpportunity({
        byCardEmail: { id: "c" },
        byThread: { id: "d" },
      }).id,
      "c",
    );
    assert.equal(pickResolvedOpportunity({ byThread: { id: "d" } }).id, "d");
    assert.equal(pickResolvedOpportunity({}), null);
  });
});
