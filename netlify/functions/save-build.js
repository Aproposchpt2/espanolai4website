'use strict';
// save-build.js -- uses direct REST fetch (no Supabase JS client, no WebSocket dependency)
// Persists the selected website build to the sites table before the customer reaches offer.html.

const MAX_HTML_LENGTH = 750000;
const MAX_JSON_LENGTH = 250000;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function json(statusCode, payload) {
  return { statusCode, headers, body: JSON.stringify(payload) };
}

function safeString(value, fallback) {
  if (value === null || value === undefined) return fallback || '';
  return String(value).trim();
}

function normalizeEmail(value) {
  return safeString(value).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safeJson(value, fallback) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback || {};
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_JSON_LENGTH) return fallback || {};
  return value;
}

function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  return {
    apikey: key,
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { success: false, error: 'Method not allowed' });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('save-build: Missing Supabase env vars');
    return json(500, { success: false, error: 'Build save is not configured' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { success: false, error: 'Invalid JSON body' }); }

  const email = normalizeEmail(body.email);
  const builtHtml = safeString(body.built_html);
  const siteData = safeJson(body.site_data, {});
  const businessName = safeString(
    body.business_name || siteData.businessName || siteData.business_name, 'Website Build'
  );
  const templateSelected = safeString(
    body.template_selected || siteData.template, 'COMMAND'
  ).toUpperCase();
  const colorChoice = safeString(
    body.color_choice || siteData.colorChoice, 'AUTO'
  ).toUpperCase();
  const userId   = safeString(body.user_id);
  const fullName = safeString(body.full_name || body.name);
  const phone    = safeString(body.phone);

  if (!isValidEmail(email)) return json(400, { success: false, error: 'Valid email is required' });
  if (!builtHtml)           return json(400, { success: false, error: 'Built HTML is required' });
  if (builtHtml.length > MAX_HTML_LENGTH) return json(413, { success: false, error: 'Built HTML is too large' });

  const now = new Date().toISOString();
  const siteRecord = {
    user_id:           userId || null,
    email,
    full_name:         fullName || null,
    phone:             phone || null,
    business_name:     businessName,
    site_name:         businessName,
    site_status:       'preview_selected',
    template_selected: templateSelected,
    color_choice:      colorChoice,
    built_html:        builtHtml,
    site_data:         siteData,
    source:            'builder',
    updated_at:        now,
  };

  const existingSiteId = safeString(
    body.site_id || siteData.site_id || body.build_id || siteData.build_id
  );

  if (existingSiteId) {
    const res = await fetch(
      url + '/rest/v1/sites?id=eq.' + encodeURIComponent(existingSiteId),
      { method: 'PATCH', headers: sbHeaders(), body: JSON.stringify(siteRecord) }
    );
    if (res.ok) {
      const rows = await res.json();
      const row = Array.isArray(rows) && rows.length ? rows[0] : null;
      if (row && row.id) {
        return json(200, { success: true, site_id: row.id, build_id: row.id, mode: 'updated' });
      }
    } else {
      console.error('save-build update error:', res.status, await res.text());
      return json(500, { success: false, error: 'Unable to update selected build' });
    }
  }

  const insertRes = await fetch(
    url + '/rest/v1/sites',
    {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify(Object.assign({}, siteRecord, { created_at: now }))
    }
  );

  if (!insertRes.ok) {
    console.error('save-build insert error:', insertRes.status, await insertRes.text());
    return json(500, { success: false, error: 'Unable to save selected build' });
  }

  const rows = await insertRes.json();
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  if (!row || !row.id) return json(500, { success: false, error: 'Build saved but no ID returned' });

  return json(200, { success: true, site_id: row.id, build_id: row.id, mode: 'created' });
};
