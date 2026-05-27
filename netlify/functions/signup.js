/**
 * AI4 Diseño de Sitios Web — Manejador de Registro (Español)
 * netlify/functions/signup.js
 * Captura nombre, correo, teléfono → guarda en Supabase → envía correo de bienvenida en español
 */

'use strict';

const https = require('https');

const BRAND = {
  name: 'AI4 Diseño de Sitios Web',
  entity: 'Apropos Group LLC',
  accent: '#4F6EF7',
  accent2: '#7C3AED',
  green: '#3fb950',
  bg: '#080c10',
  panel: '#0f1419',
  border: '#1c2430',
  text: '#f0f6fc',
  muted: '#8b949e',
  siteUrl: 'https://espanola.ai4websitedesign.com',
};

function safeString(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  return String(val).trim();
}

function formatTimestamp() {
  return new Date().toLocaleString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles',
  }) + ' PT';
}

async function supabaseRequest(method, path, body = null) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) { console.error('SUPABASE: Missing credentials'); return null; }
  const bodyStr = body ? JSON.stringify(body) : null;
  return new Promise((resolve) => {
    const urlObj = new URL(`${url}/rest/v1/${path}`);
    const headers = {
      'Authorization': `Bearer ${key}`,
      'apikey': key,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const options = { hostname: urlObj.hostname, path: urlObj.pathname + (urlObj.search || ''), method, headers };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if ([200, 201, 204].includes(res.statusCode)) {
          try { resolve(data ? JSON.parse(data) : true); } catch { resolve(true); }
        } else {
          console.error(`SUPABASE ${method} FAILED — ${res.statusCode} — ${data}`);
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function sendEmail(to, subject, html, text) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || `${BRAND.name} <support@espanola.ai4websitedesign.com>`;
  if (!apiKey) return;
  const body = JSON.stringify({ from, to: [to], subject, html, text });
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido' }) }; }

  const { full_name, email, phone, lang } = body;

  if (!full_name || !email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'El nombre y el correo son requeridos' }) };
  }

  console.log('SIGNUP ES:', full_name, '|', email, '|', phone || 'sin teléfono');

  // Save to Supabase — shared database, tag with language
  const user = await supabaseRequest('POST', 'users', {
    full_name: safeString(full_name),
    email: safeString(email).toLowerCase(),
    phone: safeString(phone),
    status: 'active',
    language: lang || 'es',
  });

  if (!user) {
    console.error('Failed to save user to Supabase');
  } else {
    console.log('USER SAVED (ES):', email);
  }

  const ownerEmail = process.env.RESEND_TO_EMAIL || 'jeffrey@ai4websitedesign.com';
  const firstName = full_name.split(' ')[0];

  // ── NOTIFY OWNER ─────────────────────────────────────────────
  await sendEmail(
    ownerEmail,
    `Nuevo Registro — ${full_name} — AI4 Diseño Web — Mercado Hispano`,
    `<div style="font-family:Arial;background:${BRAND.bg};padding:24px;color:${BRAND.text};border-radius:12px">
      <div style="background:linear-gradient(135deg,${BRAND.accent},${BRAND.accent2});color:#fff;font-weight:700;font-size:13px;padding:4px 10px;border-radius:4px;display:inline-block;margin-bottom:16px">AI4 Diseño Web — Mercado Hispano</div>
      <h2 style="color:${BRAND.text};margin:0 0 16px">Nuevo Registro 🌐</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:${BRAND.muted};font-size:13px;width:120px">Nombre</td><td style="padding:8px 0;color:${BRAND.text};font-size:13px;font-weight:600">${full_name}</td></tr>
        <tr><td style="padding:8px 0;color:${BRAND.muted};font-size:13px">Correo</td><td style="padding:8px 0;color:${BRAND.accent};font-size:13px">${email}</td></tr>
        <tr><td style="padding:8px 0;color:${BRAND.muted};font-size:13px">Teléfono</td><td style="padding:8px 0;color:${BRAND.text};font-size:13px">${phone || 'No proporcionado'}</td></tr>
        <tr><td style="padding:8px 0;color:${BRAND.muted};font-size:13px">Idioma</td><td style="padding:8px 0;color:${BRAND.green};font-size:13px;font-weight:700">Español</td></tr>
        <tr><td style="padding:8px 0;color:${BRAND.muted};font-size:13px">Hora</td><td style="padding:8px 0;color:${BRAND.text};font-size:13px">${formatTimestamp()}</td></tr>
      </table>
      <p style="color:${BRAND.muted};font-size:12px;margin-top:16px">${BRAND.name} · ${BRAND.entity}</p>
    </div>`,
    `NUEVO REGISTRO (ESPAÑOL)\nNombre: ${full_name}\nCorreo: ${email}\nTeléfono: ${phone || 'No proporcionado'}\nHora: ${formatTimestamp()}`
  ).catch(err => console.error('Owner email error:', err.message));

  // ── CORREO DE BIENVENIDA EN ESPAÑOL ──────────────────────────────────
  await sendEmail(
    email,
    `¡Bienvenido a AI4 Diseño de Sitios Web, ${firstName}! 🌐`,
    `<div style="font-family:Arial;background:${BRAND.bg};padding:24px;color:${BRAND.text};border-radius:12px;max-width:560px;margin:0 auto">
      <div style="background:linear-gradient(135deg,${BRAND.accent},${BRAND.accent2});color:#fff;font-weight:700;font-size:13px;padding:4px 10px;border-radius:4px;display:inline-block;margin-bottom:16px">AI4 Diseño de Sitios Web</div>
      <h2 style="color:${BRAND.text};margin:0 0 8px">¡Bienvenido, ${firstName}! 👋</h2>
      <p style="color:${BRAND.muted};font-size:14px;line-height:1.6;margin-bottom:16px">Tu cuenta está lista. Regresa al constructor y creemos algo poderoso para tu negocio.</p>
      <a href="${BRAND.siteUrl}/build.html" style="display:inline-block;background:linear-gradient(135deg,${BRAND.accent},${BRAND.accent2});color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:16px">Continuar a Construir →</a>
      <p style="color:${BRAND.muted};font-size:12px;margin-top:16px">¿Preguntas? Responde a este correo o contáctanos en support@espanola.ai4websitedesign.com</p>
      <p style="color:#484f58;font-size:11px;margin-top:8px">${BRAND.name} · ${BRAND.entity} · Las Vegas, NV</p>
    </div>`,
    `¡Bienvenido a AI4 Diseño de Sitios Web, ${firstName}!\n\nTu cuenta está lista. Regresa al constructor y creemos algo poderoso para tu negocio.\n\n${BRAND.siteUrl}/build.html\n\n¿Preguntas? support@espanola.ai4websitedesign.com`
  ).catch(err => console.error('Welcome email error:', err.message));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: 'Cuenta creada',
      user_id: user?.[0]?.id || null,
    }),
  };
};
