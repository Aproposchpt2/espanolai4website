// register-user.js
// Crea una nueva cuenta de usuario y envía correo OTP (flujo de Registro)

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendWelcomeEmail(email, name, otp) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    process.env.RESEND_FROM_EMAIL,
      to:      email,
      subject: 'Tu Código de Acceso — AI4 Diseño de Sitios Web',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family:Arial,sans-serif;background:#080c10;color:#f0f6fc;padding:40px;margin:0;">
          <div style="max-width:480px;margin:0 auto;background:#0f1419;border-radius:16px;border:1px solid rgba(255,255,255,.1);padding:40px;">
            <div style="font-size:1.2rem;font-weight:900;color:#4F6EF7;margin-bottom:24px;">AI4 Diseño de Sitios Web</div>
            <h2 style="color:#f0f6fc;margin:0 0 12px;">¡Bienvenido, ${name}! 🎉</h2>
            <p style="color:#8b949e;line-height:1.7;margin:0 0 28px;">
              Tu cuenta ha sido creada. Usa el código a continuación para verificar tu correo y acceder a tu cuenta.
              Este código expira en <strong style="color:#f0f6fc;">15 minutos</strong>.
            </p>
            <div style="background:#161d25;border:2px solid #4F6EF7;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
              <div style="font-size:.7rem;color:#8b949e;letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px;font-family:monospace;">Tu Código de Acceso</div>
              <div style="font-size:2.8rem;font-weight:900;letter-spacing:.18em;color:#4F6EF7;font-family:monospace;">${otp}</div>
            </div>
            <p style="color:#8b949e;font-size:.85rem;line-height:1.6;">
              Una vez verificado tendrás acceso completo al panel de tu cuenta donde podrás comenzar a construir tu sitio web.
            </p>
            <hr style="border:none;border-top:1px solid rgba(255,255,255,.07);margin:24px 0;">
            <p style="color:#8b949e;font-size:.75rem;">Impulsado por Apropos Group LLC · espanola.ai4websitedesign.com</p>
          </div>
        </body>
        </html>
      `
    })
  });
  if (!res.ok) throw new Error('Resend error: ' + await res.text());
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };

  let name, email, phone;
  try { ({ name, email, phone } = JSON.parse(event.body)); } catch(e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Solicitud inválida' }) };
  }

  if (!name || !email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'El nombre y el correo son requeridos' }) };
  }

  const otp    = generateOTP();
  const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const now    = new Date().toISOString();

  // Upsert user — if email exists update OTP, if new create record
  const { error } = await supabase
    .from('users')
    .upsert({
      full_name:   name,
      email:       email.toLowerCase(),
      phone:       phone || null,
      status:      'active',
      otp_code:    otp,
      otp_expires: expiry,
      updated_at:  now,
      created_at:  now,
    }, { onConflict: 'email' });

  if (error) {
    console.error('User upsert error:', error.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'No se pudo crear la cuenta. Inténtalo de nuevo.' }) };
  }

  // Send welcome + OTP email
  try {
    await sendWelcomeEmail(email, name, otp);
  } catch(e) {
    console.error('Welcome email error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Cuenta creada pero no se pudo enviar el correo. Por favor contacta al soporte.' }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
};
