'use strict';
// send-otp.js — uses direct REST fetch (no Supabase JS client, no WebSocket dependency)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const FROM_EMAIL   = process.env.RESEND_FROM_EMAIL;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function sbHeaders(extra = {}) {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...extra };
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function findUser(email) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/users?email=ilike.${encodeURIComponent(email)}&limit=1`,
    { headers: sbHeaders() }
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function findLatestOrder(email) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?email=ilike.${encodeURIComponent(email)}&order=created_at.desc&limit=1`,
    { headers: sbHeaders() }
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function findLatestSubscription(email) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/subscriptions?email=ilike.${encodeURIComponent(email)}&order=created_at.desc&limit=1`,
    { headers: sbHeaders() }
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function upsertUser(email, order, subscription) {
  const fullName = order?.full_name || subscription?.full_name || '';
  const phone    = order?.phone || subscription?.phone || '';
  const stripeId = order?.stripe_customer_id || subscription?.stripe_customer_id || '';

  const res = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify({ email, full_name: fullName, phone, stripe_customer_id: stripeId, language: 'es', updated_at: new Date().toISOString() })
  });
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function saveOTP(email, otp, expiry) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/users?email=ilike.${encodeURIComponent(email)}`,
    {
      method: 'PATCH',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ otp_code: otp, otp_expires: expiry, updated_at: new Date().toISOString() })
    }
  );
  return res.ok;
}

async function sendOTPEmail(email, name, otp) {
  const firstName = (name || '').trim().split(/\s+/)[0];
  const greeting  = firstName ? `¡Hola ${firstName}!` : '¡Hola!';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: email,
      subject: 'Tu Código de Acceso — AI4 Diseño de Sitios Web',
      html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#080c10;color:#f0f6fc;padding:40px 20px;margin:0;">
        <div style="max-width:500px;margin:0 auto;background:#0f1419;border-radius:18px;border:1px solid rgba(91,211,255,.22);padding:34px;">
          <div style="font-size:1.05rem;font-weight:900;color:#5BD3FF;margin-bottom:22px;">AI4 Diseño de Sitios Web</div>
          <h2 style="color:#f0f6fc;margin:0 0 12px;">${greeting}</h2>
          <p style="color:#c9d1d9;line-height:1.7;margin:0 0 24px;">Usa este código seguro para acceder a tu área de miembro. Expira en <strong style="color:#f0f6fc;">15 minutos</strong>.</p>
          <div style="background:#07111f;border:2px solid #5BD3FF;border-radius:14px;padding:26px;text-align:center;margin-bottom:24px;">
            <div style="font-size:.7rem;color:#90A3BC;letter-spacing:.16em;text-transform:uppercase;margin-bottom:10px;font-family:monospace;">Código de Acceso</div>
            <div style="font-size:2.7rem;font-weight:900;letter-spacing:.18em;color:#5BD3FF;font-family:monospace;">${otp}</div>
          </div>
          <p style="color:#90A3BC;font-size:.82rem;line-height:1.6;margin:0;">Si no solicitaste este código, puedes ignorar este correo.</p>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,.08);margin:24px 0;">
          <p style="color:#90A3BC;font-size:.75rem;margin:0;">Apropos Group LLC · espanola.ai4websitedesign.com</p>
        </div></body></html>`
    })
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`Resend: ${err}`); }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Supabase not configured');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'El inicio de sesión no está configurado.' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Solicitud inválida.' }) }; }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Se requiere un correo electrónico válido.' }) };
  }

  // Find user
  let user = await findUser(email);

  if (!user) {
    const [order, subscription] = await Promise.all([findLatestOrder(email), findLatestSubscription(email)]);
    if (order || subscription) user = await upsertUser(email, order, subscription);
  }

  if (!user) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No se encontró una cuenta para ese correo.' }) };
  }

  // Generate and save OTP
  const otp    = generateOTP();
  const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const saved = await saveOTP(email, otp, expiry);
  if (!saved) {
    console.error('OTP save failed');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'No se pudo crear el código. Inténtalo de nuevo.' }) };
  }

  // Send email
  try { await sendOTPEmail(email, user.full_name || '', otp); }
  catch (err) {
    console.error('OTP email error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'No se pudo enviar el código. Inténtalo de nuevo.' }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
};
