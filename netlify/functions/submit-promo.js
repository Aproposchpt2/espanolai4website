'use strict';

const { createClient } = require('@supabase/supabase-js');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function json(statusCode, payload) {
  return { statusCode, headers, body: JSON.stringify(payload) };
}

function clean(value = '', max = 500) {
  return String(value || '').trim().slice(0, max);
}

function cleanEmail(value = '') {
  return clean(value, 254).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase environment variables');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) return;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html }),
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { success: false, error: 'Method not allowed' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { success: false, error: 'Invalid JSON' });
  }

  const name       = clean(body.name, 120);
  const email      = cleanEmail(body.email);
  const phone      = clean(body.phone, 30);
  const type       = clean(body.website_type || body.type, 60);
  const promoCode  = clean(body.promo_code || body.promoCode, 60).toUpperCase();
  const expiresAt  = clean(body.expires_at || body.expiresAt, 40);

  if (!name)               return json(400, { success: false, error: 'Name is required' });
  if (!isValidEmail(email)) return json(400, { success: false, error: 'Valid email is required' });
  if (!promoCode)          return json(400, { success: false, error: 'Promo code is required' });

  let supabase;
  try {
    supabase = getSupabase();
  } catch (err) {
    return json(500, { success: false, error: 'Service configuration error' });
  }

  const { data: existing } = await supabase
    .from('promo_leads')
    .select('id, promo_code, used')
    .eq('email', email)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return json(409, {
      success: false,
      duplicate: true,
      used: existing.used,
      promo_code: existing.used ? null : existing.promo_code,
      error: existing.used
        ? 'Este correo ya usó su código promocional.'
        : 'Ya se emitió un código promocional para este correo.',
    });
  }

  const { error: insertError } = await supabase.from('promo_leads').insert({
    name,
    email,
    phone: phone || null,
    website_type: type || null,
    promo_code: promoCode,
    used: false,
    source: 'espanol-promo-page',
    expires_at: expiresAt || null,
  });

  if (insertError) {
    if (insertError.message?.includes('unique') || insertError.message?.includes('duplicate')) {
      return json(409, { success: false, duplicate: true, error: 'Código promocional ya reclamado.' });
    }
    console.error('promo_leads insert error:', insertError.message);
    return json(500, { success: false, error: 'Failed to save promo lead' });
  }

  const internalEmail = process.env.RESEND_TO_EMAIL;

  await Promise.allSettled([
    sendEmail({
      to: email,
      subject: 'Tu Código Promocional — AI4 Estudio de Diseño Web',
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#030816;color:#f5f8ff;font-family:Arial,sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:40px 24px;">
    <div style="background:#061225;border:1px solid rgba(45,184,255,.2);border-radius:16px;padding:32px;">
      <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#FFB800;font-weight:700;margin-bottom:12px;">AI4 Estudio de Diseño Web</div>
      <h1 style="font-size:22px;color:#f5f8ff;margin:0 0 16px;">Hola ${name} — aquí está tu Código Promocional</h1>
      <p style="font-size:15px;color:#AEBED3;line-height:1.6;margin:0 0 24px;">Usa el código a continuación para reclamar tu sitio web gratis. Ingrésalo cuando comiences a construir.</p>
      <div style="text-align:center;background:rgba(255,184,0,.08);border:1px dashed rgba(255,184,0,.4);border-radius:10px;padding:20px;margin-bottom:24px;">
        <div style="font-size:11px;letter-spacing:.12em;color:#FFD060;text-transform:uppercase;margin-bottom:8px;">Tu Código Promocional</div>
        <div style="font-size:28px;font-weight:700;letter-spacing:.18em;color:#FFB800;font-family:monospace;">${promoCode}</div>
      </div>
      <div style="text-align:center;">
        <a href="https://espanola.ai4websitedesign.com/signup?promo=${promoCode}&type=${encodeURIComponent(type)}" style="display:inline-block;background:linear-gradient(135deg,#FFB800,#FFD060);color:#1a0d00;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">Construir Mi Sitio Web →</a>
      </div>
    </div>
  </div>
</body></html>`,
    }),

    internalEmail ? sendEmail({
      to: internalEmail,
      subject: `Nuevo Lead Promo — ${name}`,
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#030816;color:#f5f8ff;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#061225;border:1px solid rgba(45,184,255,.2);border-radius:12px;padding:24px;">
    <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#FFB800;margin-bottom:12px;">Nuevo Lead Promo — Español</div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#AEBED3;">
      <tr><td style="padding:7px 0;color:#90A3BC;width:130px;">Nombre</td><td>${name}</td></tr>
      <tr><td style="padding:7px 0;color:#90A3BC;">Correo</td><td>${email}</td></tr>
      <tr><td style="padding:7px 0;color:#90A3BC;">Teléfono</td><td>${phone || '—'}</td></tr>
      <tr><td style="padding:7px 0;color:#90A3BC;">Tipo de Sitio</td><td>${type || '—'}</td></tr>
      <tr><td style="padding:7px 0;color:#90A3BC;">Código Promo</td><td style="color:#FFB800;font-family:monospace;">${promoCode}</td></tr>
    </table>
  </div>
</body></html>`,
    }) : Promise.resolve(),
  ]);

  return json(200, { success: true, promo_code: promoCode });
};
