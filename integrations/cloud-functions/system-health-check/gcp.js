"use strict";

const METADATA = "http://metadata.google.internal/computeMetadata/v1";

async function getAccessToken() {
  if (process.env.HEALTH_GCP_ACCESS_TOKEN) {
    return process.env.HEALTH_GCP_ACCESS_TOKEN;
  }
  const res = await fetch(
    `${METADATA}/instance/service-accounts/default/token`,
    { headers: { "Metadata-Flavor": "Google" } },
  );
  if (!res.ok) {
    throw new Error(`metadata token HTTP ${res.status}`);
  }
  const body = await res.json();
  return body.access_token;
}

async function gcpFetch(url, { method = "GET", body, token, contentType } = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  if (contentType) headers["Content-Type"] = contentType;
  const res = await fetch(url, {
    method,
    headers,
    body,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

async function listSchedulerJobs(project, location) {
  const token = await getAccessToken();
  const url =
    `https://cloudscheduler.googleapis.com/v1/projects/${project}` +
    `/locations/${location}/jobs?pageSize=100`;
  const res = await gcpFetch(url, { token });
  if (!res.ok) {
    throw new Error(`scheduler list HTTP ${res.status}: ${res.text.slice(0, 200)}`);
  }
  const parsed = JSON.parse(res.text || "{}");
  return parsed.jobs || [];
}

function gcsObjectUrl(bucket, objectPath, altMedia) {
  const encoded = encodeURIComponent(objectPath);
  const base = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encoded}`;
  return altMedia ? `${base}?alt=media` : base;
}

async function gcsReadJson(bucket, objectPath) {
  const token = await getAccessToken();
  const res = await gcpFetch(gcsObjectUrl(bucket, objectPath, true), { token });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`gcs read HTTP ${res.status}: ${res.text.slice(0, 200)}`);
  }
  return JSON.parse(res.text);
}

async function gcsWriteJson(bucket, objectPath, data) {
  const token = await getAccessToken();
  const url =
    `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o` +
    `?uploadType=media&name=${encodeURIComponent(objectPath)}`;
  const res = await gcpFetch(url, {
    method: "POST",
    token,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`gcs write HTTP ${res.status}: ${res.text.slice(0, 200)}`);
  }
}

module.exports = {
  getAccessToken,
  listSchedulerJobs,
  gcsReadJson,
  gcsWriteJson,
};
