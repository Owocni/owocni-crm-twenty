"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  isOwocniFormWitnessSubject,
  pickFormWitnessMessage,
} = require("./formWitness");

describe("isOwocniFormWitnessSubject", () => {
  it("accepts PHP / Make Owocni subjects", () => {
    assert.equal(
      isOwocniFormWitnessSubject("Zapytanie z formularza owocni.pl"),
      true,
    );
    assert.equal(
      isOwocniFormWitnessSubject(
        "Zapytanie z strony: https://www.owocni.pl/kontakt",
      ),
      true,
    );
    assert.equal(
      isOwocniFormWitnessSubject(
        "Zapytanie: copywriting.pl/kontakt [Czas: 00:37:35]",
      ),
      true,
    );
    assert.equal(
      isOwocniFormWitnessSubject(
        "Zapytanie: strony.owocni.pl/?utm_source=google [Czas: 00:10:32]",
      ),
      true,
    );
    assert.equal(
      isOwocniFormWitnessSubject(
        "Zapytanie: logofirmowe.pl/projektowanie-logo-lublin?gad_source=1",
      ),
      true,
    );
    assert.equal(
      isOwocniFormWitnessSubject("Zapytanie: owocni.pl/cennik [Czas: 00:01:51]"),
      true,
    );
  });

  it("rejects JuicyLogos and other Zapytanie* noise (incydent 2026-09-07)", () => {
    assert.equal(
      isOwocniFormWitnessSubject("Zapytanie ze strony kontakt."),
      false,
    );
    assert.equal(
      isOwocniFormWitnessSubject("Zapytanie ze strony kontakt"),
      false,
    );
    assert.equal(isOwocniFormWitnessSubject("Re: Zapytanie: owocni.pl"), false);
    assert.equal(isOwocniFormWitnessSubject("Zapytanie ofertowe"), false);
    assert.equal(isOwocniFormWitnessSubject("Zapytanie: juicylogos.com"), false);
    assert.equal(isOwocniFormWitnessSubject(""), false);
  });
});

describe("pickFormWitnessMessage", () => {
  it("skips JuicyLogos and OUTGOING, keeps next Owocni form mail", () => {
    const mail = pickFormWitnessMessage([
      {
        subject: "Zapytanie ze strony kontakt.",
        direction: "INCOMING",
        receivedAt: "2026-09-07T03:06:04.000Z",
      },
      {
        subject: "Zapytanie z formularza owocni.pl",
        direction: "OUTGOING",
        receivedAt: "2026-09-06T23:00:00.000Z",
      },
      {
        subject: "Zapytanie z formularza owocni.pl",
        direction: "INCOMING",
        receivedAt: "2026-09-06T22:54:28.472Z",
      },
    ]);
    assert.equal(mail.receivedAt, "2026-09-06T22:54:28.472Z");
  });

  it("returns null when only foreign Zapytanie mails exist", () => {
    assert.equal(
      pickFormWitnessMessage([
        { subject: "Zapytanie ze strony kontakt.", direction: "INCOMING" },
      ]),
      null,
    );
  });
});
