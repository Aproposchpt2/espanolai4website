'use strict';
// verify-otp.js — uses direct REST fetch (no Supabase JS client, no WebSocket dependency)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function sbHeaders() {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'El inicio de sesión no está configurado.' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Solicitud inválida.' }) }; }

  const email = (body.email || '').trim().toLowerCase();
  const code  = (body.code  || '').trim().replace(/\D/g, '').slice(0, 6);

  if (!email || !code) return { statusCode: 400, headers, body: JSON.stringify({ error: 'El correo y el código son requeridos.' }) };
  if (code.length !== 6) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Por favor ingresa el código de 6 dígitos.' }) };

  // Look up user
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/users?email=ilike.${encodeURIComponent(email)}&select=email,full_name,otp_code,otp_expires&limit=1`,
    { headers: sbHeaders() }
  );
  const rows = await res.json();
  const user = Array.isArray(rows) && rows.length ? rows[0] : null;

  if (!user) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cuenta no encontrada. Verifica tu correo.' }) };
  if (!user.otp_code) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No hay código activo. Solicita uno nuevo.' }) };
  if (user.otp_expires && new Date() > new Date(user.otp_expires)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'El código expiró. Solicita uno nuevo.' }) };
  if (String(user.otp_code).trim() !== code) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Código incorrecto. Inténtalo de nuevo.' }) };

  // Clear OTP
  await fetch(
    `${SUPABASE_URL}/rest/v1/users?email=ilike.${encodeURIComponent(email)}`,
    {
      method: 'PATCH',
      headers: { ...sbHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ otp_code: null, otp_expires: null, updated_at: new Date().toISOString() })
    }
  );

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, user: { email: user.email, name: user.full_name || '' } })
  };
};
