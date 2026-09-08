"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { isFormInquiryTokenSpam } = require("./createLead");

describe("isFormInquiryTokenSpam", () => {
  it("cuts bot token-only /kontakt message (ikuzi)", () => {
    assert.equal(
      isFormInquiryTokenSpam({
        event_name: "generate_lead",
        biz_email: "be.caf.ikuzi.6.8@gmail.com",
        biz_name: "ySphJPOoaMhhcjZd",
        biz_message: "VxIvkhPmufoiYZhTVdds",
      }),
      true,
    );
  });

  it("cuts HTML-wrapped token", () => {
    assert.equal(
      isFormInquiryTokenSpam({
        biz_message: "<p>IqhvfeJKudBnEJKd</p>",
      }),
      true,
    );
  });

  it("keeps a real Polish sentence", () => {
    assert.equal(
      isFormInquiryTokenSpam({
        event_name: "generate_lead",
        biz_name: "Anna",
        biz_message: "Proszę o kontakt w sprawie strony",
      }),
      false,
    );
  });

  it("keeps concatenated FirstLast used as the whole message", () => {
    assert.equal(
      isFormInquiryTokenSpam({ biz_message: "MagdalenaNowak" }),
      false,
    );
  });

  it("keeps a 12-digit number (not a token)", () => {
    assert.equal(
      isFormInquiryTokenSpam({ biz_message: "123456789012" }),
      false,
    );
  });

  it("keeps empty / missing message", () => {
    assert.equal(isFormInquiryTokenSpam({ biz_message: "" }), false);
    assert.equal(isFormInquiryTokenSpam({}), false);
  });

  it("never cuts direct leads@ email even if body is a token", () => {
    assert.equal(
      isFormInquiryTokenSpam({
        inbound_channel: "leads_at",
        src_system: "TWENTY_EMAIL",
        biz_message: "VxIvkhPmufoiYZhTVdds",
      }),
      false,
    );
  });

  it("keeps structured cennik inquiry", () => {
    assert.equal(
      isFormInquiryTokenSpam({
        biz_message:
          "Zapytanie dla strony Adres strony: Pierwsza działalność",
      }),
      false,
    );
  });
});
