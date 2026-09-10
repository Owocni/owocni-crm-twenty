"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  META_INSTA_FORM_CAPI_FLAG,
  isSandboxTask,
  shouldSkipProdPlatformApis,
  isSandboxInstaFormMetaCapiEvent,
  selectMetaCapiTasks,
  partitionTasksByEnvironment,
} = require("./envGuard");

const sandboxSqlInsta = {
  environment: "sandbox",
  event_name: "qualify_lead",
  meta_leadgen_id: "3191234824398181",
  owner: "platform:meta_ads",
};

const sandboxWebsiteSql = {
  environment: "sandbox",
  event_name: "qualify_lead",
  biz_email: "a@b.pl",
  owner: "platform:meta_ads",
};

const sandboxInstaGenerate = {
  environment: "sandbox",
  event_name: "generate_lead",
  lead_id: "1",
};

const prodSqlInsta = {
  environment: "prod",
  event_name: "qualify_lead",
  metaLeadgenId: "abc",
};

describe("sandbox skip stays the default", () => {
  it("sandbox tasks skip prod APIs", () => {
    assert.equal(isSandboxTask(sandboxSqlInsta), true);
    assert.equal(shouldSkipProdPlatformApis(sandboxSqlInsta), true);
  });

  it("prod Instant Form is not a sandbox exception candidate", () => {
    assert.equal(
      isSandboxInstaFormMetaCapiEvent(prodSqlInsta, {
        [META_INSTA_FORM_CAPI_FLAG]: "true",
      }),
      false,
    );
  });
});

describe("META_INSTA_FORM_CAPI_FROM_SANDBOX", () => {
  it("default OFF — Instant Form SQL stays blocked", () => {
    assert.equal(
      isSandboxInstaFormMetaCapiEvent(sandboxSqlInsta, {}),
      false,
    );
    const { tasks, sandboxInstaFormAllowed } = selectMetaCapiTasks(
      [],
      [{ data: sandboxSqlInsta }],
      {},
    );
    assert.equal(sandboxInstaFormAllowed, 0);
    assert.equal(tasks.length, 0);
  });

  it("ON — Instant Form SQL/WON/rejected pass; website and generate_lead do not", () => {
    const env = { [META_INSTA_FORM_CAPI_FLAG]: "true" };
    assert.equal(isSandboxInstaFormMetaCapiEvent(sandboxSqlInsta, env), true);
    assert.equal(
      isSandboxInstaFormMetaCapiEvent(
        { ...sandboxSqlInsta, event_name: "purchase" },
        env,
      ),
      true,
    );
    assert.equal(
      isSandboxInstaFormMetaCapiEvent(
        { ...sandboxSqlInsta, event_name: "rejected_lead" },
        env,
      ),
      true,
    );
    assert.equal(isSandboxInstaFormMetaCapiEvent(sandboxWebsiteSql, env), false);
    assert.equal(
      isSandboxInstaFormMetaCapiEvent(sandboxInstaGenerate, env),
      false,
    );
  });

  it("ON — selectMetaCapiTasks dopina tylko Insta Form z sandboxa, prod bez zmian", () => {
    const env = { [META_INSTA_FORM_CAPI_FLAG]: "1" };
    const prod = [{ data: prodSqlInsta }];
    const sandbox = [
      { data: sandboxSqlInsta },
      { data: sandboxWebsiteSql },
      { data: sandboxInstaGenerate },
    ];
    const { prod: p, sandbox: s } = partitionTasksByEnvironment(
      prod.concat(sandbox),
    );
    const { tasks, sandboxInstaFormAllowed } = selectMetaCapiTasks(p, s, env);
    assert.equal(sandboxInstaFormAllowed, 1);
    assert.equal(tasks.length, 2);
    assert.equal(tasks[0].data, prodSqlInsta);
    assert.equal(tasks[1].data, sandboxSqlInsta);
  });

  it("without lead_id does not pass even when FACEBOOK-tagged", () => {
    const env = { [META_INSTA_FORM_CAPI_FLAG]: "true" };
    assert.equal(
      isSandboxInstaFormMetaCapiEvent(
        {
          environment: "sandbox",
          event_name: "qualify_lead",
          src_action_source: "meta_instant_form",
        },
        env,
      ),
      false,
    );
  });
});
