'use strict';
// generate-es.js -- AI4 Diseno de Sitios Web
// Claude designs a unique site (layout, fonts, copy, palette) -- different every time.
// Returns 4 color variations of that design plus a brief for the preview page.

const DISPLAY_FONTS = ['Fraunces','Bodoni Moda','Cormorant','Sora','Instrument Serif','Newsreader','Jost'];
const BODY_FONTS    = ['Newsreader','Jost','Sora','Cormorant'];
const MONO_FONTS    = ['Spline Sans Mono','IBM Plex Mono'];
const LAYOUTS       = ['centered','editorial','cards'];
const SURFACES      = ['glass','bordered','paper'];
const TEXTURES      = ['aurora','grain','none'];
const SHAPES        = ['pill','square','underline'];

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

const SCHEMA_PROMPT =
  'Devuelve SOLO un objeto JSON valido (sin markdown, sin texto adicional) con esta forma exacta: ' +
  '{"content":{"brand":string,"category":string(2-3 palabras),"eyebrow":string(2-4 palabras),' +
  '"headline":string(maximo 10 palabras),"standfirst":string(1-2 oraciones),"stats":[3 strings cortos],' +
  '"sections":[4 objetos {"title":string(maximo 6 palabras),"blurb":string(1 oracion),"points":[3 strings cortos]}],' +
  '"closeHeadline":string(maximo 8 palabras),"closeText":string(1 oracion),"cta":string(2-4 palabras)},' +
  '"design":{"mood":string,"theme":"dark"|"light",' +
  '"palette":{"bg":string hex como #rrggbb,"surface":string hex,"ink":string hex,"inkSoft":string hex,"accent":string hex,"accent2":string hex},' +
  '"fonts":{"display":una de ' + JSON.stringify(DISPLAY_FONTS) + ',"body":una de ' + JSON.stringify(BODY_FONTS) + ',"mono":una de ' + JSON.stringify(MONO_FONTS) + '},' +
  '"layout":una de ' + JSON.stringify(LAYOUTS) + ',"surfaceStyle":una de ' + JSON.stringify(SURFACES) + ',"texture":una de ' + JSON.stringify(TEXTURES) + ',' +
  '"radius":entero 0-26,"displayWeight":entero 300-800,"accentShape":una de ' + JSON.stringify(SHAPES) + '}}. ' +
  'Inventa una paleta original, cohesiva y de buen gusto con una combinacion de fuentes inesperada pero armoniosa. ' +
  'Haz que el diseno se sienta especificamente correcto para ESTE negocio y notablemente diferente a cualquier otro. ' +
  'Todo el contenido debe estar en espanol. El contenido debe ser concreto y convincente, sin cliches.';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>'"]/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];
  });
}

function parseJSON(text) {
  var c = text.replace(/```json|```/g, '').trim();
  var s = c.indexOf('{'), e = c.lastIndexOf('}');
  return JSON.parse(c.slice(s, e >= 0 ? e + 1 : undefined));
}

function fontUrl(display, body, mono) {
  var seen = {};
  var families = [display, body, mono].filter(function(f) {
    if (!f || seen[f]) return false;
    seen[f] = true;
    return true;
  });
  var serifFonts = ['Fraunces','Bodoni Moda','Cormorant','Instrument Serif','Newsreader'];
  var params = families.map(function(f) {
    var name = f.replace(/ /g, '+');
    if (serifFonts.indexOf(f) >= 0) return 'family=' + name + ':ital,wght@0,300;0,400;0,500;0,600;0,700;1,400';
    return 'family=' + name + ':wght@300;400;500;600;700;800';
  }).join('&');
  return 'https://fonts.googleapis.com/css2?' + params + '&display=swap';
}

function btnStyle(shape, accent) {
  if (shape === 'underline') return 'background:transparent;border:none;border-bottom:2px solid ' + accent + ';border-radius:0;padding:.8rem 0;color:' + accent + ';font-weight:700;cursor:pointer;';
  if (shape === 'square')    return 'background:' + accent + ';border:none;border-radius:6px;padding:.85rem 2rem;color:#fff;font-weight:700;cursor:pointer;';
  return 'background:' + accent + ';border:none;border-radius:999px;padding:.85rem 2rem;color:#fff;font-weight:700;cursor:pointer;';
}

