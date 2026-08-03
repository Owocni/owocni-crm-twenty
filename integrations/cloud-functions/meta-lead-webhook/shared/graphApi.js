"use strict";

async function fetchLeadById(leadgenId, pageAccessToken, graphApiVersion) {
  const id = String(leadgenId || "").trim();
  if (!id) throw new Error("missing leadgenId");
  const fields = "id,created_time,ad_id,form_id,field_data";
  const url =
    `https://graph.facebook.com/${graphApiVersion}/${encodeURIComponent(id)}` +
    `?fields=${encodeURIComponent(fields)}` +
    `&access_token=${encodeURIComponent(pageAccessToken)}`;
  const res = await fetch(url);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Graph lead ${res.status}: ${text.slice(0, 500)}`);
  }
  return body;
}

async function fetchFormName(formId, pageAccessToken, graphApiVersion) {
  const id = String(formId || "").trim();
  if (!id) return "";
  const url =
    `https://graph.facebook.com/${graphApiVersion}/${encodeURIComponent(id)}` +
    `?fields=name` +
    `&access_token=${encodeURIComponent(pageAccessToken)}`;
  const res = await fetch(url);
  if (!res.ok) return "";
  const body = await res.json();
  return String(body.name || "").trim();
}

module.exports = { fetchLeadById, fetchFormName };
