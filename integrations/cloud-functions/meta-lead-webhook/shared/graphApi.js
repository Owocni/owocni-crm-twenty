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

/**
 * Lista leadów formularza nowszych niż sinceMs (created_time Graph).
 * Graph zwraca od najnowszych — przerywamy gdy natrafimy na starsze.
 */
async function listFormLeadsSince(
  formId,
  pageAccessToken,
  graphApiVersion,
  sinceMs,
  maxLeads = 25,
) {
  const id = String(formId || "").trim();
  if (!id) throw new Error("missing formId");
  const fields = "id,created_time,ad_id,form_id,field_data";
  const out = [];
  let url =
    `https://graph.facebook.com/${graphApiVersion}/${encodeURIComponent(id)}/leads` +
    `?fields=${encodeURIComponent(fields)}` +
    `&limit=25` +
    `&access_token=${encodeURIComponent(pageAccessToken)}`;

  while (url && out.length < maxLeads) {
    const res = await fetch(url);
    const text = await res.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    if (!res.ok) {
      throw new Error(`Graph form leads ${res.status}: ${text.slice(0, 500)}`);
    }
    const batch = Array.isArray(body.data) ? body.data : [];
    let hitOlder = false;
    for (const lead of batch) {
      const created = Date.parse(String(lead.created_time || ""));
      if (Number.isFinite(created) && created < sinceMs) {
        hitOlder = true;
        break;
      }
      out.push(lead);
      if (out.length >= maxLeads) break;
    }
    if (hitOlder || out.length >= maxLeads) break;
    url = body.paging?.next || null;
  }
  return out;
}

module.exports = { fetchLeadById, fetchFormName, listFormLeadsSince };