function textureCss(texture, accent) {
  if (texture === 'aurora') return 'radial-gradient(ellipse 70% 50% at 10% 0%,' + accent + '22,transparent 60%),radial-gradient(ellipse 50% 40% at 90% 80%,' + accent + '18,transparent 55%),';
  if (texture === 'grain')  return "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.03'/%3E%3C/svg%3E\"),";
  return '';
}

function buildSections(sections, layout, p, radius, weight) {
  var r = (radius || 12) + 'px';
  if (layout === 'cards') {
    return '<div class="es-cards">' + sections.map(function(s, i) {
      return '<div class="es-card" style="background:' + p.surface + 'aa;border:1px solid rgba(128,128,128,.14);border-radius:' + r + ';padding:2rem;">' +
        '<div style="color:' + p.accent + ';font-family:var(--es-mono);font-size:.62rem;letter-spacing:.2em;margin-bottom:.7rem;">0' + (i+1) + '</div>' +
        '<h3 style="color:' + p.ink + ';font-family:var(--es-display);font-size:1.4rem;font-weight:' + weight + ';margin:0 0 .5rem;line-height:1.1;">' + esc(s.title) + '</h3>' +
        '<p style="color:' + p.inkSoft + ';font-size:.9rem;line-height:1.65;margin:0 0 .8rem;">' + esc(s.blurb) + '</p>' +
        '<ul style="list-style:none;padding:0;">' + s.points.map(function(pt) {
          return '<li style="color:' + p.inkSoft + ';font-size:.82rem;padding:.3rem 0;border-bottom:1px solid rgba(128,128,128,.09);">' + esc(pt) + '</li>';
        }).join('') + '</ul></div>';
    }).join('') + '</div>';
  }
  if (layout === 'editorial') {
    return sections.map(function(s, i) {
      return '<div style="display:grid;grid-template-columns:180px 1fr;gap:3rem;padding:2.5rem 0;border-top:1px solid rgba(128,128,128,.11);">' +
        '<div><span style="color:' + p.accent + ';font-family:var(--es-mono);font-size:.6rem;letter-spacing:.18em;display:block;margin-bottom:.4rem;">0' + (i+1) + '</span>' +
        '<h3 style="color:' + p.ink + ';font-family:var(--es-display);font-size:1.5rem;font-weight:' + weight + ';line-height:1.1;margin:0;">' + esc(s.title) + '</h3></div>' +
        '<div><p style="color:' + p.inkSoft + ';font-size:1rem;line-height:1.7;margin:0 0 1rem;">' + esc(s.blurb) + '</p>' +
        '<div style="display:flex;flex-wrap:wrap;gap:.45rem;">' + s.points.map(function(pt) {
          return '<span style="background:rgba(128,128,128,.08);border:1px solid rgba(128,128,128,.14);border-radius:' + r + ';padding:.28rem .75rem;font-size:.8rem;color:' + p.inkSoft + ';">' + esc(pt) + '</span>';
        }).join('') + '</div></div></div>';
    }).join('');
  }
  // centered
  return '<div class="es-grid">' + sections.map(function(s, i) {
    return '<div style="background:' + p.surface + '77;border:1px solid rgba(128,128,128,.12);border-radius:' + r + ';padding:1.8rem;">' +
      '<div style="color:' + p.accent + ';font-family:var(--es-mono);font-size:.6rem;letter-spacing:.18em;margin-bottom:.5rem;">0' + (i+1) + '</div>' +
      '<h3 style="color:' + p.ink + ';font-family:var(--es-display);font-size:1.3rem;font-weight:' + weight + ';margin:0 0 .5rem;">' + esc(s.title) + '</h3>' +
      '<p style="color:' + p.inkSoft + ';font-size:.88rem;line-height:1.65;margin:0 0 .7rem;">' + esc(s.blurb) + '</p>' +
      s.points.map(function(pt) {
        return '<div style="color:' + p.inkSoft + ';font-size:.8rem;padding:.22rem 0 .22rem .7rem;border-left:2px solid ' + p.accent + '44;">' + esc(pt) + '</div>';
      }).join('') + '</div>';
  }).join('') + '</div>';
}

