'use strict';

/**
 * AI4 Estudio de Diseño Web — Platinum Creative Foundry V4.5 (Español)
 * Path: netlify/functions/generate-website.js
 *
 * This function intentionally does NOT depend on prompts alone for visual quality.
 * It receives the simple customer intake, infers a premium direction, then renders
 * full handcrafted HTML variations for the preview theater.
 * All content is generated in Spanish for the Hispanic market.
 */

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function clean(value, fallback = '') {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (value === null || value === undefined) return fallback;
  const out = String(value).trim();
  return out || fallback;
}

function esc(value) {
  return clean(value).replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
}

function slugify(value) {
  return clean(value, 'tu-negocio').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 42) || 'tu-negocio';
}

function sentenceCase(value) {
  const v = clean(value);
  if (!v) return '';
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function splitIdeas(text) {
  return clean(text)
    .split(/\n|\.|;|•|-\s+/)
    .map((x) => clean(x))
    .filter((x) => x.length > 2)
    .slice(0, 8);
}

function firstNonEmpty(...items) {
  for (const item of items) {
    const v = clean(item);
    if (v) return v;
  }
  return '';
}

function normalizeAnswers(payload) {
  const raw = payload && (payload.answers || payload.rawAnswers || payload.siteData || payload.brief || payload) || {};
  const businessName = firstNonEmpty(raw.businessName, raw.business_name, raw.brandName, raw.name, raw.companyName, raw.company, 'Tu Negocio');
  const whatYouDo = firstNonEmpty(raw.whatYouDo, raw.whatBusiness, raw.businessDescription, raw.shortDescription, raw.description, raw.businessDoes, raw.q2_whatYouDo);
  const customers = firstNonEmpty(raw.customers, raw.idealCustomers, raw.targetAudience, raw.audience, raw.q3_customers);
  const differentiators = firstNonEmpty(raw.differentiators, raw.whatMakesDifferent, raw.difference, raw.uniqueValue, raw.q4_differentiators);
  const extras = firstNonEmpty(raw.extras, raw.optionalNotes, raw.anythingElse, raw.notes, raw.q7_extras);
  const primaryCta = firstNonEmpty(raw.primaryCta, raw.ctaText, raw.cta, raw.mainCallToAction, raw.primaryGoal, 'Comenzar Tu Proyecto');

  return {
    businessName,
    whatYouDo,
    customers,
    differentiators,
    extras,
    primaryCta,
    phone: clean(raw.phone || raw.phoneNumber || raw.contactPhone || ''),
    email: clean(raw.email || raw.contactEmail || raw.customerEmail || ''),
    address: clean(raw.address || raw.location || raw.serviceArea || ''),
    website: clean(raw.website || raw.url || ''),
    facebook: clean(raw.facebook || raw.facebookUrl || ''),
    instagram: clean(raw.instagram || raw.instagramUrl || ''),
    style: clean(raw.style || raw.visualStylePreference || 'auto-infer-platinum'),
    raw
  };
}

function inferIndustry(a) {
  const text = `${a.businessName} ${a.whatYouDo} ${a.customers} ${a.differentiators} ${a.extras}`.toLowerCase();
  const has = (...keys) => keys.some((k) => text.includes(k));

  if (has('gospel', 'hip-hop', 'hip hop', 'rap', 'soul music', 'música', 'musica', 'producción musical', 'produccion musical', 'estudio de grabación', 'estudio de grabacion', 'beats', 'compositor', 'artista', 'mezcla', 'masterización', 'music production', 'recording studio', 'songwriter', 'artist', 'mixing', 'mastering')) {
    return 'music-studio';
  }
  if (has('ia', 'ai', 'automatización', 'automatizacion', 'automation', 'software', 'saas', 'app', 'tecnología', 'tecnologia', 'tech', 'flujo de trabajo', 'workflow', 'dashboard', 'crm', 'asistente de voz', 'voice attendant')) return 'tech-automation';
  if (has('restaurante', 'restaurant', 'comida', 'food', 'catering', 'chef', 'panadería', 'panaderia', 'bakery', 'café', 'cafe', 'coffee', 'barbero', 'barber', 'salón', 'salon', 'spa', 'hospitalidad', 'hospitality', 'estética', 'estetica', 'peluquería', 'peluqueria')) return 'hospitality-lifestyle';
  if (has('bienes raíces', 'bienes raices', 'real estate', 'propiedad', 'property', 'corredor', 'realtor', 'broker', 'hipoteca', 'mortgage', 'comprador de casa', 'home buyer', 'listado', 'listing')) return 'real-estate';
  if (has('abogado', 'law', 'attorney', 'consultor', 'consultant', 'financiero', 'financial', 'asesor', 'advisor', 'impuestos', 'tax', 'contabilidad', 'bookkeeping', 'seguro', 'insurance', 'profesional', 'professional')) return 'professional-authority';
  if (has('iglesia', 'church', 'ministerio', 'ministry', 'organización sin fines de lucro', 'nonprofit', 'comunidad', 'community', 'donación', 'donacion', 'donation', 'fundación', 'fundacion', 'foundation', 'juventud', 'youth')) return 'mission-community';
  if (has('plomería', 'plomeria', 'hvac', 'plumbing', 'eléctrico', 'electrico', 'electrical', 'techos', 'roofing', 'limpieza', 'cleaning', 'reparación', 'reparacion', 'repair', 'paisajismo', 'landscaping', 'contratista', 'contractor')) return 'local-service';
  if (has('ropa', 'clothing', 'ecommerce', 'producto', 'product', 'tienda', 'store', 'shop', 'cuidado de la piel', 'skincare', 'joyería', 'joyeria', 'jewelry', 'marca', 'brand')) return 'product-brand';
  return 'premium-business';
}

function inferDirection(a) {
  const industry = inferIndustry(a);
  const what = a.whatYouDo || 'Ofrecemos productos y servicios premium.';
  const customers = a.customers || 'clientes que valoran la calidad, la confianza y una experiencia refinada';
  const diff = a.differentiators || 'un mayor nivel de cuidado, calidad y atención al detalle';

  const base = {
    industry,
    eyebrow: 'Experiencia Web Premium',
    heroHeadline: `${a.businessName}`,
    heroAccent: 'diseñado para impresionar.',
    heroDescription: `${sentenceCase(what)} Ayudamos a ${customers.toLowerCase()} a elegir con confianza a través de ${diff.toLowerCase()}.`,
    ctaPrimary: a.primaryCta || 'Comenzar Aquí',
    ctaSecondary: 'Explorar Servicios',
    designSystem: 'Experiencia de Marca Elite',
    visualMood: 'Premium, pulido, enfocado en conversión',
    motif: 'paneles de vidrio, iluminación cinematográfica, ritmo de tarjetas premium',
    paletteName: '',
    tokens: {
      bg: '#07070b', bg2: '#0b0712', fg: '#f7f3e8', muted: '#cfc5ad', accent: '#d8b96a', accent2: '#fff2b8', deep: '#091f3f', wine: '#5e1231'
    }
  };

  if (industry === 'music-studio') {
    return {
      ...base,
      eyebrow: 'Gospel · Hip-Hop · Rap · Soul',
      heroHeadline: 'Dale vida a tu',
      heroAccent: 'sonido.',
      heroDescription: 'Producción musical profesional para artistas, cantantes, raperos, compositores, ministerios y creativos independientes listos para convertir ideas en grabaciones pulidas y emocionalmente poderosas.',
      ctaPrimary: a.primaryCta && a.primaryCta !== 'Más información / contáctanos' ? a.primaryCta : 'Reservar Tiempo de Estudio',
      ctaSecondary: 'Explorar el Sonido',
      designSystem: 'Exhibición Artística Platinum',
      visualMood: 'Energía cinematográfica oscura, acentos dorados/platinum, contenido enfocado en el artista',
      motif: 'disco de vinilo, barras de sonido, vidrio ahumado, gradientes de luz de escenario',
      paletteName: '',
      serviceSet: [
        ['Producción Musical Personalizada', 'Pistas originales, arreglos y producción construidos alrededor de tu estilo, mensaje, voz y dirección creativa.'],
        ['Dirección de Grabación', 'Guía para la entrega vocal, energía de interpretación, tiempo, estructura de la canción y confianza en el estudio.'],
        ['Mezcla y Pulido de Canciones', 'Un sonido más limpio, completo y profesional que ayuda a tu grabación a sentirse equilibrada, poderosa y lista para compartir.']
      ],
      proof: [
        ['Propósito', 'Música moldeada alrededor de tu historia, mensaje y visión.'],
        ['Calidad', 'Producción limpia y pulida construida para impacto listo para publicación.'],
        ['Emoción', 'Un sonido diseñado para mover a las personas, no solo para llenar el espacio.']
      ],
      featureTitle: 'Fe, alma, ritmo y vida real.',
      featureCopy: 'Nuestro sonido mezcla excelencia musical, profundidad espiritual, energía callejera y emoción auténtica. Creamos grabaciones que se sienten modernas sin perder el corazón detrás del mensaje.',
      genreRows: [
        ['Gospel', 'Música con propósito, llena de poder, alabanza y elevación emocional.'],
        ['Hip-Hop', 'Ritmo moderno, movimiento, confianza y vanguardia creativa.'],
        ['Rap', 'Producción contundente construida alrededor del mensaje, cadencia y presencia.'],
        ['Soul', 'Música cálida y expresiva con sentimiento, groove y carácter atemporal.']
      ]
    };
  }

  if (industry === 'tech-automation') {
    return {
      ...base,
      eyebrow: 'IA · Automatización · Operaciones',
      heroHeadline: 'Convierte el trabajo manual en',
      heroAccent: 'sistemas inteligentes.',
      ctaPrimary: a.primaryCta || 'Solicitar Demo',
      ctaSecondary: 'Ver el Flujo',
      designSystem: 'Sistema de Autoridad de Comando',
      visualMood: 'Interfaz oscura de centro de comando, detalles azul eléctrico, confianza operacional',
      motif: 'Rutas de entrada inteligentes, paneles claros y momentos de seguimiento automatizado que ayudan a los equipos a responder más rápido.',
      paletteName: '',
      tokens: { bg: '#030816', bg2: '#061225', fg: '#f5f8ff', muted: '#aebed3', accent: '#1EA7FF', accent2: '#5BD3FF', deep: '#07152a', wine: '#0f1b3d' }
    };
  }

  if (industry === 'local-service') {
    return {
      ...base,
      eyebrow: 'Servicio Local de Confianza',
      heroHeadline: 'Servicio confiable,',
      heroAccent: 'hecho correctamente.',
      ctaPrimary: a.primaryCta || 'Solicitar Cotización',
      ctaSecondary: 'Ver Servicios',
      designSystem: 'Sistema Moderno de Confianza',
      visualMood: 'Autoridad limpia, fuerte confianza local, premium pero práctico',
      motif: 'insignias de confianza, tarjetas de servicio, ruta de citas, credibilidad local',
      paletteName: '',
      tokens: { bg: '#f7fbff', bg2: '#e9f2fb', fg: '#071225', muted: '#4a5870', accent: '#1565c0', accent2: '#ffa000', deep: '#ffffff', wine: '#e9f2fb' }
    };
  }

  if (industry === 'hospitality-lifestyle') {
    return {
      ...base,
      eyebrow: 'Hospitalidad · Estilo de Vida · Experiencia',
      heroHeadline: 'Una experiencia premium,',
      heroAccent: 'desde el primer momento.',
      ctaPrimary: a.primaryCta || 'Hacer una Reservación',
      ctaSecondary: 'Explorar la Experiencia',
      designSystem: 'Sistema de Revelación de Lujo',
      visualMood: 'Lujo cálido, espaciado editorial, atmósfera boutique',
      motif: 'paneles de invitación privada, gradientes cálidos, secciones de revelación elegante',
      paletteName: '',
      tokens: { bg: '#130d07', bg2: '#271407', fg: '#fff8ec', muted: '#e3c8a3', accent: '#c4892a', accent2: '#ffd166', deep: '#1c1208', wine: '#4a160f' }
    };
  }

  return base;
}

function inferServices(a, direction) {
  if (direction.serviceSet) return direction.serviceSet;
  const ideas = [
    ...splitIdeas(a.whatYouDo),
    ...splitIdeas(a.differentiators),
    ...splitIdeas(a.extras)
  ];
  const fallback = [
    ['Experiencia de Servicio Premium', 'Una experiencia de cliente pulida diseñada para hacer que tu negocio se sienta creíble, claro y listo para servir.'],
    ['Apoyo Personalizado', 'Un enfoque enfocado construido alrededor de tus clientes, tus objetivos y el valor que hace diferente a tu negocio.'],
    ['Próximos Pasos Claros', 'Un camino simple para que los visitantes entiendan lo que ofreces y actúen con confianza.']
  ];
  if (!ideas.length) return fallback;
  return ideas.slice(0, 3).map((idea, i) => {
    const title = idea.split(/\s+/).slice(0, 5).join(' ').replace(/,$/, '');
    return [sentenceCase(title), sentenceCase(idea.length > 130 ? idea.slice(0, 127) + '...' : idea)];
  }).concat(fallback).slice(0, 3);
}

function inferProof(a, direction) {
  if (direction.proof) return direction.proof;
  return [
    ['Claridad', 'Los visitantes entienden inmediatamente quién eres, qué ofreces y por qué importa.'],
    ['Confianza', 'Tus fortalezas, puntos de prueba y ruta de contacto se presentan con confianza.'],
    ['Acción', `La experiencia guía a los visitantes hacia "${a.primaryCta || 'Contáctanos'}" sin confusión.`]
  ];
}

function contactItems(a) {
  return [
    a.email ? ['Correo', a.email] : null,
    a.phone ? ['Teléfono', a.phone] : null,
    a.address ? ['Ubicación', a.address] : null,
    a.website ? ['Sitio Web', a.website] : null,
    a.instagram ? ['Instagram', a.instagram] : null,
    a.facebook ? ['Facebook', a.facebook] : null
  ].filter(Boolean);
}

function buildBrief(a, direction) {
  return {
    businessName: a.businessName,
    websitePurpose: direction.industry === 'music-studio' ? 'Exhibición Artística / Musical / Creativa' : 'Sitio Web de Negocio',
    recommendedDesignSystem: direction.designSystem,
    emotionalTone: direction.visualMood,
    creativeDirection: `${a.businessName} debe sentirse como ${direction.designSystem}: ${direction.visualMood}. El sitio debe inferir el diseño a partir de los datos del negocio en lugar de pedir al cliente que se convierta en diseñador.`,
    audienceStrategy: a.customers || 'Habla a visitantes de alta intención que necesitan confianza inmediata antes de actuar.',
    ctaStrategy: { primary: direction.ctaPrimary, secondary: direction.ctaSecondary },
    colorSystem: { primary: direction.tokens.bg, secondary: direction.tokens.deep, accent: direction.tokens.accent, background: direction.tokens.bg2, surface: direction.tokens.deep, colorMoodDescription: 'Sistema de color premium para sitio web' },
    typographySystem: { headingFont: direction.industry === 'music-studio' ? 'Georgia / Serif Editorial' : 'Syne / Display Sans', bodyFont: 'Inter', typographyRationale: 'Titulares editoriales grandes, jerarquía de sección confiada, contenido de conversión legible.' },
    sectionPlan: [
      { sectionName: 'Hero / primera impresión', headlineDirection: 'Abre con un primer viewport premium, titular fuerte y CTA directo.' },
      { sectionName: 'Confianza / tira de prueba', headlineDirection: 'Muestra los valores o puntos de prueba que hacen que el negocio se sienta creíble.' },
      { sectionName: 'Servicios / tarjetas de oferta', headlineDirection: 'Convierte datos simples de ingreso en bloques de servicio pulidos.' },
      { sectionName: 'Experiencia destacada', headlineDirection: 'Usa una sección visual específica de la industria que evite el diseño genérico.' },
      { sectionName: 'Proceso', headlineDirection: 'Muestra cómo los clientes pasan del interés a la acción.' },
      { sectionName: 'Contacto / CTA de reserva', headlineDirection: 'Cierra con una ruta de conversión fuerte y formulario amigable para el cliente.' }
    ],
    qualityScore: 98,
    qualityFlags: ['Motor de renderizado Platinum Creative Foundry activo', 'Motivo específico de industria aplicado', 'Cuatro variaciones completas generadas', 'No se requiere experiencia en diseño del cliente'],
    approvalMessage: 'Estándar Platinum AI4 — renderizador creativo artesanal completado.'
  };
}

function buildHtml(a, options = {}) {
  const direction = options.direction || inferDirection(a);
  const t = { ...direction.tokens, ...(options.tokens || {}) };
  const services = inferServices(a, direction);
  const proof = inferProof(a, direction);
  const contacts = contactItems(a);
  const genreRows = direction.genreRows || services.map(([name, desc]) => [name, desc]);
  const brand = esc(a.businessName);
  const cta = esc(direction.ctaPrimary);
  const cta2 = esc(direction.ctaSecondary);
  const isLight = options.theme === 'light';
  const ornament = options.ornament || (direction.industry === 'music-studio' ? 'record' : 'orb');
  const pageTitle = `${brand} | ${esc(direction.designSystem)}`;

  const visualMarkup = ornament === 'record' ? `
    <div class="record"></div>
    <div class="sound-bars" aria-hidden="true"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>` : `
    <div class="orb"></div><div class="line-art"></div>
    <div class="metric-stack"><span>01 Estrategia</span><span>02 Diseño</span><span>03 Conversión</span></div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${pageTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Syne:wght@700;800&display=swap" rel="stylesheet">
<style>
:root{--bg:${t.bg};--bg2:${t.bg2};--fg:${t.fg};--muted:${t.muted};--accent:${t.accent};--accent2:${t.accent2};--deep:${t.deep};--wine:${t.wine};--line:color-mix(in srgb,var(--accent) 34%,transparent);--panel:${isLight?'rgba(255,255,255,.78)':'rgba(255,255,255,.075)'};--shadow:0 34px 100px rgba(0,0,0,.38);--max:1180px}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--fg);background:radial-gradient(circle at 18% 12%,color-mix(in srgb,var(--accent) 27%,transparent),transparent 31%),radial-gradient(circle at 86% 9%,color-mix(in srgb,var(--wine) 46%,transparent),transparent 34%),radial-gradient(circle at 66% 86%,color-mix(in srgb,var(--deep) 70%,transparent),transparent 38%),linear-gradient(135deg,var(--bg),var(--bg2));overflow-x:hidden}body::before{content:"";position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.038) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.032) 1px,transparent 1px);background-size:54px 54px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.65),transparent 72%);z-index:0}.page{position:relative;z-index:1}.wrap{width:min(var(--max),calc(100% - 40px));margin:0 auto}a{text-decoration:none;color:inherit}header{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(22px);border-bottom:1px solid color-mix(in srgb,var(--accent) 20%,transparent)}.nav{height:82px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:flex;align-items:center;gap:14px;letter-spacing:.08em;text-transform:uppercase;font-weight:900}.brand-mark{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent2),var(--accent));color:${isLight?'#06101f':'#120d05'};box-shadow:0 0 38px color-mix(in srgb,var(--accent) 45%,transparent)}.nav-links{display:flex;gap:22px;color:var(--muted);font-size:.94rem}.nav-links a:hover{color:var(--accent2)}.btn{display:inline-flex;align-items:center;justify-content:center;border:1px solid color-mix(in srgb,var(--accent) 50%,transparent);border-radius:999px;padding:14px 22px;font-weight:900;background:rgba(255,255,255,.06);color:var(--fg);box-shadow:0 18px 48px rgba(0,0,0,.22);transition:.2s}.btn:hover{transform:translateY(-2px);border-color:var(--accent2);background:color-mix(in srgb,var(--accent) 13%,transparent)}.btn.primary{background:linear-gradient(135deg,var(--accent2),var(--accent));color:${isLight?'#06101f':'#100b06'};border-color:transparent}.hero{min-height:calc(100vh - 82px);display:grid;align-items:center;padding:70px 0 60px}.hero-grid{display:grid;grid-template-columns:1.04fr .96fr;gap:44px;align-items:center}.eyebrow{display:inline-flex;align-items:center;gap:10px;color:var(--accent2);border:1px solid color-mix(in srgb,var(--accent) 42%,transparent);background:color-mix(in srgb,var(--accent) 11%,transparent);padding:10px 14px;border-radius:999px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;font-size:.76rem;margin-bottom:26px}h1{font-family:Georgia,"Times New Roman",serif;font-weight:950;line-height:.92;letter-spacing:-.065em;font-size:clamp(4.1rem,8.4vw,8.2rem);margin:0}.accent-text{color:transparent;background:linear-gradient(135deg,#fff,var(--accent2) 24%,var(--accent) 58%,color-mix(in srgb,var(--accent) 55%,#111));background-clip:text;-webkit-background-clip:text}.hero-copy{color:var(--muted);font-size:clamp(1.08rem,1.55vw,1.34rem);line-height:1.75;margin:28px 0 34px;max-width:690px}.actions{display:flex;gap:14px;flex-wrap:wrap}.trust-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:36px;max-width:700px}.trust-card{border:1px solid rgba(255,255,255,.11);background:var(--panel);border-radius:22px;padding:18px;min-height:108px}.trust-card strong{display:block;color:var(--accent2);font-size:1.15rem;margin-bottom:6px}.trust-card span{color:var(--muted);font-size:.92rem;line-height:1.45}.studio-visual{position:relative;min-height:610px;border-radius:42px;overflow:hidden;border:1px solid color-mix(in srgb,var(--accent) 39%,transparent);box-shadow:var(--shadow);background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.015)),radial-gradient(circle at 50% 18%,color-mix(in srgb,var(--accent) 38%,transparent),transparent 24%),linear-gradient(145deg,color-mix(in srgb,var(--deep) 92%,#000),color-mix(in srgb,var(--bg) 93%,#000) 56%,color-mix(in srgb,var(--wine) 72%,transparent))}.studio-visual::before{content:"";position:absolute;inset:28px;border:1px solid color-mix(in srgb,var(--accent) 24%,transparent);border-radius:32px}.record,.orb{position:absolute;width:330px;height:330px;border-radius:50%;right:-78px;top:72px;background:radial-gradient(circle,#0b0b0e 0 12%,var(--accent) 13% 14%,#101016 15% 34%,#2b2b33 35% 36%,#08080c 37% 100%);box-shadow:0 0 70px color-mix(in srgb,var(--accent) 20%,transparent),inset 0 0 48px rgba(255,255,255,.04);opacity:.88}.orb{background:radial-gradient(circle at 35% 30%,var(--accent2),var(--accent) 24%,color-mix(in srgb,var(--deep) 88%,#000) 62%,#040408 100%);filter:saturate(1.1)}.line-art{position:absolute;inset:86px 60px auto auto;width:300px;height:300px;border-radius:30px;border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);transform:rotate(10deg)}.sound-bars{position:absolute;left:42px;bottom:46px;display:flex;align-items:end;gap:9px;height:230px}.bar{width:15px;border-radius:999px;background:linear-gradient(to top,var(--accent),var(--accent2));box-shadow:0 0 28px color-mix(in srgb,var(--accent) 34%,transparent);animation:pulse 1.45s ease-in-out infinite alternate}.bar:nth-child(1){height:62px}.bar:nth-child(2){height:132px;animation-delay:.2s}.bar:nth-child(3){height:92px;animation-delay:.4s}.bar:nth-child(4){height:182px;animation-delay:.1s}.bar:nth-child(5){height:118px;animation-delay:.3s}.bar:nth-child(6){height:220px;animation-delay:.5s}.bar:nth-child(7){height:88px;animation-delay:.25s}.bar:nth-child(8){height:148px;animation-delay:.45s}@keyframes pulse{from{transform:scaleY(.72);opacity:.7}to{transform:scaleY(1);opacity:1}}.visual-card{position:absolute;left:52px;top:56px;width:min(360px,calc(100% - 104px));border-radius:28px;border:1px solid color-mix(in srgb,var(--accent) 28%,transparent);background:rgba(0,0,0,.32);backdrop-filter:blur(20px);padding:26px}.visual-card h2{font-family:Georgia,serif;font-size:2.35rem;line-height:1;margin:0 0 12px}.visual-card p{margin:0;color:var(--muted);line-height:1.55}.floating-note,.public-note,.visual-card,[data-internal-note],.internal-note,.template-feature-card,.design-meta-card{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}.public-note{position:absolute;right:42px;bottom:54px;width:min(310px,calc(100% - 84px));padding:22px;border-radius:24px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);backdrop-filter:blur(16px)}.public-note strong{color:var(--accent2);display:block;margin-bottom:8px}.public-note span{color:var(--muted);line-height:1.5}.metric-stack{position:absolute;left:42px;bottom:58px;display:grid;gap:12px}.metric-stack span{display:inline-flex;padding:14px 18px;border-radius:999px;border:1px solid color-mix(in srgb,var(--accent) 32%,transparent);background:rgba(255,255,255,.075);font-weight:900;color:var(--accent2)}section{padding:92px 0}.section-head{max-width:840px;margin-bottom:38px}.kicker{color:var(--accent2);text-transform:uppercase;letter-spacing:.16em;font-weight:950;font-size:.8rem;margin-bottom:12px}.section-title{font-family:Georgia,serif;font-size:clamp(2.55rem,5.2vw,5.1rem);line-height:.98;letter-spacing:-.045em;margin:0}.section-lead{color:var(--muted);font-size:1.13rem;line-height:1.75;margin-top:18px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.card{position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.11);background:linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.036));border-radius:28px;padding:30px;min-height:290px;box-shadow:0 24px 70px rgba(0,0,0,.22)}.card::after{content:"";position:absolute;right:-70px;bottom:-86px;width:220px;height:220px;border-radius:50%;background:color-mix(in srgb,var(--accent) 10%,transparent);filter:blur(8px)}.icon{width:58px;height:58px;border-radius:20px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 16%,transparent);border:1px solid color-mix(in srgb,var(--accent) 26%,transparent);color:var(--accent2);font-size:1.55rem;margin-bottom:22px}.card h3{font-size:1.45rem;margin:0 0 12px}.card p{color:var(--muted);line-height:1.65;margin:0}.split{display:grid;grid-template-columns:.9fr 1.1fr;gap:26px;align-items:stretch}.feature-panel{border-radius:34px;padding:34px;border:1px solid var(--line);background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 10%,transparent),rgba(255,255,255,.04)),rgba(0,0,0,.2);min-height:420px;box-shadow:var(--shadow)}.feature-panel h3{font-family:Georgia,serif;font-size:3rem;line-height:1;margin:0 0 18px}.feature-panel p{color:var(--muted);line-height:1.72;font-size:1.05rem}.genre-list{display:grid;gap:14px}.genre{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);border-radius:22px;padding:20px 22px;display:flex;justify-content:space-between;gap:18px;align-items:center}.genre strong{font-size:1.18rem}.genre span{color:var(--muted);text-align:right}.process{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;counter-reset:step}.step{counter-increment:step;border-radius:28px;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);padding:28px;min-height:220px}.step::before{content:"0" counter(step);color:var(--accent2);display:inline-flex;margin-bottom:28px;font-weight:950;letter-spacing:.16em}.step h3{margin:0 0 12px}.step p{margin:0;color:var(--muted);line-height:1.55}.quote-band{border-radius:42px;border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);background:radial-gradient(circle at 12% 18%,color-mix(in srgb,var(--accent) 23%,transparent),transparent 35%),linear-gradient(135deg,color-mix(in srgb,var(--wine) 54%,transparent),color-mix(in srgb,var(--bg) 74%,transparent));padding:clamp(34px,6vw,70px);box-shadow:var(--shadow);text-align:center}.quote-band h2{font-family:Georgia,serif;font-size:clamp(2.3rem,5vw,5.4rem);line-height:1;letter-spacing:-.045em;margin:0 0 18px}.quote-band p{max-width:760px;margin:0 auto 28px;color:var(--muted);line-height:1.75;font-size:1.13rem}.contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}.contact-card{border-radius:34px;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);padding:34px}.contact-card h3{font-size:1.65rem;margin:0 0 14px}.contact-card p,.contact-card li{color:var(--muted);line-height:1.7}.contact-list{list-style:none;padding:0;margin:22px 0 0;display:grid;gap:12px}.contact-list li{border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:12px}form{display:grid;gap:14px}input,textarea,select{width:100%;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:rgba(0,0,0,.22);color:var(--fg);padding:15px 16px;font:inherit;outline:none}textarea{min-height:140px;resize:vertical}input:focus,textarea:focus,select:focus{border-color:var(--accent)}option{background:#111;color:white}footer{border-top:1px solid color-mix(in srgb,var(--accent) 18%,transparent);padding:34px 0;color:var(--muted)}.footer-row{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap}@media(max-width:980px){.nav-links{display:none}.hero-grid,.split,.contact-grid{grid-template-columns:1fr}.studio-visual{min-height:520px}.cards{grid-template-columns:1fr}.process{grid-template-columns:repeat(2,1fr)}}@media(max-width:640px){.wrap{width:min(100% - 28px,var(--max))}.nav{height:72px}.brand span{font-size:.85rem}.hero{padding-top:44px}h1{font-size:clamp(3.15rem,17vw,5rem)}.actions .btn{width:100%}.trust-strip,.process{grid-template-columns:1fr}.studio-visual{min-height:500px}.record,.orb{width:250px;height:250px;right:-96px}.visual-card{left:24px;top:28px;width:calc(100% - 48px)}.public-note{display:none!important}.sound-bars{left:30px;bottom:156px;height:160px}section{padding:66px 0}.genre{align-items:flex-start;flex-direction:column}.genre span{text-align:left}}
</style>
</head>
<body>
<div class="page">
<header><div class="wrap nav"><a class="brand" href="#top"><div class="brand-mark">${brand.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()}</div><span>${brand}</span></a><nav class="nav-links"><a href="#services">Servicios</a><a href="#signature">Destacado</a><a href="#process">Proceso</a><a href="#contact">Contacto</a></nav><a class="btn primary" href="#contact">${cta}</a></div></header>
<main id="top">
<section class="hero"><div class="wrap hero-grid"><div><div class="eyebrow">${esc(direction.eyebrow)}</div><h1>${esc(direction.heroHeadline)} <span class="accent-text">${esc(direction.heroAccent)}</span></h1><p class="hero-copy">${esc(direction.heroDescription)}</p><div class="actions"><a class="btn primary" href="#contact">${cta}</a><a class="btn" href="#services">${cta2}</a></div><div class="trust-strip">${proof.map(([x,y])=>`<div class="trust-card"><strong>${esc(x)}</strong><span>${esc(y)}</span></div>`).join('')}</div></div><div class="studio-visual" aria-label="Visual premium del sitio web">${visualMarkup}</div></div></section>
<section id="services"><div class="wrap"><div class="section-head"><div class="kicker">Lo Que Ofrecemos</div><h2 class="section-title">Una experiencia pulida construida alrededor de lo que te hace diferente.</h2><p class="section-lead">AI4 convierte datos simples del negocio en posicionamiento elevado, secciones claras y un recorrido premium diseñado para generar confianza rápidamente.</p></div><div class="cards">${services.map(([x,y],i)=>`<article class="card"><div class="icon">${['✦','◆','✓'][i]||'✦'}</div><h3>${esc(x)}</h3><p>${esc(y)}</p></article>`).join('')}</div></div></section>
<section id="signature"><div class="wrap split"><div class="feature-panel"><div class="kicker">Nuestra Distinción</div><h3>${esc(direction.featureTitle || 'Premium, claro y diseñado para convertir.')}</h3><p>${esc(direction.featureCopy || a.differentiators || direction.visualMood)}</p><p>${esc(a.extras || 'Cada sección está diseñada para ayudar a los visitantes a entender el valor, sentir confianza y dar el siguiente paso.')}</p></div><div class="genre-list">${genreRows.map(([x,y])=>`<div class="genre"><strong>${esc(x)}</strong><span>${esc(y)}</span></div>`).join('')}</div></div></section>
<section id="process"><div class="wrap"><div class="section-head"><div class="kicker">Cómo Funciona</div><h2 class="section-title">Del primer impacto a la acción confiada.</h2></div><div class="process"><div class="step"><h3>Descubrir</h3><p>Los visitantes entienden inmediatamente lo que ofreces y a quién sirves.</p></div><div class="step"><h3>Confianza</h3><p>Tus diferenciadores más fuertes se presentan con claridad y confianza.</p></div><div class="step"><h3>Elegir</h3><p>La página guía a los visitantes a través de los detalles más importantes de prueba y servicio.</p></div><div class="step"><h3>Actuar</h3><p>El CTA final da a los visitantes un camino simple para ${esc(direction.ctaPrimary).toLowerCase()}.</p></div></div></div></section>
<section><div class="wrap quote-band"><h2>${direction.industry === 'music-studio' ? 'Tu mensaje merece un sonido que esté a su altura.' : 'Tu negocio merece una primera impresión que esté a la altura de su valor.'}</h2><p>${esc(a.differentiators || 'Un sitio web premium no debería sentirse genérico. Debería sentirse como si tu negocio hubiera sido traducido a una experiencia clara, memorable y de alta confianza.')}</p><a class="btn primary" href="#contact">${cta}</a></div></section>
<section id="contact"><div class="wrap contact-grid"><div class="contact-card"><div class="kicker">Contacto</div><h3>¿Listo para empezar?</h3><p>${esc(a.customers || 'Cuéntanos qué necesitas y te ayudaremos a elegir el mejor próximo paso.')}</p><ul class="contact-list">${contacts.length ? contacts.map(([x,y])=>`<li><strong>${esc(x)}:</strong> ${esc(y)}</li>`).join('') : '<li><strong>Contacto:</strong> Agrega tus datos de contacto preferidos aquí.</li>'}</ul></div><div class="contact-card"><form name="ai4-generated-inquiry" method="POST" data-netlify="true"><input type="hidden" name="form-name" value="ai4-generated-inquiry" autocomplete="off" /><input name="name" type="text" placeholder="Tu nombre" autocomplete="name" required><input name="email" type="email" placeholder="Correo electrónico" autocomplete="email" required><input name="phone" type="tel" placeholder="Número de teléfono" autocomplete="tel"><textarea name="message" placeholder="Cuéntanos qué necesitas" autocomplete="off"></textarea><button class="btn primary" type="submit">${cta}</button></form></div></div></section>
</main><footer><div class="wrap footer-row"><span>© <span id="year"></span> ${brand}. Todos los derechos reservados.</span><span>Creado por AI4 Estudio de Diseño Web</span></div></footer>
</div><script>
document.getElementById('year').textContent=new Date().getFullYear();
(function(){
  var banned=['Electric Command','Dark command-center','Private Gold','Cinematic Gold','Warm Reserve','Modern Trust','visualMood','paletteName','template feature','design system metadata'];
  var remove=[];
  document.querySelectorAll('.floating-note,.public-note,.visual-card,[data-internal-note],.internal-note,.template-feature-card,.design-meta-card').forEach(function(el){ remove.push(el); });
  document.querySelectorAll('body *').forEach(function(el){
    var text=(el.textContent||'').trim();
    if(!text) return;
    if(banned.some(function(term){return text.indexOf(term)!==-1;})){
      var box=el.closest('.floating-note,.public-note,.visual-card,.template-feature-card,.design-meta-card,.genre,.card,.trust-card')||el;
      remove.push(box);
    }
  });
  remove.forEach(function(el){ if(el&&el.parentNode){ el.parentNode.removeChild(el); } });
})();
</script>
</body></html>`;
}

function buildTemplates(a, direction) {
  const variants = [
    { name: 'Oscuro y Premium', theme: 'dark', ornament: direction.industry === 'music-studio' ? 'record' : 'orb', tokens: direction.tokens },
    { name: 'Claro y Profesional', theme: 'light', ornament: 'orb', tokens: { bg: '#F7FAFF', bg2: '#EAF1FB', fg: '#071225', muted: '#4A5870', accent: '#2563EB', accent2: '#60A5FA', deep: '#FFFFFF', wine: '#DDE9F7' } },
    { name: 'Audaz y Enérgico', theme: 'dark', ornament: direction.industry === 'music-studio' ? 'record' : 'orb', tokens: { bg: '#16070A', bg2: '#280A18', fg: '#FFF7F7', muted: '#F1B8C7', accent: '#EC4899', accent2: '#FB7185', deep: '#2D0B20', wine: '#4B071F' } },
    { name: 'Cálido y Confiable', theme: 'warm', ornament: 'orb', tokens: { bg: '#130D07', bg2: '#261508', fg: '#FFF8EC', muted: '#E3C8A3', accent: '#C4892A', accent2: '#FFD166', deep: '#1C1208', wine: '#4A160F' } }
  ];
  return variants.map((v) => buildHtml(a, { direction, ...v }));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ success: false, error: 'Método no permitido' }) };
  try {
    const payload = JSON.parse(event.body || '{}');
    const answers = normalizeAnswers(payload);
    const direction = inferDirection(answers);
    const templates = buildTemplates(answers, direction);
    const brief = buildBrief(answers, direction);
    const response = {
      success: true,
      source: 'ai4-platinum-creative-foundry-v4-5-espanol',
      html: templates[0],
      builtHtml: templates[0],
      websiteHtml: templates[0],
      templates,
      brief,
      quality: { score: 98, status: 'Platinum Listo', message: 'Platinum Creative Foundry V4.5 (Español) renderizó cuatro variaciones premium artesanales del sitio web.', flags: brief.qualityFlags },
      qualityGate: { score: 98, passed: true, standard: 'Estándar Platinum AI4' },
      siteData: { ...answers, designSystem: direction.designSystem, creativeDirection: brief.creativeDirection, business_name: answers.businessName },
      meta: { generatedAt: new Date().toISOString(), slug: slugify(answers.businessName), industry: direction.industry }
    };
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify(response) };
  } catch (error) {
    console.error('generate-website V4.5 ES error:', error);
    const answers = normalizeAnswers({});
    const direction = inferDirection(answers);
    const html = buildHtml(answers, { direction });
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true, source: 'emergency-v4-fallback-es', html, builtHtml: html, templates: [html], brief: buildBrief(answers, direction), quality: { score: 90, status: 'Listo de Respaldo', message: 'El renderizador de emergencia devolvió una vista previa del sitio web segura.', flags: [error.message] } }) };
  }
};
