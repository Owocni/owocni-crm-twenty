"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseLeadgenEvents } = require("./parseLeadgen");

describe("parseLeadgenEvents", () => {
  it("extracts leadgen_id and ad ids from Page webhook", () => {
    const body = {
      object: "page",
      entry: [
        {
          id: "149525518409675",
          time: 1710000000,
          changes: [
            {
              field: "leadgen",
              value: {
                leadgen_id: "111",
                page_id: "149525518409675",
                form_id: "222",
                adgroup_id: "333",
                ad_id: "444",
                created_time: 1710000001,
              },
            },
          ],
        },
      ],
    };
    const events = parseLeadgenEvents(body);
    assert.equal(events.length, 1);
    assert.equal(events[0].leadgen_id, "111");
    assert.equal(events[0].ad_id, "444");
    assert.equal(events[0].adgroup_id, "333");
    assert.equal(events[0].form_id, "222");
  });

  it("ignores non-leadgen changes", () => {
    const body = {
      entry: [{ id: "1", changes: [{ field: "feed", value: {} }] }],
    };
    assert.deepEqual(parseLeadgenEvents(body), []);
  });
});