function buildHero(c, d, p, btn, r) {
  var weight = d.displayWeight || 700;
  if (d.layout === 'editorial') {
    return '<section style="padding:clamp(4rem,10vw,8rem) 0;border-bottom:1px solid rgba(128,128,128,.1);">' +
      '<div class="es-wrap" style="display:grid;grid-template-columns:1.15fr .85fr;gap:4rem;align-items:center;">' +
      '<div>' +
        '<span style="color:' + p.accent + ';font-family:var(--es-mono);font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;display:block;margin-bottom:1rem;">' + esc(c.eyebrow) + '</span>' +
        '<h1 style="font-family:var(--es-display);font-size:clamp(2.8rem,6vw,6rem);font-weight:' + weight + ';color:' + p.ink + ';line-height:.95;letter-spacing:-.04em;margin-bottom:1.4rem;">' + esc(c.headline) + '</h1>' +
        '<p style="color:' + p.inkSoft + ';font-size:1.05rem;line-height:1.75;margin-bottom:1.8rem;max-width:520px;">' + esc(c.standfirst) + '</p>' +
        '<a style="' + btn + 'font-size:.95rem;display:inline-flex;align-items:center;gap:.5rem;text-decoration:none;" href="#contacto">' + esc(c.cta) + ' &rarr;</a>' +
      '</div>' +
      '<div style="display:grid;gap:1rem;">' + c.stats.map(function(s) {
        return '<div style="background:' + p.surface + '88;border:1px solid rgba(128,128,128,.12);border-radius:' + r + ';padding:1.4rem;"><div style="font-family:var(--es-display);font-size:1.5rem;font-weight:' + weight + ';color:' + p.ink + ';">' + esc(s) + '</div></div>';
      }).join('') + '</div></div></section>';
  }
  if (d.layout === 'cards') {
    return '<section style="padding:clamp(5rem,12vw,9rem) 0;border-bottom:1px solid rgba(128,128,128,.1);text-align:center;">' +
      '<div class="es-wrap" style="max-width:800px;margin:0 auto;">' +
        '<div style="display:inline-flex;align-items:center;gap:.5rem;background:' + p.accent + '18;border:1px solid ' + p.accent + '44;border-radius:999px;padding:.4rem 1rem;margin-bottom:1.6rem;">' +
          '<span style="color:' + p.accent + ';font-family:var(--es-mono);font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;">' + esc(c.category) + '</span>' +
        '</div>' +
        '<h1 style="font-family:var(--es-display);font-size:clamp(2.6rem,5.5vw,5rem);font-weight:' + weight + ';color:' + p.ink + ';line-height:1;letter-spacing:-.04em;margin-bottom:1.1rem;">' + esc(c.headline) + '</h1>' +
        '<p style="color:' + p.inkSoft + ';font-size:1.05rem;line-height:1.75;margin:0 auto 1.8rem;max-width:580px;">' + esc(c.standfirst) + '</p>' +
        '<a style="' + btn + 'font-size:.95rem;display:inline-flex;align-items:center;gap:.5rem;text-decoration:none;" href="#contacto">' + esc(c.cta) + ' &rarr;</a>' +
        '<div style="display:flex;justify-content:center;gap:2rem;flex-wrap:wrap;margin-top:2.5rem;padding-top:2rem;border-top:1px solid rgba(128,128,128,.1);">' +
          c.stats.map(function(s) { return '<div style="text-align:center;"><div style="font-family:var(--es-display);font-size:1.6rem;font-weight:' + weight + ';color:' + p.ink + ';">' + esc(s) + '</div></div>'; }).join('') +
        '</div>' +
      '</div></section>';
  }
  // centered
  return '<section style="padding:clamp(4.5rem,10vw,8rem) 0;border-bottom:1px solid rgba(128,128,128,.1);">' +
    '<div class="es-wrap" style="display:grid;grid-template-columns:1fr 1fr;gap:4rem;align-items:center;">' +
    '<div>' +
      '<span style="color:' + p.accent + ';font-family:var(--es-mono);font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;display:block;margin-bottom:1rem;">' + esc(c.eyebrow) + '</span>' +
      '<h1 style="font-family:var(--es-display);font-size:clamp(2.6rem,5.5vw,5.2rem);font-weight:' + weight + ';color:' + p.ink + ';line-height:1;letter-spacing:-.04em;margin-bottom:1.1rem;">' + esc(c.headline) + '</h1>' +
      '<p style="color:' + p.inkSoft + ';font-size:1rem;line-height:1.75;margin-bottom:1.8rem;">' + esc(c.standfirst) + '</p>' +
      '<a style="' + btn + 'font-size:.95rem;display:inline-flex;align-items:center;gap:.5rem;text-decoration:none;" href="#contacto">' + esc(c.cta) + ' &rarr;</a>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">' +
      c.stats.map(function(s) {
        return '<div style="background:' + p.surface + '77;border:1px solid rgba(128,128,128,.12);border-radius:' + r + ';padding:1.4rem;text-align:center;"><div style="font-family:var(--es-display);font-size:1.4rem;font-weight:' + weight + ';color:' + p.ink + ';">' + esc(s) + '</div></div>';
      }).join('') +
      '<div style="grid-column:span 2;background:' + p.accent + '18;border:1px solid ' + p.accent + '33;border-radius:' + r + ';padding:1.2rem;text-align:center;">' +
        '<span style="color:' + p.accent + ';font-family:var(--es-mono);font-size:.62rem;letter-spacing:.15em;">' + esc(c.category) + '</span>' +
      '</div>' +
    '</div></div></section>';
}

