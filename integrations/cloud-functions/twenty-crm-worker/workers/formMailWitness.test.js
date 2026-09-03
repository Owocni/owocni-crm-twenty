"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseZapytanieMail,
  isFormZapytanieSubject,
  inferProduct,
} = require("./formMailWitness");

const KONTAKT = `Wiadomość: Hey! Do you have any use for a freelance writer?

Imię: Hannah Melotto

Mail: h.melotto@melottogroup.com

Telefon: 2158218810

Url: https://www.owocni.pl/kontakt`;

const CENNIK = `Zapytanie dla logo

Firma:

-

Imię: Adam

Mail: adam@theeverestagency.com

Telefon: 667138358

Zapytanie ze strony: owocni.pl/cennik`;

const STRONY = `Zapytanie dla strony

Adres strony:

Inharbor.pl [Inharbor.pl]

Imię: Marcin

Mail: Marcin.kraczek@inharbor.pl

Telefon: 780077233

Zapytanie ze strony: strony.owocni.pl/?utm_source=google`;

const COPY = `Zapytanie dla nazwa

Imię: Ewelina

Mail: epawlowska5@gmail.com

Telefon: undefined

Zapytanie ze strony: copywriting.pl/kontakt`;

describe("form mail witness parser", () => {
  it("parses /kontakt PHP mail", () => {
    const p = parseZapytanieMail(
      "Zapytanie z strony: https://www.owocni.pl/kontakt",
      KONTAKT,
    );
    assert.equal(p.email, "h.melotto@melottogroup.com");
    assert.equal(p.name, "Hannah Melotto");
    assert.equal(p.phone, "2158218810");
    assert.match(p.pageUrl, /owocni\.pl\/kontakt/);
  });

  it("parses cennik logo form", () => {
    const p = parseZapytanieMail(
      "Zapytanie: owocni.pl/cennik [Czas: 00:01:51]",
      CENNIK,
    );
    assert.equal(p.email, "adam@theeverestagency.com");
    assert.equal(p.product, "logo");
    assert.match(p.pageUrl, /cennik/);
  });

  it("parses strony.owocni.pl form", () => {
    const p = parseZapytanieMail(
      "Zapytanie: strony.owocni.pl/?utm_source=google [Czas: 00:03:53]",
      STRONY,
    );
    assert.equal(p.email, "marcin.kraczek@inharbor.pl");
    assert.equal(p.product, "strony");
  });

  it("parses copywriting.pl naming form", () => {
    const p = parseZapytanieMail(
      "Zapytanie: copywriting.pl/kontakt [Czas: 00:27:22]",
      COPY,
    );
    assert.equal(p.email, "epawlowska5@gmail.com");
    assert.equal(p.product, "nazwa");
  });

  it("rejects replies and empty subjects", () => {
    assert.equal(isFormZapytanieSubject("Re: Zapytanie ofertowe"), false);
    assert.equal(isFormZapytanieSubject(""), false);
    assert.equal(
      isFormZapytanieSubject("Zapytanie z strony: https://www.owocni.pl/kontakt"),
      true,
    );
  });

  it("infers logo from logofirmowe URL", () => {
    assert.equal(
      inferProduct(
        "Zapytanie: logofirmowe.pl/projektowanie-logo-lublin",
        "",
        "logofirmowe.pl/projektowanie-logo-lublin",
      ),
      "logo",
    );
  });
});
