// verify-otp.js
// AI4 Diseño de Sitios Web — Inicio de Sesión de Miembro
// Verifica el código de acceso enviado por correo y lo elimina tras la verificación exitosa.

'use strict';

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeCode(value = '') {
  return String(value || '').trim().replace(/\D/g, '').slice(0, 6);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  if (!supabase) {
    console.error('Supabase is not configured for verify-otp.');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'El inicio de sesión no está configurado aún.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Solicitud inválida.' }) };
  }

  const email = normalizeEmail(body.email);
  const code = normalizeCode(body.code);

  if (!email || !code) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'El correo y el código son requeridos.' }) };
  }

  if (code.length !== 6) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Por favor ingresa el código de acceso de 6 dígitos.' }) };
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('email, full_name, otp_code, otp_expires')
    .ilike('email', email)
    .maybeSingle();

  if (error) {
    console.error('OTP user lookup error:', error.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'No se pudo verificar el código. Inténtalo de nuevo.' }) };
  }

  if (!user) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cuenta no encontrada. Por favor verifica tu correo electrónico.' }) };
  }

  if (!user.otp_code) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No se encontró un código activo. Por favor solicita uno nuevo.' }) };
  }

  if (user.otp_expires && new Date() > new Date(user.otp_expires)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'El código ha expirado. Por favor solicita uno nuevo.' }) };
  }

  if (String(user.otp_code).trim() !== code) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Código incorrecto. Inténtalo de nuevo.' }) };
  }

  const { error: clearError } = await supabase
    .from('users')
    .update({
      otp_code: null,
      otp_expires: null,
      updated_at: new Date().toISOString()
    })
    .ilike('email', email);

  if (clearError) {
    console.error('OTP clear error:', clearError.message);
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      user: {
        email: user.email,
        name: user.full_name || ''
      }
    })
  };
};