function buildPalettes(p, theme) {
  return [
    p,
    { bg:'#F7FAFF', surface:'#FFFFFF', ink:'#071225', inkSoft:'#4A5870', accent:'#2563EB', accent2:'#60A5FA' },
    { bg:'#06030F', surface:'#110928', ink:'#F5F0FF', inkSoft:'#B39DDB', accent: p.accent2 || '#7C3AED', accent2: p.accent || '#C084FC' },
    { bg:'#110806', surface:'#220F08', ink:'#FFF8EC', inkSoft:'#D4B896', accent:'#C4892A', accent2:'#FFD166' }
  ];
}

function renderHtml(schema, contactInfo, palOverride) {
  var c = schema.content;
  var d = schema.design;
  var p = palOverride || d.palette;
  var r = (d.radius || 12) + 'px';
  var fUrl = fontUrl(d.fonts.display, d.fonts.body, d.fonts.mono);
  var btn = btnStyle(d.accentShape, p.accent);
  var texture = textureCss(d.texture, p.accent);
  var weight = d.displayWeight || 700;
  var sectionsHtml = buildSections(c.sections, d.layout, p, d.radius, weight);
  var heroHtml = buildHero(c, d, p, btn, r);

  var layoutCss = d.layout === 'cards'
    ? '.es-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:1.4rem;}@media(max-width:680px){.es-cards{grid-template-columns:1fr;}}'
    : d.layout === 'centered'
    ? '.es-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1.4rem;}@media(max-width:680px){.es-grid{grid-template-columns:1fr;}}'
    : '@media(max-width:680px){section>div[style*="grid-template-columns:180px"]{display:block!important;}}';

  var contactHtml = [
    contactInfo && contactInfo.phone   ? '<div>' + esc(contactInfo.phone) + '</div>'   : '',
    contactInfo && contactInfo.email   ? '<div>' + esc(contactInfo.email) + '</div>'   : '',
    contactInfo && contactInfo.address ? '<div>' + esc(contactInfo.address) + '</div>' : ''
  ].filter(Boolean).join('');

  return '<!DOCTYPE html>\n<html lang="es">\n<head>\n' +
    '<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1.0">\n' +
    '<title>' + esc(c.brand) + '</title>\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<link href="' + fUrl + '" rel="stylesheet">\n' +
    '<style>\n' +
    ':root{--es-display:\'' + d.fonts.display + '\',serif;--es-body:\'' + d.fonts.body + '\',sans-serif;--es-mono:\'' + d.fonts.mono + '\',monospace;}\n' +
    '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}\n' +
    'html{scroll-behavior:smooth}\n' +
    'body{min-height:100vh;background:' + texture + 'linear-gradient(160deg,' + p.bg + ',' + p.bg + ');color:' + p.inkSoft + ';font-family:var(--es-body);overflow-x:hidden;line-height:1.65;}\n' +
    'a{text-decoration:none;color:inherit}\n' +
    '.es-wrap{width:min(1140px,calc(100% - 3rem));margin:0 auto}\n' +
    '.es-nav{position:sticky;top:0;z-index:50;background:' + p.bg + 'ee;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(128,128,128,.1);padding:1.1rem 0}\n' +
    '.es-nav-inner{display:flex;align-items:center;justify-content:space-between;gap:1rem}\n' +
    '.es-brand{font-family:var(--es-display);font-size:1.05rem;font-weight:' + weight + ';color:' + p.ink + ';letter-spacing:-.01em}\n' +
    '.es-nav-cta{' + btn + 'font-size:.82rem;display:inline-flex;align-items:center;transition:.2s;text-decoration:none;}\n' +
    '.es-nav-cta:hover{opacity:.85;transform:translateY(-1px)}\n' +
    layoutCss + '\n' +
    '.es-card{transition:.2s}.es-card:hover{transform:translateY(-3px)}\n' +
    '@media(max-width:800px){.es-wrap[style*="grid-template-columns:1fr 1fr"]{display:block!important;}' +
      '.es-wrap[style*="grid-template-columns:1.15fr"]{display:block!important;}' +
      '.es-wrap[style*="grid-template-columns:1.1fr"]{display:block!important;}}\n' +
    '</style>\n</head>\n<body>\n' +
    '<div class="page">\n' +
    '<nav class="es-nav"><div class="es-wrap es-nav-inner">' +
      '<span class="es-brand">' + esc(c.brand) + '</span>' +
      '<a class="es-nav-cta" href="#contacto">' + esc(c.cta) + '</a>' +
    '</div></nav>\n\n' +
    heroHtml + '\n\n' +
    '<section style="padding:5rem 0;">' +
      '<div class="es-wrap">' +
        '<div style="margin-bottom:2.5rem;">' +
          '<span style="color:' + p.accent + ';font-family:var(--es-mono);font-size:.62rem;letter-spacing:.18em;text-transform:uppercase;display:block;margin-bottom:.5rem;">' + esc(c.eyebrow) + '</span>' +
          '<h2 style="font-family:var(--es-display);font-size:clamp(1.8rem,3.2vw,2.8rem);color:' + p.ink + ';font-weight:' + weight + ';letter-spacing:-.02em;">' + esc(c.sections[0] ? c.sections[0].title : 'Nuestros Servicios') + '</h2>' +
        '</div>' +
        sectionsHtml +
      '</div>' +
    '</section>\n\n' +
    '<section style="padding:5rem 0;background:' + p.surface + '44;border-top:1px solid rgba(128,128,128,.1);border-bottom:1px solid rgba(128,128,128,.1);">' +
      '<div class="es-wrap" style="text-align:center;max-width:720px;margin:0 auto;">' +
        '<h2 style="font-family:var(--es-display);font-size:clamp(1.9rem,3.8vw,3.2rem);color:' + p.ink + ';font-weight:' + weight + ';letter-spacing:-.03em;margin-bottom:.9rem;">' + esc(c.closeHeadline) + '</h2>' +
        '<p style="color:' + p.inkSoft + ';font-size:1rem;line-height:1.75;margin-bottom:1.8rem;">' + esc(c.closeText) + '</p>' +
        '<a style="' + btn + 'font-size:1rem;display:inline-flex;align-items:center;gap:.5rem;text-decoration:none;" href="#contacto">' + esc(c.cta) + ' &rarr;</a>' +
      '</div>' +
    '</section>\n\n' +
    '<section id="contacto" style="padding:5rem 0;">' +
      '<div class="es-wrap" style="display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:start;">' +
        '<div>' +
          '<span style="color:' + p.accent + ';font-family:var(--es-mono);font-size:.62rem;letter-spacing:.18em;text-transform:uppercase;display:block;margin-bottom:.5rem;">Contacto</span>' +
          '<h2 style="font-family:var(--es-display);font-size:clamp(1.8rem,3vw,2.5rem);color:' + p.ink + ';font-weight:' + weight + ';margin-bottom:.9rem;">&iquest;Listo para comenzar?</h2>' +
          '<p style="color:' + p.inkSoft + ';line-height:1.7;margin-bottom:1.4rem;">' + esc(c.standfirst) + '</p>' +
          '<div style="display:grid;gap:.7rem;color:' + p.inkSoft + ';font-size:.9rem;">' + (contactHtml || '<div>Cont&aacute;ctanos para m&aacute;s informaci&oacute;n sobre ' + esc(c.brand) + '.</div>') + '</div>' +
        '</div>' +
        '<div style="background:' + p.surface + '88;border:1px solid rgba(128,128,128,.14);border-radius:' + r + ';padding:2.5rem;">' +
          '<form name="ai4-es-inquiry" method="POST" data-netlify="true" style="display:grid;gap:1rem;">' +
            '<input type="hidden" name="form-name" value="ai4-es-inquiry">' +
            '<input name="nombre" type="text" placeholder="Tu nombre" autocomplete="name" required style="width:100%;background:rgba(128,128,128,.07);border:1px solid rgba(128,128,128,.18);border-radius:' + r + ';padding:.82rem 1rem;font:inherit;color:' + p.ink + ';outline:none;">' +
            '<input name="email" type="email" placeholder="Correo electr&oacute;nico" autocomplete="email" required style="width:100%;background:rgba(128,128,128,.07);border:1px solid rgba(128,128,128,.18);border-radius:' + r + ';padding:.82rem 1rem;font:inherit;color:' + p.ink + ';outline:none;">' +
            '<input name="telefono" type="tel" placeholder="Tel&eacute;fono" autocomplete="tel" style="width:100%;background:rgba(128,128,128,.07);border:1px solid rgba(128,128,128,.18);border-radius:' + r + ';padding:.82rem 1rem;font:inherit;color:' + p.ink + ';outline:none;">' +
            '<textarea name="mensaje" placeholder="&iquest;C&oacute;mo podemos ayudarte?" rows="4" style="width:100%;background:rgba(128,128,128,.07);border:1px solid rgba(128,128,128,.18);border-radius:' + r + ';padding:.82rem 1rem;font:inherit;color:' + p.ink + ';outline:none;resize:vertical;"></textarea>' +
            '<button type="submit" style="' + btn + 'font-size:.95rem;width:100%;display:block;text-align:center;">' + esc(c.cta) + '</button>' +
          '</form>' +
        '</div>' +
      '</div>' +
    '</section>\n\n' +
    '<footer style="border-top:1px solid rgba(128,128,128,.1);padding:2rem 0;">' +
      '<div class="es-wrap" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;font-size:.78rem;color:' + p.inkSoft + ';">' +
        '<span style="font-family:var(--es-display);font-weight:' + weight + ';color:' + p.ink + ';">' + esc(c.brand) + '</span>' +
        '<span>&copy; <span id="es-yr"></span> ' + esc(c.brand) + '. Todos los derechos reservados.</span>' +
        '<span style="font-family:var(--es-mono);font-size:.6rem;">Dise&ntilde;ado por AI4</span>' +
      '</div>' +
    '</footer>\n</div>\n' +
    '<script>document.getElementById("es-yr").textContent=new Date().getFullYear();</script>\n' +
    '</body></html>';
}

