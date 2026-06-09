'use strict';
// send-website.js -- Retrieves built HTML from Supabase sites table and emails it to the new member.
// Called by the purchasing intake form after member signup when user clicks "Launch My Site Today".

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function json(code, payload) {
  return { statusCode: code, headers: CORS, body: JSON.stringify(payload) };
}

function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  return { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
}

async function sendEmail(to, subject, html, attachment) {
  const key  = process.env.RESEND_API_KEY;
  if (!key) { console.warn('send-website: RESEND_API_KEY not set'); return; }
  const from = process.env.RESEND_FROM_EMAIL || 'AI4 Website Design <jmitchell@ai4websitedesign.com>';
  const body = { from, to: [to], subject, html };
  if (attachment) body.attachments = [attachment];
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) console.error('send-website email error:', res.status, await res.text());
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { success: false, error: 'POST only' });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return json(500, { success: false, error: 'Service not configured' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { success: false, error: 'Invalid JSON' }); }

  const siteId  = (body.site_id || '').trim();
  const email   = (body.email   || '').trim().toLowerCase();
  const name    = (body.name    || '').trim();

  if (!siteId || !email) return json(400, { success: false, error: 'site_id and email are required' });

  // Retrieve the built site from Supabase
  const res = await fetch(
    url + '/rest/v1/sites?id=eq.' + encodeURIComponent(siteId) + '&select=id,built_html,business_name&limit=1',
    { headers: sbHeaders() }
  );
  const rows = await res.json();
  const site = Array.isArray(rows) && rows.length ? rows[0] : null;

  if (!site || !site.built_html) {
    return json(404, { success: false, error: 'Site not found. Please contact support.' });
  }

  const businessName = site.business_name || 'Your Business';
  const firstName    = name.split(' ')[0] || 'there';
  const fileSlug     = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const fileName     = fileSlug + '-website.html';
  const htmlBase64   = Buffer.from(site.built_html).toString('base64');
  const ownerEmail   = process.env.RESEND_TO_EMAIL || 'jmitchell@ai4websitedesign.com';

  // Customer email with file attached
  const customerHtml =
    '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:0;background:#030816;color:#f0f6fc;font-family:Arial,sans-serif;">' +
    '<div style="max-width:560px;margin:0 auto;padding:40px 24px;">' +
    '<div style="background:#061225;border:1px solid rgba(74,127,255,.2);border-radius:16px;padding:32px;">' +
    '<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#4A7FFF;font-weight:700;margin-bottom:16px;">AI4 Website Design Studio</div>' +
    '<h2 style="color:#f0f6fc;margin:0 0 12px;">Hi ' + firstName + ' — your website is attached!</h2>' +
    '<p style="color:#8b949e;line-height:1.7;margin:0 0 16px;">Your custom website for <strong style="color:#f0f6fc;">' + businessName + '</strong> is ready. The file <strong style="color:#f0f6fc;">' + fileName + '</strong> is attached to this email.</p>' +
    '<p style="color:#8b949e;line-height:1.7;margin:0 0 24px;">When you\'re ready to launch, simply reply to this email and we\'ll take care of everything.</p>' +
    '<div style="background:rgba(74,127,255,.08);border:1px solid rgba(74,127,255,.22);border-radius:10px;padding:16px 20px;margin-bottom:24px;">' +
    '<p style="color:#8b949e;font-size:13px;margin:0;line-height:1.65;">Your website was built by the AI4 Design Engine — unique layout, fonts, and copy created specifically for your business. No templates were used.</p>' +
    '</div>' +
    '<p style="color:#484f58;font-size:11px;margin:0;">AI4 Website Design Studio &middot; Apropos Group LLC &middot; ai4websitedesign.com</p>' +
    '</div></div></body></html>';

  await sendEmail(
    email,
    'Your ' + businessName + ' website is ready — file attached',
    customerHtml,
    { filename: fileName, content: htmlBase64 }
  );

  // Internal notification
  const ownerHtml =
    '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="font-family:Arial,sans-serif;background:#030816;color:#f0f6fc;margin:0;padding:24px;">' +
    '<div style="max-width:520px;margin:0 auto;background:#061225;border:1px solid rgba(74,127,255,.2);border-radius:12px;padding:24px;">' +
    '<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#4A7FFF;margin-bottom:12px;">New Member — Website Delivered</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px;color:#8b949e;">' +
    '<tr><td style="padding:6px 0;width:110px;">Name</td><td style="color:#f0f6fc;">' + name + '</td></tr>' +
    '<tr><td style="padding:6px 0;">Email</td><td style="color:#4A7FFF;">' + email + '</td></tr>' +
    '<tr><td style="padding:6px 0;">Business</td><td style="color:#f0f6fc;">' + businessName + '</td></tr>' +
    '<tr><td style="padding:6px 0;">Site ID</td><td style="color:#f0f6fc;font-size:12px;">' + siteId + '</td></tr>' +
    '</table></div></body></html>';

  await sendEmail(
    ownerEmail,
    'New Member — Website Delivered: ' + businessName,
    ownerHtml,
    { filename: fileName, content: htmlBase64 }
  );

  return json(200, { success: true, message: 'Website sent to ' + email });
};
