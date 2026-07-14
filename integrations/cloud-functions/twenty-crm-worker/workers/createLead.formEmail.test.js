"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeFormMessageText,
  shouldSeedFormInquiryEmail,
} = require("./createLead");

describe("form inquiry email thread", () => {
  it("normalizes HTML form message for email body", () => {
    const text = normalizeFormMessageText({
      biz_message: "Chcę stronę<br/>dla firmy",
    });
    assert.match(text, /Chcę stronę/);
    assert.match(text, /dla firmy/);
  });

  it("skips synthetic email for TWENTY_EMAIL (real IMAP thread)", () => {
    assert.equal(
      shouldSeedFormInquiryEmail({
        inbound_channel: "leads_at",
        src_action_source: "leads_at_email_sync",
      }),
      false,
    );
  });

  it("seeds email thread for Sortownia form lead", () => {
    assert.equal(
      shouldSeedFormInquiryEmail({
        ctx_kanban_id: "k1",
        biz_email: "a@b.pl",
      }),
      true,
    );
  });
});
