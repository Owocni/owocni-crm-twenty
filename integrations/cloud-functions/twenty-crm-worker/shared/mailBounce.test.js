"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  isBounceSender,
  isBounceMessage,
  extractBouncedRecipients,
  classifyBounceReason,
  bounceFollowUpLabel,
} = require("./mailBounce");

const THECAMELS = `This message was created automatically by mail delivery software.

A message that you sent could not be delivered to one or more of its
recipients. This is a permanent error. The following address(es) failed:

  tomasz.chojnacki@rezideo.pl
    retry timeout exceeded`;

const ONET = `This is the mail system at host mx.frm.poczta.onet.pl.

I'm sorry to have to inform you that your message could not
be delivered to one or more recipients. It's attached below.

                   The mail system

<aleksandra.tkocz@op.pl>: host mx.poczta.onet.pl[213.180.147.146] said: 550
    5.1.1 <aleksandra.tkocz@op.pl>: Recipient address rejected: User unknown
    (in reply to RCPT TO command)`;

const OVH_QUOTA = `This is the mail system at host out33.mail.ovh.net.

I'm sorry to have to inform you that your message could not
be delivered to one or more recipients. It's attached below.

<kontakt@balticboatbroker.com>: host
    filerz.276.mgra1.mail.ovh.net[91.121.56.175] said: 550 sorry, user over
    quota [mx1] (#5.1.1) (in reply to RCPT TO command)`;

describe("isBounceSender", () => {
  it("accepts mailer-daemon and Mail Delivery System", () => {
    assert.equal(
      isBounceSender("mailer-daemon@d28.thecamels.org", "Mail Delivery System"),
      true,
    );
  });

  it("rejects a human name on postmaster (spam)", () => {
    assert.equal(
      isBounceSender("postmaster@intro.lucasleao.net", "Hanna Lee"),
      false,
    );
  });
});

describe("isBounceMessage", () => {
  it("accepts a classic DSN from mailer-daemon", () => {
    assert.equal(
      isBounceMessage({
        subject: "Mail delivery failed: returning message to sender",
        text: THECAMELS,
        fromHandle: "mailer-daemon@d28.thecamels.org",
        fromDisplayName: "Mail Delivery System",
      }),
      true,
    );
  });

  it("rejects phishing that only says undelivered in the subject", () => {
    assert.equal(
      isBounceMessage({
        subject: "Confirm undelivered mail status owocni.pl",
        text: "Click here to review your mail settings https://oilforosh.com/",
        fromHandle: "notify@oilforosh.com",
        fromDisplayName: "Postmaster",
      }),
      false,
    );
  });

  it("rejects a real client reply", () => {
    assert.equal(
      isBounceMessage({
        subject: "Re: Owocne logo",
        text: "Dziękuję za ofertę, oddzwonię jutro.",
        fromHandle: "klient@firma.pl",
        fromDisplayName: "Jan",
      }),
      false,
    );
  });
});

describe("extractBouncedRecipients", () => {
  it("reads the failed address after address(es) failed", () => {
    assert.deepEqual(extractBouncedRecipients(THECAMELS), [
      "tomasz.chojnacki@rezideo.pl",
    ]);
  });

  it("reads <email>: host … said", () => {
    assert.deepEqual(extractBouncedRecipients(ONET), [
      "aleksandra.tkocz@op.pl",
    ]);
  });

  it("ignores owocni.pl and mailer-daemon", () => {
    const text = `${ONET}\nFrom: gosia@owocni.pl\nmailer-daemon@mx.example.net`;
    assert.deepEqual(extractBouncedRecipients(text), [
      "aleksandra.tkocz@op.pl",
    ]);
  });
});

describe("classifyBounceReason", () => {
  it("marks user-unknown as invalid", () => {
    assert.equal(classifyBounceReason(ONET), "invalid");
    assert.equal(bounceFollowUpLabel("invalid"), "Zwrotka · niepoprawny adres");
  });

  it("marks Unrouteable address as invalid", () => {
    assert.equal(
      classifyBounceReason(
        "The following address(es) failed:\n  niepoprawnyadres@wymyslonyadresss.pl\n    Unrouteable address",
      ),
      "invalid",
    );
  });

  it("marks quota / timeout as undelivered, not a client reply", () => {
    assert.equal(classifyBounceReason(THECAMELS), "undelivered");
    assert.equal(classifyBounceReason(OVH_QUOTA), "undelivered");
  });
});
