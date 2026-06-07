'use strict';

// deliver-site.js — AI4 Website Design Studio
// Fires when a client site is approved and ready to deliver.
//
// Does three things in one call:
//   1. Sends owner internal email with the HTML file as an attachment
//   2. Updates the Supabase sites record with delivery data
//   3. Sends the client a "your site is live" email with the live URL
//
// POST body: { site_id, site_url, client_email, client_name, business_name }
// Requires header: x-deliver-secret matching DELIVER_SECRET env var

const { createClient } = require('@supabase/supabase-js');

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-deliver-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(statusCode, payload) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(payload) };
}

function esc(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function sendResendEmail({ to, subject, html, attachments }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');

  const payload = {
    from: process.env.RESEND_FROM_EMAIL || 'AI4 Website Design <jmitchell@ai4websitedesign.com>',
    to,
    subject,
    html,
  };

  if (attachments && attachments.length > 0) {
    payload.attachments = attachments;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }

  return res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { success: false, error: 'Method not allowed' });
  }

  // Authorization check
  const deliverSecret = process.env.DELIVER_SECRET;
  if (deliverSecret) {
    const provided = event.headers['x-deliver-secret'] || event.headers['X-Deliver-Secret'] || '';
    if (provided !== deliverSecret) {
      return json(401, { success: false, error: 'Unauthorized' });
    }
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { success: false, error: 'Invalid JSON body' });
  }

  const { site_id, site_url, client_email, client_name, business_name } = body;

  if (!site_id) return json(400, { success: false, error: 'site_id is required' });
  if (!site_url) return json(400, { success: false, error: 'site_url is required' });
  if (!client_email) return json(400, { success: false, error: 'client_email is required' });

  let supabase;
  try {
    supabase = getSupabase();
  } catch (err) {
    return json(500, { success: false, error: err.message });
  }

  // Fetch the site record from Supabase
  const { data: site, error: fetchError } = await supabase
    .from('sites')
    .select('id, email, full_name, business_name, built_html, template_selected, color_choice, created_at')
    .eq('id', site_id)
    .single();

  if (fetchError || !site) {
    return json(404, { success: false, error: 'Site record not found' });
  }

  const siteHtml = site.built_html || '';
  const resolvedName = client_name || site.full_name || 'there';
  const resolvedBusiness = business_name || site.business_name || 'Your Business';
  const resolvedEmail = client_email || site.email;
  const templateUsed = site.template_selected || 'UNKNOWN';
  const deliveredAt = new Date().toISOString();
  const fileName = `${resolvedBusiness.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-website.html`;
  const internalEmail = process.env.AI4_INTERNAL_NOTIFICATION_EMAIL ||
    process.env.RESEND_TO_EMAIL ||
    'jmitchell@ai4websitedesign.com';

  const errors = [];

  // ── STEP 1: Update Supabase sites record ─────────────────────────────────
  const { error: updateError } = await supabase
    .from('sites')
    .update({
      domain_name: site_url,
      site_html: siteHtml,
      template_used: templateUsed,
      site_status: 'delivered',
      launched_at: deliveredAt,
      updated_at: deliveredAt,
    })
    .eq('id', site_id);

  if (updateError) {
    console.error('Supabase update error:', updateError.message);
    errors.push(`Supabase update failed: ${updateError.message}`);
  } else {
    console.log('Site record updated in Supabase:', site_id);
  }

  // ── STEP 2: Send owner email with HTML attachment ─────────────────────────
  try {
    const htmlBase64 = Buffer.from(siteHtml).toString('base64');

    const ownerHtml = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"></head>
      <body style="margin:0;padding:0;background:#080c10;color:#f0f6fc;font-family:Arial,sans-serif;">
        <div style="max-width:640px;margin:0 auto;padding:32px 22px;">
          <h1 style="font-size:20px;color:#f0f6fc;margin:0 0 16px;">✅ Site Delivered — ${esc(resolvedBusiness)}</h1>
          <table style="width:100%;border-collapse:collapse;background:#101720;border:1px solid #30363d;border-radius:12px;overflow:hidden;margin-bottom:24px;">
            <tr><td style="padding:8px 12px;border-bottom:1px solid #30363d;color:#8b949e;">Client</td><td style="padding:8px 12px;border-bottom:1px solid #30363d;color:#f0f6fc;">${esc(resolvedName)}</td></tr>
            <tr><td style="padding:8px 12px;border-bottom:1px solid #30363d;color:#8b949e;">Email</td><td style="padding:8px 12px;border-bottom:1px solid #30363d;color:#f0f6fc;">${esc(resolvedEmail)}</td></tr>
            <tr><td style="padding:8px 12px;border-bottom:1px solid #30363d;color:#8b949e;">Business</td><td style="padding:8px 12px;border-bottom:1px solid #30363d;color:#f0f6fc;">${esc(resolvedBusiness)}</td></tr>
            <tr><td style="padding:8px 12px;border-bottom:1px solid #30363d;color:#8b949e;">Template</td><td style="padding:8px 12px;border-bottom:1px solid #30363d;color:#f0f6fc;">${esc(templateUsed)}</td></tr>
            <tr><td style="padding:8px 12px;border-bottom:1px solid #30363d;color:#8b949e;">Live URL</td><td style="padding:8px 12px;border-bottom:1px solid #30363d;color:#4A7FFF;"><a href="${esc(site_url)}" style="color:#4A7FFF;">${esc(site_url)}</a></td></tr>
            <tr><td style="padding:8px 12px;border-bottom:1px solid #30363d;color:#8b949e;">Site ID</td><td style="padding:8px 12px;border-bottom:1px solid #30363d;color:#f0f6fc;">${esc(site_id)}</td></tr>
            <tr><td style="padding:8px 12px;color:#8b949e;">Delivered At</td><td style="padding:8px 12px;color:#f0f6fc;">${deliveredAt}</td></tr>
          </table>
          <p style="color:#8b949e;font-size:0.8rem;">HTML file attached. Client confirmation email sent.</p>
        </div>
      </body></html>
    `;

    await sendResendEmail({
      to: internalEmail,
      subject: `✅ Site Delivered: ${resolvedBusiness}`,
      html: ownerHtml,
      attachments: [{ filename: fileName, content: htmlBase64 }],
    });

    console.log('Owner delivery email sent with attachment:', internalEmail);
  } catch (emailErr) {
    console.error('Owner delivery email failed:', emailErr.message);
    errors.push(`Owner email failed: ${emailErr.message}`);
  }

  // ── STEP 3: Send client "site is live" email ──────────────────────────────
  try {
    const firstName = resolvedName.split(' ')[0] || 'there';

    const clientHtml = `
      <!DOCTYPE html><html>
      <head><meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background: #080c10; color: #f0f6fc; margin: 0; padding: 0; }
        .wrap { max-width: 560px; margin: 0 auto; padding: 40px 24px; }
        .brand { font-size: 1.2rem; font-weight: 900; font-style: italic; color: #4F6EF7; margin-bottom: 24px; }
        .hero { background: linear-gradient(135deg, rgba(79,110,247,.15), rgba(124,58,237,.1)); border: 1px solid rgba(79,110,247,.25); border-radius: 16px; padding: 32px; margin-bottom: 24px; text-align: center; }
        .hero h1 { font-size: 1.5rem; font-weight: 800; margin: 0 0 8px; color: #f0f6fc; }
        .hero p { color: #8b949e; font-size: .9rem; line-height: 1.7; margin: 0; }
        .url-box { background: rgba(74,127,255,.08); border: 1px solid rgba(74,127,255,.3); border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; text-align: center; }
        .url-box p { color: #8b949e; font-size: .78rem; margin: 0 0 10px; text-transform: uppercase; letter-spacing: .08em; }
        .url-link { color: #4A7FFF; font-size: 1rem; font-weight: 700; word-break: break-all; text-decoration: none; }
        .cta-btn { display: block; text-align: center; background: linear-gradient(135deg, #4F6EF7, #7C3AED); color: #fff; font-weight: 800; font-size: 1rem; padding: 16px; border-radius: 10px; text-decoration: none; margin-bottom: 24px; }
        .footer { text-align: center; font-size: .72rem; color: #8b949e; line-height: 1.8; }
      </style>
      </head>
      <body>
        <div class="wrap">
          <div class="brand">ai4websitedesign</div>
          <div class="hero">
            <h1>Your Site Is Live! 🚀</h1>
            <p>Hi ${esc(firstName)} — <strong>${esc(resolvedBusiness)}</strong> is now live on the web and ready for visitors.</p>
          </div>
          <div class="url-box">
            <p>Your live website</p>
            <a class="url-link" href="${esc(site_url)}">${esc(site_url)}</a>
          </div>
          <a class="cta-btn" href="${esc(site_url)}">Visit Your Site →</a>
          <div class="footer">
            Questions? Reply to this email or contact us at jmitchell@ai4websitedesign.com<br><br>
            Powered by Apropos Group LLC · ai4websitedesign.com<br>
            © 2026 Apropos Group LLC. All rights reserved.
          </div>
        </div>
      </body></html>
    `;

    await sendResendEmail({
      to: resolvedEmail,
      subject: `🚀 Your ${esc(resolvedBusiness)} website is live!`,
      html: clientHtml,
    });

    console.log('Client delivery email sent:', resolvedEmail);
  } catch (clientEmailErr) {
    console.error('Client delivery email failed:', clientEmailErr.message);
    errors.push(`Client email failed: ${clientEmailErr.message}`);
  }

  return json(200, {
    success: true,
    site_id,
    site_url,
    delivered_at: deliveredAt,
    errors: errors.length > 0 ? errors : undefined,
  });
};
