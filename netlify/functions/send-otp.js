// send-otp.js
// AI4 Diseño de Sitios Web — Inicio de Sesión de Miembro
// Envía un nuevo código de acceso por correo para el flujo de Inicio de Sesión.
// Los secretos del backend deben permanecer solo en las variables de entorno de Netlify.

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

const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ||
  'AI4 Diseño de Sitios Web <jmitchell@espanola.ai4websitedesign.com>';

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getFirstName(name = '') {
  const clean = String(name || '').trim();
  return clean ? clean.split(/\s+/)[0] : '';
}

async function findUser(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('email', email)
    .maybeSingle();

  if (error) {
    console.error('User lookup error:', error.message);
    return null;
  }

  return data || null;
}

async function findLatestOrder(email) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Order lookup error:', error.message);
    return null;
  }

  return Array.isArray(data) && data.length ? data[0] : null;
}

async function findLatestSubscription(email) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Subscription lookup error:', error.message);
    return null;
  }

  return Array.isArray(data) && data.length ? data[0] : null;
}

async function upsertUserFromMemberRecord(email, order, subscription) {
  const fullName =
    order?.full_name ||
    subscription?.full_name ||
    '';

  const phone =
    order?.phone ||
    subscription?.phone ||
    '';

  const stripeCustomerId =
    order?.stripe_customer_id ||
    subscription?.stripe_customer_id ||
    '';

  const { data, error } = await supabase
    .from('users')
    .upsert({
      email,
      full_name: fullName,
      phone,
      stripe_customer_id: stripeCustomerId,
      language: 'es',
      updated_at: new Date().toISOString()
    }, { onConflict: 'email' })
    .select()
    .single();

  if (error) {
    console.error('User upsert from member record failed:', error.message);
    return null;
  }

  return data || null;
}

async function sendOTPEmail(email, name, otp) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured.');
  }

  const firstName = getFirstName(name);
  const greeting = firstName ? `¡Hola ${firstName}!` : '¡Hola!';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: email,
      subject: 'Tu Código de Acceso — AI4 Diseño de Sitios Web',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family:Arial,sans-serif;background:#080c10;color:#f0f6fc;padding:40px 20px;margin:0;">
          <div style="max-width:500px;margin:0 auto;background:#0f1419;border-radius:18px;border:1px solid rgba(91,211,255,.22);padding:34px;">
            <div style="font-size:1.05rem;font-weight:900;color:#5BD3FF;margin-bottom:22px;">AI4 Diseño de Sitios Web</div>
            <h2 style="color:#f0f6fc;margin:0 0 12px;">${greeting}</h2>
            <p style="color:#c9d1d9;line-height:1.7;margin:0 0 24px;">
              Usa este código seguro para acceder a tu área de miembro de AI4. Expira en <strong style="color:#f0f6fc;">15 minutos</strong>.
            </p>
            <div style="background:#07111f;border:2px solid #5BD3FF;border-radius:14px;padding:26px;text-align:center;margin-bottom:24px;">
              <div style="font-size:.7rem;color:#90A3BC;letter-spacing:.16em;text-transform:uppercase;margin-bottom:10px;font-family:monospace;">Código de Acceso</div>
              <div style="font-size:2.7rem;font-weight:900;letter-spacing:.18em;color:#5BD3FF;font-family:monospace;">${otp}</div>
            </div>
            <p style="color:#90A3BC;font-size:.82rem;line-height:1.6;margin:0;">Si no solicitaste este código, puedes ignorar este correo de manera segura.</p>
            <hr style="border:none;border-top:1px solid rgba(255,255,255,.08);margin:24px 0;">
            <p style="color:#90A3BC;font-size:.75rem;line-height:1.7;margin:0;">Apropos Group LLC · espanola.ai4websitedesign.com</p>
          </div>
        </body>
        </html>
      `
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  if (!supabase) {
    console.error('Supabase is not configured for send-otp.');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'El inicio de sesión no está configurado aún.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Solicitud inválida.' }) };
  }

  const email = normalizeEmail(body.email);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Se requiere un correo electrónico válido.' }) };
  }

  let user = await findUser(email);

  // Fallback for legitimate returning customers if an older order/subscription exists
  // but the users row was not present.
  if (!user) {
    const [order, subscription] = await Promise.all([
      findLatestOrder(email),
      findLatestSubscription(email)
    ]);

    if (order || subscription) {
      user = await upsertUserFromMemberRecord(email, order, subscription);
    }
  }

  if (!user) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'No se encontró una cuenta de miembro para ese correo.' })
    };
  }

  const otp = generateOTP();
  const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: updateError } = await supabase
    .from('users')
    .update({
      otp_code: otp,
      otp_expires: expiry,
      updated_at: new Date().toISOString()
    })
    .ilike('email', email);

  if (updateError) {
    console.error('OTP save error:', updateError.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'No se pudo crear un código de acceso. Inténtalo de nuevo.' }) };
  }

  try {
    await sendOTPEmail(email, user.full_name || '', otp);
  } catch (err) {
    console.error('OTP email error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'No se pudo enviar el código de acceso. Inténtalo de nuevo.' }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true })
  };
};