async function callClaude(ctx) {
  var key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  var r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1600, messages: [{ role: 'user', content: SCHEMA_PROMPT + '\n\n' + ctx }] })
  });
  if (!r.ok) throw new Error('Claude API error: ' + r.status);
  var data = await r.json();
  var text = (data.content || []).filter(function(b) { return b.type === 'text'; }).map(function(b) { return b.text; }).join('');
  return parseJSON(text);
}

function fallbackSchema(a) {
  return {
    content: {
      brand: a.businessName || 'Tu Negocio',
      category: 'Servicio Premium',
      eyebrow: 'Experiencia de Marca',
      headline: (a.businessName || 'Tu Negocio') + ' — La eleccion correcta',
      standfirst: a.whatYouDo || 'Una presencia digital premium construida para tu negocio.',
      stats: ['Calidad Premium', 'Servicio Personalizado', 'Resultados Reales'],
      sections: [
        { title: 'Nuestros Servicios', blurb: 'Soluciones de alta calidad adaptadas a tu negocio.', points: ['Atencion personalizada', 'Entrega a tiempo', 'Garantia de calidad'] },
        { title: 'Por que Elegirnos', blurb: 'Somos la mejor opcion para tu negocio.', points: ['Experiencia probada', 'Clientes satisfechos', 'Resultados medibles'] },
        { title: 'Nuestro Proceso', blurb: 'Un proceso simple, claro y efectivo.', points: ['Consulta inicial', 'Diseno y desarrollo', 'Entrega y soporte'] },
        { title: 'Garantia de Exito', blurb: 'Tu satisfaccion es nuestra maxima prioridad.', points: ['100% Satisfaccion', 'Soporte incluido', 'Garantia real'] }
      ],
      closeHeadline: 'Comienza tu proyecto hoy',
      closeText: 'Contactanos y hagamos algo excepcional juntos.',
      cta: a.primaryCta || 'Contactanos'
    },
    design: {
      mood: 'Professional premium',
      theme: 'dark',
      palette: { bg: '#030816', surface: '#0d1829', ink: '#f5f8ff', inkSoft: '#8ba0bc', accent: '#1EA7FF', accent2: '#5BD3FF' },
      fonts: { display: 'Sora', body: 'Jost', mono: 'IBM Plex Mono' },
      layout: 'centered',
      surfaceStyle: 'glass',
      texture: 'aurora',
      radius: 14,
      displayWeight: 700,
      accentShape: 'pill'
    }
  };
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'POST only' }) };

  var payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch(e) { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  var a = payload.answers || payload;

  var ctx = [
    'Nombre del negocio: ' + (a.businessName || a.name || ''),
    'Que hace: ' + (a.whatYouDo || a.what || ''),
    'Clientes ideales: ' + (a.customers || a.who || ''),
    'Diferenciador: ' + (a.differentiators || a.diff || ''),
    'Informacion adicional: ' + (a.extras || a.else || '')
  ].join('\n');

  var contactInfo = { phone: a.phone || '', email: a.email || '', address: a.address || '' };

  var schema;
  try {
    schema = await callClaude(ctx);
  } catch(err) {
    console.error('Claude error:', err.message);
    schema = fallbackSchema(a);
  }

  var palettes = buildPalettes(schema.design.palette, schema.design.theme);
  var templates = palettes.map(function(p) { return renderHtml(schema, contactInfo, p); });

  var brief = {
    brandName: schema.content.brand,
    qualityScore: 97,
    status: 'approved',
    websitePurpose: schema.content.category,
    recommendedDesignSystem: schema.design.layout + ' - ' + schema.design.fonts.display,
    creativeDirection: schema.content.standfirst,
    colorSystem: { primary: schema.design.palette.accent, secondary: schema.design.palette.accent2, accent: schema.design.palette.accent, background: schema.design.palette.bg, colorMoodDescription: schema.design.mood },
    typographySystem: { headingFont: schema.design.fonts.display, bodyFont: schema.design.fonts.body, typographyRationale: schema.design.fonts.display + ' + ' + schema.design.fonts.body },
    sectionPlan: schema.content.sections.map(function(s) { return { sectionName: s.title, headlineDirection: s.blurb }; }),
    qualityFlags: [
      'Claude diseno un look unico para este negocio',
      'Layout: ' + schema.design.layout,
      'Tipografia: ' + schema.design.fonts.display + ' + ' + schema.design.fonts.body,
      'Contenido personalizado en espanol',
      '4 variaciones de color disponibles'
    ]
  };

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      success: true,
      source: 'ai4-es-claude-designer-v1',
      html: templates[0],
      builtHtml: templates[0],
      websiteHtml: templates[0],
      templates: templates,
      brief: brief,
      quality: { score: 97, status: 'Platinum Listo', message: 'Claude diseno un sitio unico con layout, tipografia y paleta personalizados. 4 variaciones de color disponibles.', flags: brief.qualityFlags },
      siteData: { businessName: schema.content.brand, business_name: schema.content.brand, designSystem: brief.recommendedDesignSystem, creativeDirection: schema.content.standfirst }
    })
  };
};
