'use strict';
// save-build.js -- REST fetch, no Supabase JS client
// On every site selection:
//   1. Saves the HTML + metadata to Supabase sites table
//   2. Emails the HTML file as an attachment to the customer
//   3. Emails the HTML file as an attachment to the owner (ready for launch)

const MAX_HTML_LENGTH = 750000;
const MAX_JSON_LENGTH = 250000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function json(statusCode, payload) {
  return { statusCode, headers: CORS, body: JSON.stringify(payload) };
}

function safeStr(value, fallback) {
  if (value === null || value === undefined) return fallback || '';
  return String(value).trim();
}

function safeEmail(value) {
  return safeStr(value).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safeJson(value, fallback) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback || {};
  try {
    if (JSON.stringify(value).length > MAX_JSON_LENGTH) return fallback || {};
  } catch { return fallback || {}; }
  return value;
}

function esc(s) {
  return String(s || '').replace(/[&<>'"]/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c];
  });
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

async function sendEmail(to, subject, html, attachment) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn('save-build: RESEND_API_KEY not set, skipping email'); return; }
  const from = process.env.RESEND_FROM_EMAIL || 'AI4 Website Design <jmitchell@ai4websitedesign.com>';
  const payload = { from, to: [to], subject, html };
  if (attachment) payload.attachments = [attachment];
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) console.error('save-build email error:', res.status, await res.text());
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { success: false, error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return json(500, { success: false, error: 'Build save is not configured' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { success: false, error: 'Invalid JSON body' }); }

  const email        = safeEmail(body.email);
  const builtHtml    = safeStr(body.built_html);
  const siteData     = safeJson(body.site_data, {});
  const businessName = safeStr(body.business_name || siteData.businessName || siteData.business_name, 'Website Build');
  const fullName     = safeStr(body.full_name || body.name);
  const phone        = safeStr(body.phone);
  const userId       = safeStr(body.user_id);
  const template     = safeStr(body.template_selected || siteData.template, 'COMMAND').toUpperCase();
  const colorChoice  = safeStr(body.color_choice || siteData.colorChoice, 'AUTO').toUpperCase();
  const existingId   = safeStr(body.site_id || siteData.site_id || body.build_id || siteData.build_id);

  if (!isValidEmail(email)) return json(400, { success: false, error: 'Valid email is required' });
  if (!builtHtml)           return json(400, { success: false, error: 'Built HTML is required' });
  if (builtHtml.length > MAX_HTML_LENGTH) return json(413, { success: false, error: 'Built HTML too large' });

  const now = new Date().toISOString();
  const record = {
    user_id: userId || null, email, full_name: fullName || null, phone: phone || null,
    business_name: businessName, site_name: businessName,
    site_status: 'preview_selected', template_selected: template,
    color_choice: colorChoice, built_html: builtHtml,
    site_data: siteData, source: 'builder', updated_at: now
  };

  // ── 1. Save to Supabase ────────────────────────────────────────────────
  let siteId = existingId;

  if (existingId) {
    const upRes = await fetch(supabaseUrl + '/rest/v1/sites?id=eq.' + encodeURIComponent(existingId), {
      method: 'PATCH', headers: sbHeaders(), body: JSON.stringify(record)
    });
    if (!upRes.ok) {
      console.error('save-build update error:', upRes.status, await upRes.text());
      return json(500, { success: false, error: 'Unable to update selected build' });
    }
    const rows = await upRes.json();
    siteId = (Array.isArray(rows) && rows[0]) ? rows[0].id : existingId;
  } else {
    const insRes = await fetch(supabaseUrl + '/rest/v1/sites', {
      method: 'POST', headers: sbHeaders(),
      body: JSON.stringify(Object.assign({}, record, { created_at: now }))
    });
    if (!insRes.ok) {
      console.error('save-build insert error:', insRes.status, await insRes.text());
      return json(500, { success: false, error: 'Unable to save selected build' });
    }
    const rows = await insRes.json();
    if (!Array.isArray(rows) || !rows[0] || !rows[0].id) {
      return json(500, { success: false, error: 'Build saved but no ID returned' });
    }
    siteId = rows[0].id;
  }

  // ── 2. Prepare HTML attachment ─────────────────────────────────────────
  const firstName  = fullName ? fullName.split(' ')[0] : 'there';
  const fileSlug   = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const fileName   = fileSlug + '-website.html';
  const htmlBase64 = Buffer.from(builtHtml).toString('base64');
  const attachment = { filename: fileName, content: htmlBase64 };
  const ownerEmail = process.env.RESEND_TO_EMAIL || process.env.OWNER_EMAIL || 'jmitchell@ai4websitedesign.com';

  // ── 3. Email customer ──────────────────────────────────────────────────
  const customerSubject = 'Your ' + businessName + ' website is ready — here is your file';
  const customerHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>'
    + '<body style="margin:0;padding:0;background:#080c10;color:#f0f6fc;font-family:Arial,sans-serif;">'
    + '<div style="max-width:560px;margin:0 auto;padding:40px 24px;">'
    + '<div style="font-size:1.1rem;font-weight:900;color:#4F6EF7;margin-bottom:20px;">AI4 Website Design Studio</div>'
    + '<h2 style="color:#f0f6fc;margin:0 0 12px;">Hi ' + esc(firstName) + ' — your website file is attached!</h2>'
    + '<p style="color:#8b949e;line-height:1.7;margin:0 0 20px;">'
    + 'You selected <strong style="color:#f0f6fc;">' + esc(businessName) + '</strong> as your website. '
    + 'Your website file (<strong>' + esc(fileName) + '</strong>) is attached to this email.</p>'
    + '<p style="color:#8b949e;line-height:1.7;margin:0 0 20px;">'
    + 'When you are ready to launch, reply to this email or contact us — we have your file and can get you live quickly.</p>'
    + '<div style="background:rgba(79,110,247,.1);border:1px solid rgba(79,110,247,.25);border-radius:12px;padding:20px;margin-bottom:24px;">'
    + '<div style="font-size:.72rem;color:#8b949e;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px;">What\'s included</div>'
    + '<div style="color:#f0f6fc;font-size:.9rem;line-height:1.7;">'
    + '&#10003; Complete website HTML file, ready to deploy<br>'
    + '&#10003; Your business content and branding built in<br>'
    + '&#10003; Mobile-responsive design included</div></div>'
    + '<p style="color:#484f58;font-size:.75rem;line-height:1.6;margin:0;">'
    + 'AI4 Website Design Studio &middot; Apropos Group LLC &middot; ai4websitedesign.com</p>'
    + '</div></body></html>';

  await sendEmail(email, customerSubject, customerHtml, attachment).catch(function(e) {
    console.error('save-build customer email failed:', e.message);
  });

  // ── 4. Email owner ─────────────────────────────────────────────────────
  const ownerSubject = 'New Site Selection — ' + businessName;
  const ownerHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>'
    + '<body style="font-family:Arial,sans-serif;background:#080c10;color:#f0f6fc;margin:0;padding:24px;">'
    + '<div style="max-width:520px;margin:0 auto;background:#0f1419;border:1px solid rgba(79,110,247,.2);border-radius:12px;padding:24px;">'
    + '<div style="font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:#4F6EF7;margin-bottom:12px;">New Site Selection</div>'
    + '<h2 style="color:#f0f6fc;margin:0 0 16px;">' + esc(businessName) + '</h2>'
    + '<table style="width:100%;border-collapse:collapse;font-size:.88rem;">'
    + '<tr><td style="padding:7px 0;color:#8b949e;width:120px;">Customer</td><td style="color:#f0f6fc;">' + esc(fullName || '—') + '</td></tr>'
    + '<tr><td style="padding:7px 0;color:#8b949e;">Email</td><td style="color:#4F6EF7;">' + esc(email) + '</td></tr>'
    + '<tr><td style="padding:7px 0;color:#8b949e;">Phone</td><td style="color:#f0f6fc;">' + esc(phone || '—') + '</td></tr>'
    + '<tr><td style="padding:7px 0;color:#8b949e;">Template</td><td style="color:#f0f6fc;">' + esc(template) + '</td></tr>'
    + '<tr><td style="padding:7px 0;color:#8b949e;">Color</td><td style="color:#f0f6fc;">' + esc(colorChoice) + '</td></tr>'
    + '<tr><td style="padding:7px 0;color:#8b949e;">Site ID</td><td style="color:#f0f6fc;">' + esc(String(siteId)) + '</td></tr>'
    + '<tr><td style="padding:7px 0;color:#8b949e;">Selected At</td><td style="color:#f0f6fc;">' + now + '</td></tr>'
    + '</table>'
    + '<p style="color:#8b949e;font-size:.78rem;margin-top:16px;line-height:1.6;">'
    + 'HTML file attached. Customer email sent. Ready for launch when they decide to proceed.</p>'
    + '</div></body></html>';

  await sendEmail(ownerEmail, ownerSubject, ownerHtml, attachment).catch(function(e) {
    console.error('save-build owner email failed:', e.message);
  });

  return json(200, { success: true, site_id: siteId, build_id: siteId, mode: existingId ? 'updated' : 'created' });
};
