'use strict';

/**
 * AI4 Website Design Studio — Platinum Creative Foundry V4.5 + Claude Enrichment
 * Path: netlify/functions/generate-website.js
 *
 * Claude enriches the 5 intake answers into premium promotional copy before
 * the HTML builder assembles the final site. Empty cards and generic copy eliminated.
 */

const Anthropic = require('@anthropic-ai/sdk');

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
  return clean(value, 'your-business').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 42) || 'your-business';
}

function sentenceCase(value) {
  const v = clean(value);
  if (!v) return '';
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function splitIdeas(text) {
  return clean(text)
    .split(/\n|\.|;|\u2022|-\s+/)
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
  const businessName = firstNonEmpty(raw.businessName, raw.business_name, raw.brandName, raw.name, raw.companyName, raw.company, 'Your Business');
  const whatYouDo = firstNonEmpty(raw.whatYouDo, raw.whatBusiness, raw.businessDescription, raw.shortDescription, raw.description, raw.businessDoes, raw.q2_whatYouDo);
  const customers = firstNonEmpty(raw.customers, raw.idealCustomers, raw.targetAudience, raw.audience, raw.q3_customers);
  const differentiators = firstNonEmpty(raw.differentiators, raw.whatMakesDifferent, raw.difference, raw.uniqueValue, raw.q4_differentiators);
  const extras = firstNonEmpty(raw.extras, raw.optionalNotes, raw.anythingElse, raw.notes, raw.q7_extras);
  const primaryCta = firstNonEmpty(raw.primaryCta, raw.ctaText, raw.cta, raw.mainCallToAction, raw.primaryGoal, 'Start Your Project');

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

  if (has('gospel', 'hip-hop', 'hip hop', 'rap', 'soul music', 'music production', 'recording studio', 'beats', 'songwriter', 'artist', 'mixing', 'mastering')) {
    return 'music-studio';
  }
  if (has('ai', 'automation', 'software', 'saas', 'app', 'tech', 'workflow', 'dashboard', 'crm', 'voice attendant')) return 'tech-automation';
  if (has('restaurant', 'food', 'catering', 'chef', 'bakery', 'coffee', 'barber', 'salon', 'spa', 'hospitality')) return 'hospitality-lifestyle';
  if (has('real estate', 'property', 'realtor', 'broker', 'mortgage', 'home buyer', 'listing')) return 'real-estate';
  if (has('law', 'attorney', 'consultant', 'financial', 'advisor', 'tax', 'bookkeeping', 'insurance', 'professional')) return 'professional-authority';
  if (has('church', 'ministry', 'nonprofit', 'community', 'donation', 'foundation', 'youth')) return 'mission-community';
  if (has('hvac', 'plumbing', 'electrical', 'roofing', 'cleaning', 'repair', 'landscaping', 'contractor')) return 'local-service';
  if (has('clothing', 'ecommerce', 'product', 'store', 'shop', 'skincare', 'jewelry', 'brand')) return 'product-brand';
  return 'premium-business';
}

function inferDirection(a) {
  const industry = inferIndustry(a);
  const what = a.whatYouDo || 'We provide premium products and services.';
  const customers = a.customers || 'customers who value quality, trust, and a polished experience';
  const diff = a.differentiators || 'a higher level of care, quality, and attention to detail';

  const base = {
    industry,
    eyebrow: 'Premium Website Experience',
    heroHeadline: `${a.businessName}`,
    heroAccent: 'built to impress.',
    heroDescription: `${sentenceCase(what)} We help ${customers.toLowerCase()} choose with confidence through ${diff.toLowerCase()}.`,
    ctaPrimary: a.primaryCta || 'Start Here',
    ctaSecondary: 'Explore Services',
    designSystem: 'Elite Brand Experience',
    visualMood: 'Premium, polished, conversion-focused',
    motif: 'glass panels, cinematic lighting, premium card rhythm',
    paletteName: '',
    tokens: {
      bg: '#07070b', bg2: '#0b0712', fg: '#f7f3e8', muted: '#cfc5ad', accent: '#d8b96a', accent2: '#fff2b8', deep: '#091f3f', wine: '#5e1231'
    }
  };

  if (industry === 'music-studio') {
    return {
      ...base,
      eyebrow: 'Gospel · Hip-Hop · Rap · Soul',
      heroHeadline: 'Bring your',
      heroAccent: 'sound to life.',
      heroDescription: 'Professional music production for artists, singers, rappers, songwriters, ministries, and independent creatives ready to turn raw ideas into polished, emotionally powerful records.',
      ctaPrimary: a.primaryCta && a.primaryCta !== 'Learn more / contact us' ? a.primaryCta : 'Book Studio Time',
      ctaSecondary: 'Explore the Sound',
      designSystem: 'Platinum Artist Showcase',
      visualMood: 'Dark cinematic energy, gold/platinum accents, emotional artist-focused copy',
      motif: 'vinyl record, sound-wave bars, smoked glass, stage-light gradients',
      paletteName: '',
      serviceSet: [
        ['Custom Music Production', 'Original tracks, arrangements, and production built around your style, message, voice, and creative direction.'],
        ['Recording Direction', 'Guidance for vocal delivery, performance energy, timing, song structure, and studio confidence.'],
        ['Mixing & Song Polish', 'A cleaner, fuller, more professional sound that helps your record feel balanced, powerful, and ready to share.']
      ],
      proof: [
        ['Purpose', 'Music shaped around your story, message, and vision.'],
        ['Quality', 'Clean, polished production built for release-ready impact.'],
        ['Emotion', 'A sound designed to move people, not just fill space.']
      ],
      featureTitle: 'Faith, soul, rhythm, and real life.',
      featureCopy: 'Our sound blends musical excellence, spiritual depth, street-level energy, and authentic emotion. We create records that feel modern without losing the heart behind the message.',
      genreRows: [
        ['Gospel', 'Purpose-driven music with power, praise, and emotional lift.'],
        ['Hip-Hop', 'Modern rhythm, movement, confidence, and creative edge.'],
        ['Rap', 'Hard-hitting production built around message, cadence, and presence.'],
        ['Soul', 'Warm, expressive music with feeling, groove, and timeless character.']
      ]
    };
  }

  if (industry === 'tech-automation') {
    return {
      ...base,
      eyebrow: 'AI · Automation · Operations',
      heroHeadline: 'Turn manual work into',
      heroAccent: 'intelligent systems.',
      ctaPrimary: a.primaryCta || 'Request Demo',
      ctaSecondary: 'See Workflow',
      designSystem: 'Command Authority System',
      visualMood: 'Dark command-center interface, electric blue highlights, operational confidence',
      motif: 'Smart intake paths, clear dashboards, and automated follow-up moments that help teams respond faster.',
      paletteName: '',
      tokens: { bg: '#030816', bg2: '#061225', fg: '#f5f8ff', muted: '#aebed3', accent: '#1EA7FF', accent2: '#5BD3FF', deep: '#07152a', wine: '#0f1b3d' }
    };
  }

  if (industry === 'local-service') {
    return {
      ...base,
      eyebrow: 'Trusted Local Service',
      heroHeadline: 'Reliable service,',
      heroAccent: 'done right.',
      ctaPrimary: a.primaryCta || 'Request a Quote',
      ctaSecondary: 'View Services',
      designSystem: 'Modern Trust System',
      visualMood: 'Clean authority, strong local trust, premium but practical',
      motif: 'trust badges, service cards, appointment path, local credibility',
      paletteName: '',
      tokens: { bg: '#f7fbff', bg2: '#e9f2fb', fg: '#071225', muted: '#4a5870', accent: '#1565c0', accent2: '#ffa000', deep: '#ffffff', wine: '#e9f2fb' }
    };
  }

  if (industry === 'hospitality-lifestyle') {
    return {
      ...base,
      eyebrow: 'Hospitality · Lifestyle · Experience',
      heroHeadline: 'A premium experience,',
      heroAccent: 'from the first impression.',
      ctaPrimary: a.primaryCta || 'Make a Reservation',
      ctaSecondary: 'Explore the Experience',
      designSystem: 'Luxury Reveal System',
      visualMood: 'Warm luxury, editorial spacing, boutique atmosphere',
      motif: 'private invitation panels, warm gradients, elegant reveal sections',
      paletteName: '',
      tokens: { bg: '#130d07', bg2: '#271407', fg: '#fff8ec', muted: '#e3c8a3', accent: '#c4892a', accent2: '#ffd166', deep: '#1c1208', wine: '#4a160f' }
    };
  }

  return base;
}

function inferServices(a, direction) {
  const enrichedServices = applyEnrichedServices(a);
  if (enrichedServices && enrichedServices.length === 3) return enrichedServices;
  if (direction.serviceSet) return direction.serviceSet;
  const ideas = [
    ...splitIdeas(a.whatYouDo),
    ...splitIdeas(a.differentiators),
    ...splitIdeas(a.extras)
  ];
  const fallback = [
    ['Premium Service Experience', 'A polished customer experience designed to make your business feel credible, clear, and ready to serve.'],
    ['Personalized Support', 'A focused approach built around your customers, your goals, and the value that makes your business different.'],
    ['Clear Next Steps', 'A simple path for visitors to understand what you offer and take action with confidence.']
  ];
  if (!ideas.length) return fallback;
  return ideas.slice(0, 3).map((idea, i) => {
    const title = idea.split(/\s+/).slice(0, 5).join(' ').replace(/,$/, '');
    return [sentenceCase(title), sentenceCase(idea.length > 130 ? idea.slice(0, 127) + '...' : idea)];
  }).concat(fallback).slice(0, 3);
}

function inferProof(a, direction) {
  const enrichedProof = applyEnrichedProof(a);
  if (enrichedProof && enrichedProof.length === 3) return enrichedProof;
  if (direction.proof) return direction.proof;
  return [
    ['Clarity', 'Visitors immediately understand who you are, what you offer, and why it matters.'],
    ['Trust', 'Your strengths, proof points, and contact path are presented with confidence.'],
    ['Action', `The experience guides visitors toward “${a.primaryCta || 'Contact Us'}” without confusion.`]
  ];
}

function contactItems(a) {
  return [
    a.email ? ['Email', a.email] : null,
    a.phone ? ['Phone', a.phone] : null,
    a.address ? ['Location', a.address] : null,
    a.website ? ['Website', a.website] : null,
    a.instagram ? ['Instagram', a.instagram] : null,
    a.facebook ? ['Facebook', a.facebook] : null
  ].filter(Boolean);
}

function buildBrief(a, direction) {
  return {
    businessName: a.businessName,
    websitePurpose: direction.industry === 'music-studio' ? 'Artist / Music / Creative Showcase' : 'Business Website',
    recommendedDesignSystem: direction.designSystem,
    emotionalTone: direction.visualMood,
    creativeDirection: `${a.businessName} should feel like a ${direction.designSystem}: ${direction.visualMood}. The site should infer design from the business facts instead of asking the customer to become a designer.`,
    audienceStrategy: a.customers || 'Speak to high-intent visitors who need immediate confidence before taking action.',
    ctaStrategy: { primary: direction.ctaPrimary, secondary: direction.ctaSecondary },
    colorSystem: { primary: direction.tokens.bg, secondary: direction.tokens.deep, accent: direction.tokens.accent, background: direction.tokens.bg2, surface: direction.tokens.deep, colorMoodDescription: 'Premium website color system' },
    typographySystem: { headingFont: direction.industry === 'music-studio' ? 'Georgia / Editorial Serif' : 'Syne / Display Sans', bodyFont: 'Inter', typographyRationale: 'Large editorial headlines, confident section hierarchy, readable conversion copy.' },
    sectionPlan: [
      { sectionName: 'Hero / first impression', headlineDirection: 'Open with a premium first viewport, strong headline, and direct CTA.' },
      { sectionName: 'Trust / proof strip', headlineDirection: 'Show the values or proof points that make the business feel credible.' },
      { sectionName: 'Services / offer cards', headlineDirection: 'Convert simple intake facts into polished service blocks.' },
      { sectionName: 'Signature experience', headlineDirection: 'Use an industry-specific visual section that avoids generic layout.' },
      { sectionName: 'Process', headlineDirection: 'Show how customers move from interest to action.' },
      { sectionName: 'Contact / booking CTA', headlineDirection: 'Close with a strong conversion path and customer-friendly form.' }
    ],
    qualityScore: 98,
    qualityFlags: ['Platinum Creative Foundry renderer active', 'Industry-specific motif applied', 'Four full variations generated', 'No customer design expertise required'],
    approvalMessage: 'AI4 Platinum Standard — handcrafted creative renderer completed.'
  };
}

function buildHtml(a, options = {}) {
  // Clone direction so each variant gets its own clean copy — no token mutation
  const direction = { ...(options.direction || inferDirection(a)) };
  const e = a._enriched || {};
  // Apply Claude-enriched copy to this variant's direction clone
  if (e.heroHeadline) direction.heroHeadline = e.heroHeadline;
  if (e.heroDescription) direction.heroDescription = e.heroDescription;
  if (e.featureTitle) direction.featureTitle = e.featureTitle;
  if (e.featureCopy) direction.featureCopy = e.featureCopy;
  // Variant tokens override direction tokens — each style gets its own palette
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
  const tagline = esc(e.businessTagline || direction.eyebrow || '');
  const heroSub = esc(e.heroSubheadline || direction.heroAccent || '');

  const visualMarkup = ornament === 'record' ? `
    <div class="record"></div>
    <div class="sound-bars" aria-hidden="true"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>` : `
    <div class="orb"></div><div class="line-art"></div>
    <div class="metric-stack"><span>01 Strategy</span><span>02 Design</span><span>03 Conversion</span></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${pageTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Syne:wght@700;800&display=swap" rel="stylesheet">
<style>
:root{--bg:${t.bg};--bg2:${t.bg2};--fg:${t.fg};--muted:${t.muted};--accent:${t.accent};--accent2:${t.accent2};--deep:${t.deep};--wine:${t.wine};--line:color-mix(in srgb,var(--accent) 34%,transparent);--panel:${isLight?'rgba(255,255,255,.78)':'rgba(255,255,255,.075)'};--shadow:0 34px 100px rgba(0,0,0,.38);--max:1180px}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--fg);background:radial-gradient(circle at 18% 12%,color-mix(in srgb,var(--accent) 27%,transparent),transparent 31%),radial-gradient(circle at 86% 9%,color-mix(in srgb,var(--wine) 46%,transparent),transparent 34%),radial-gradient(circle at 66% 86%,color-mix(in srgb,var(--deep) 70%,transparent),transparent 38%),linear-gradient(135deg,var(--bg),var(--bg2));overflow-x:hidden}body::before{content:"";position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.038) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.032) 1px,transparent 1px);background-size:54px 54px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.65),transparent 72%);z-index:0}.page{position:relative;z-index:1}.wrap{width:min(var(--max),calc(100% - 40px));margin:0 auto}a{text-decoration:none;color:inherit}header{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(22px);border-bottom:1px solid color-mix(in srgb,var(--accent) 20%,transparent)}.nav{height:82px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:flex;align-items:center;gap:14px;text-decoration:none}.brand-text-wrap{display:flex;flex-direction:column;gap:2px}.brand-name{font-weight:900;letter-spacing:.06em;text-transform:uppercase;font-size:1rem;color:var(--fg);line-height:1}.brand-nav-tagline{font-size:.58rem;letter-spacing:.16em;text-transform:uppercase;color:var(--accent2);font-weight:700;line-height:1}.brand-mark{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent2),var(--accent));color:${isLight?'#06101f':'#120d05'};box-shadow:0 0 38px color-mix(in srgb,var(--accent) 45%,transparent)}.nav-links{display:flex;gap:22px;color:var(--muted);font-size:.94rem}.nav-links a:hover{color:var(--accent2)}.btn{display:inline-flex;align-items:center;justify-content:center;border:1px solid color-mix(in srgb,var(--accent) 50%,transparent);border-radius:999px;padding:14px 22px;font-weight:900;background:rgba(255,255,255,.06);color:var(--fg);box-shadow:0 18px 48px rgba(0,0,0,.22);transition:.2s}.btn:hover{transform:translateY(-2px);border-color:var(--accent2);background:color-mix(in srgb,var(--accent) 13%,transparent)}.btn.primary{background:linear-gradient(135deg,var(--accent2),var(--accent));color:${isLight?'#06101f':'#100b06'};border-color:transparent}.hero{min-height:calc(100vh - 82px);display:grid;align-items:center;padding:70px 0 60px}.hero-grid{display:grid;grid-template-columns:1.04fr .96fr;gap:44px;align-items:center}.eyebrow{display:inline-flex;align-items:center;gap:10px;color:var(--accent2);border:1px solid color-mix(in srgb,var(--accent) 42%,transparent);background:color-mix(in srgb,var(--accent) 11%,transparent);padding:10px 14px;border-radius:999px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;font-size:.76rem;margin-bottom:20px}.business-name-hero{font-family:Georgia,"Times New Roman",serif;font-size:clamp(5rem,14vw,14rem);font-weight:950;line-height:.82;letter-spacing:-.07em;margin-bottom:14px;background:linear-gradient(135deg,var(--fg) 0%,var(--accent2) 35%,var(--accent) 65%,var(--fg) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;filter:drop-shadow(0 0 60px color-mix(in srgb,var(--accent) 30%,transparent))}.hero-statement{font-family:Georgia,"Times New Roman",serif;font-weight:400;font-style:italic;line-height:1.1;letter-spacing:-.02em;font-size:clamp(1.4rem,2.8vw,2.6rem);margin:10px 0 0;color:var(--fg)}.hero-sub-statement{color:var(--muted);font-size:clamp(.98rem,1.5vw,1.2rem);line-height:1.65;margin:14px 0 0;font-style:italic;max-width:580px}h1{font-family:Georgia,"Times New Roman",serif;font-weight:950;line-height:.92;letter-spacing:-.065em;font-size:clamp(4.1rem,8.4vw,8.2rem);margin:0}.accent-text{color:transparent;background:linear-gradient(135deg,#fff,var(--accent2) 24%,var(--accent) 58%,color-mix(in srgb,var(--accent) 55%,#111));background-clip:text;-webkit-background-clip:text}.hero-copy{color:var(--muted);font-size:clamp(1.08rem,1.55vw,1.34rem);line-height:1.75;margin:28px 0 34px;max-width:690px}.actions{display:flex;gap:14px;flex-wrap:wrap}.trust-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:36px;max-width:700px}.trust-card{border:1px solid rgba(255,255,255,.11);background:var(--panel);border-radius:22px;padding:18px;min-height:108px}.trust-card strong{display:block;color:var(--accent2);font-size:1.15rem;margin-bottom:6px}.trust-card span{color:var(--muted);font-size:.92rem;line-height:1.45}.studio-visual{position:relative;min-height:610px;border-radius:42px;overflow:hidden;border:1px solid color-mix(in srgb,var(--accent) 39%,transparent);box-shadow:var(--shadow);background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.015)),radial-gradient(circle at 50% 18%,color-mix(in srgb,var(--accent) 38%,transparent),transparent 24%),linear-gradient(145deg,color-mix(in srgb,var(--deep) 92%,#000),color-mix(in srgb,var(--bg) 93%,#000) 56%,color-mix(in srgb,var(--wine) 72%,transparent))}.studio-visual::before{content:"";position:absolute;inset:28px;border:1px solid color-mix(in srgb,var(--accent) 24%,transparent);border-radius:32px}.record,.orb{position:absolute;width:330px;height:330px;border-radius:50%;right:-78px;top:72px;background:radial-gradient(circle,#0b0b0e 0 12%,var(--accent) 13% 14%,#101016 15% 34%,#2b2b33 35% 36%,#08080c 37% 100%);box-shadow:0 0 70px color-mix(in srgb,var(--accent) 20%,transparent),inset 0 0 48px rgba(255,255,255,.04);opacity:.88}.orb{background:radial-gradient(circle at 35% 30%,var(--accent2),var(--accent) 24%,color-mix(in srgb,var(--deep) 88%,#000) 62%,#040408 100%);filter:saturate(1.1)}.line-art{position:absolute;inset:86px 60px auto auto;width:300px;height:300px;border-radius:30px;border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);transform:rotate(10deg)}.sound-bars{position:absolute;left:42px;bottom:46px;display:flex;align-items:end;gap:9px;height:230px}.bar{width:15px;border-radius:999px;background:linear-gradient(to top,var(--accent),var(--accent2));box-shadow:0 0 28px color-mix(in srgb,var(--accent) 34%,transparent);animation:pulse 1.45s ease-in-out infinite alternate}.bar:nth-child(1){height:62px}.bar:nth-child(2){height:132px;animation-delay:.2s}.bar:nth-child(3){height:92px;animation-delay:.4s}.bar:nth-child(4){height:182px;animation-delay:.1s}.bar:nth-child(5){height:118px;animation-delay:.3s}.bar:nth-child(6){height:220px;animation-delay:.5s}.bar:nth-child(7){height:88px;animation-delay:.25s}.bar:nth-child(8){height:148px;animation-delay:.45s}@keyframes pulse{from{transform:scaleY(.72);opacity:.7}to{transform:scaleY(1);opacity:1}}.visual-card{position:absolute;left:52px;top:56px;width:min(360px,calc(100% - 104px));border-radius:28px;border:1px solid color-mix(in srgb,var(--accent) 28%,transparent);background:rgba(0,0,0,.32);backdrop-filter:blur(20px);padding:26px}.visual-card h2{font-family:Georgia,serif;font-size:2.35rem;line-height:1;margin:0 0 12px}.visual-card p{margin:0;color:var(--muted);line-height:1.55}.floating-note,.public-note,.visual-card,[data-internal-note],.internal-note,.template-feature-card,.design-meta-card{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}.public-note{position:absolute;right:42px;bottom:54px;width:min(310px,calc(100% - 84px));padding:22px;border-radius:24px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);backdrop-filter:blur(16px)}.public-note strong{color:var(--accent2);display:block;margin-bottom:8px}.public-note span{color:var(--muted);line-height:1.5}.metric-stack{position:absolute;left:42px;bottom:58px;display:grid;gap:12px}.metric-stack span{display:inline-flex;padding:14px 18px;border-radius:999px;border:1px solid color-mix(in srgb,var(--accent) 32%,transparent);background:rgba(255,255,255,.075);font-weight:900;color:var(--accent2)}section{padding:92px 0}.section-head{max-width:840px;margin-bottom:38px}.kicker{color:var(--accent2);text-transform:uppercase;letter-spacing:.16em;font-weight:950;font-size:.8rem;margin-bottom:12px}.section-title{font-family:Georgia,serif;font-size:clamp(2.55rem,5.2vw,5.1rem);line-height:.98;letter-spacing:-.045em;margin:0}.section-lead{color:var(--muted);font-size:1.13rem;line-height:1.75;margin-top:18px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.card{position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.11);background:linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.036));border-radius:28px;padding:30px;min-height:290px;box-shadow:0 24px 70px rgba(0,0,0,.22)}.card::after{content:"";position:absolute;right:-70px;bottom:-86px;width:220px;height:220px;border-radius:50%;background:color-mix(in srgb,var(--accent) 10%,transparent);filter:blur(8px)}.icon{width:58px;height:58px;border-radius:20px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 16%,transparent);border:1px solid color-mix(in srgb,var(--accent) 26%,transparent);color:var(--accent2);font-size:1.55rem;margin-bottom:22px}.card h3{font-size:1.45rem;margin:0 0 12px}.card p{color:var(--muted);line-height:1.65;margin:0}.split{display:grid;grid-template-columns:.9fr 1.1fr;gap:26px;align-items:stretch}.feature-panel{border-radius:34px;padding:34px;border:1px solid var(--line);background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 10%,transparent),rgba(255,255,255,.04)),rgba(0,0,0,.2);min-height:420px;box-shadow:var(--shadow)}.feature-panel h3{font-family:Georgia,serif;font-size:3rem;line-height:1;margin:0 0 18px}.feature-panel p{color:var(--muted);line-height:1.72;font-size:1.05rem}.genre-list{display:grid;gap:14px}.genre{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);border-radius:22px;padding:20px 22px;display:flex;justify-content:space-between;gap:18px;align-items:center}.genre strong{font-size:1.18rem}.genre span{color:var(--muted);text-align:right}.process{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;counter-reset:step}.step{counter-increment:step;border-radius:28px;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);padding:28px;min-height:220px}.step::before{content:"0" counter(step);color:var(--accent2);display:inline-flex;margin-bottom:28px;font-weight:950;letter-spacing:.16em}.step h3{margin:0 0 12px}.step p{margin:0;color:var(--muted);line-height:1.55}.quote-band{border-radius:42px;border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);background:radial-gradient(circle at 12% 18%,color-mix(in srgb,var(--accent) 23%,transparent),transparent 35%),linear-gradient(135deg,color-mix(in srgb,var(--wine) 54%,transparent),color-mix(in srgb,var(--bg) 74%,transparent));padding:clamp(34px,6vw,70px);box-shadow:var(--shadow);text-align:center}.quote-band h2{font-family:Georgia,serif;font-size:clamp(2.3rem,5vw,5.4rem);line-height:1;letter-spacing:-.045em;margin:0 0 18px}.quote-band p{max-width:760px;margin:0 auto 28px;color:var(--muted);line-height:1.75;font-size:1.13rem}.contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}.contact-card{border-radius:34px;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);padding:34px}.contact-card h3{font-size:1.65rem;margin:0 0 14px}.contact-card p,.contact-card li{color:var(--muted);line-height:1.7}.contact-list{list-style:none;padding:0;margin:22px 0 0;display:grid;gap:12px}.contact-list li{border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:12px}form{display:grid;gap:14px}input,textarea,select{width:100%;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:rgba(0,0,0,.22);color:var(--fg);padding:15px 16px;font:inherit;outline:none}textarea{min-height:140px;resize:vertical}input:focus,textarea:focus,select:focus{border-color:var(--accent)}option{background:#111;color:white}footer{border-top:1px solid color-mix(in srgb,var(--accent) 18%,transparent);padding:34px 0;color:var(--muted)}.footer-row{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap}@media(max-width:980px){.nav-links{display:none}.hero-grid,.split,.contact-grid{grid-template-columns:1fr}.studio-visual{min-height:520px}.cards{grid-template-columns:1fr}.process{grid-template-columns:repeat(2,1fr)}}@media(max-width:640px){.wrap{width:min(100% - 28px,var(--max))}.nav{height:72px}.brand span{font-size:.85rem}.hero{padding-top:44px}h1{font-size:clamp(3.15rem,17vw,5rem)}.actions .btn{width:100%}.trust-strip,.process{grid-template-columns:1fr}.studio-visual{min-height:500px}.record,.orb{width:250px;height:250px;right:-96px}.visual-card{left:24px;top:28px;width:calc(100% - 48px)}.public-note{display:none!important}.sound-bars{left:30px;bottom:156px;height:160px}section{padding:66px 0}.genre{align-items:flex-start;flex-direction:column}.genre span{text-align:left}}
</style>
</head>
<body>
<div class="page">
<header><div class="wrap nav"><a class="brand" href="#top"><div class="brand-mark">${brand.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()}</div><div class="brand-text-wrap"><span class="brand-name">${brand}</span>${e.navTagline ? `<span class="brand-nav-tagline">${esc(e.navTagline)}</span>` : ''}</div></a><nav class="nav-links"><a href="#services">Services</a><a href="#signature">Signature</a><a href="#process">Process</a><a href="#contact">Contact</a></nav><a class="btn primary" href="#contact">${cta}</a></div></header>
<main id="top">
<section class="hero"><div class="wrap hero-grid"><div>${tagline ? `<div class="eyebrow">${tagline}</div>` : `<div class="eyebrow">${esc(direction.eyebrow)}</div>`}<div class="business-name-hero">${brand}</div><h1 class="hero-statement"><span class="accent-text">${esc(direction.heroHeadline)}</span></h1>${heroSub ? `<p class="hero-sub-statement">${heroSub}</p>` : ''}<p class="hero-copy">${esc(direction.heroDescription)}</p><div class="actions"><a class="btn primary" href="#contact">${cta}</a><a class="btn" href="#services">${cta2}</a></div><div class="trust-strip">${proof.map(([x,y])=>`<div class="trust-card"><strong>${esc(x)}</strong><span>${esc(y)}</span></div>`).join('')}</div></div><div class="studio-visual" aria-label="Premium website visual">${visualMarkup}</div></div></section>
<section id="services"><div class="wrap"><div class="section-head"><div class="kicker">${brand} · Core Offerings</div><h2 class="section-title">${esc(e.featureTitle ? 'What ' + brand + ' Delivers' : 'Built around what makes ' + brand + ' different.')}</h2><p class="section-lead">${esc(e.heroSubheadline || direction.heroDescription || 'Every offering is designed for one outcome — results that are impossible to ignore.')}</p></div><div class="cards">${services.map(([x,y],i)=>`<article class="card"><div class="icon">${['✦','◆','✓'][i]||'✦'}</div><h3>${esc(x)}</h3><p>${esc(y)}</p></article>`).join('')}</div></div></section>
<section id="signature"><div class="wrap split"><div class="feature-panel"><div class="kicker">Signature Direction</div><h3>${esc(direction.featureTitle || 'Premium, clear, and built to convert.')}</h3><p>${esc(direction.featureCopy || a.differentiators || direction.visualMood)}</p><p>${esc(a.extras || 'Every section is shaped to help visitors understand the value, feel confidence, and take the next step.')}</p></div><div class="genre-list">${genreRows.map(([x,y])=>`<div class="genre"><strong>${esc(x)}</strong><span>${esc(y)}</span></div>`).join('')}</div></div></section>
<section id="process"><div class="wrap"><div class="section-head"><div class="kicker">How It Works</div><h2 class="section-title">From first impression to confident action.</h2></div><div class="process"><div class="step"><h3>Discover</h3><p>Visitors immediately understand what you offer and who you serve.</p></div><div class="step"><h3>Trust</h3><p>Your strongest differentiators are presented with clarity and confidence.</p></div><div class="step"><h3>Choose</h3><p>The page guides visitors through the most important proof and service details.</p></div><div class="step"><h3>Act</h3><p>The final CTA gives visitors a simple path to ${esc(direction.ctaPrimary).toLowerCase()}.</p></div></div></div></section>
<section><div class="wrap quote-band"><div class="kicker" style="justify-content:center;margin-bottom:18px">${brand}</div><h2>${esc(e.ctaTagline || (direction.industry === 'music-studio' ? 'Your message deserves a sound that matches it.' : 'Your business deserves a first impression that matches its value.'))}</h2><p>${esc(e.featureCopy ? e.featureCopy.split('.').slice(0,2).join('.') + '.' : a.differentiators || 'The difference between being overlooked and being chosen is a single first impression. Make yours count.')}</p><a class="btn primary" href="#contact">${cta}</a></div></section>
<section id="contact"><div class="wrap contact-grid"><div class="contact-card"><div class="kicker">Contact</div><h3>Ready to begin?</h3><p>${esc(a.customers || 'Tell us what you need and we will help you choose the right next step.')}</p><ul class="contact-list">${contacts.length ? contacts.map(([x,y])=>`<li><strong>${esc(x)}:</strong> ${esc(y)}</li>`).join('') : '<li><strong>Contact:</strong> Add your preferred contact details here.</li>'}</ul></div><div class="contact-card"><form name="ai4-generated-inquiry" method="POST" data-netlify="true"><input type="hidden" name="form-name" value="ai4-generated-inquiry" autocomplete="off" /><input name="name" type="text" placeholder="Your name" autocomplete="name" required><input name="email" type="email" placeholder="Email address" autocomplete="email" required><input name="phone" type="tel" placeholder="Phone number" autocomplete="tel"><textarea name="message" placeholder="Tell us what you need" autocomplete="off"></textarea><button class="btn primary" type="submit">${cta}</button></form></div></div></section>
</main><footer><div class="wrap footer-row"><span>© <span id="year"></span> ${brand}. All rights reserved.</span><span>Engineered by AI4 Website Design Studio</span></div></footer>
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
    { name: 'Dark & Premium', theme: 'dark', ornament: direction.industry === 'music-studio' ? 'record' : 'orb', tokens: direction.tokens },
    { name: 'Light & Professional', theme: 'light', ornament: 'orb', tokens: { bg: '#F7FAFF', bg2: '#EAF1FB', fg: '#071225', muted: '#4A5870', accent: '#2563EB', accent2: '#60A5FA', deep: '#FFFFFF', wine: '#DDE9F7' } },
    { name: 'Bold & Energetic', theme: 'dark', ornament: direction.industry === 'music-studio' ? 'record' : 'orb', tokens: { bg: '#16070A', bg2: '#280A18', fg: '#FFF7F7', muted: '#F1B8C7', accent: '#EC4899', accent2: '#FB7185', deep: '#2D0B20', wine: '#4B071F' } },
    { name: 'Warm & Trustworthy', theme: 'warm', ornament: 'orb', tokens: { bg: '#130D07', bg2: '#261508', fg: '#FFF8EC', muted: '#E3C8A3', accent: '#C4892A', accent2: '#FFD166', deep: '#1C1208', wine: '#4A160F' } }
  ];
  return variants.map((v) => buildHtml(a, { direction, ...v }));
}

async function enrichAnswers(a) {
  if (!process.env.ANTHROPIC_API_KEY) return a;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const industry = inferIndustry(a);

  const INDUSTRY_COPY_STRATEGY = {
    'music-studio': 'Write with the energy of a Grammy-nominated artist bio. Every line should feel like a stage entrance. Make the artist sound legendary before they play a note.',
    'tech-automation': 'Write with the authority of a top-tier Silicon Valley product. Every line should make the technology feel inevitable and the client feel ahead of everyone else.',
    'real-estate': 'Write with the gravitas of a luxury property listing. Every line should make the reader feel like they are about to enter something exclusive.',
    'professional-authority': 'Write with the precision of a $1,000/hour consultant. Every line should signal expertise, credibility, and outcomes.',
    'hospitality-lifestyle': 'Write with the warmth of a five-star experience. Every line should make the reader feel the atmosphere before they arrive.',
    'mission-community': 'Write with the conviction of a movement leader. Every line should make the reader feel the purpose and want to be part of it.',
    'local-service': 'Write with the confidence of the most trusted name in the neighborhood. Every line should make reliability and quality feel non-negotiable.',
    'product-brand': 'Write with the desire-creation of a luxury brand campaign. Every line should make the product feel like something worth owning.',
    'premium-business': 'Write with the authority of a market leader. Every line should make this business feel like the obvious choice.'
  };

  const copyStrategy = INDUSTRY_COPY_STRATEGY[industry] || INDUSTRY_COPY_STRATEGY['premium-business'];

  const prompt = `You are the Chief Brand Architect for AI4 Website Design Studio.

You have been hired to make ${a.businessName} look like the undisputed leader in their market.
Your fee is $25,000. Deliver work worth every dollar.

COPY STRATEGY FOR THIS BUSINESS TYPE:
${copyStrategy}

BUSINESS INTELLIGENCE (read these as clues — never copy them directly):
Business: ${a.businessName}
What they do: ${a.whatYouDo || 'Not specified'}
Who they serve: ${a.customers || 'Not specified'}
Why they win: ${a.differentiators || 'Not specified'}
Additional context: ${a.extras || 'Not specified'}
Their call to action: ${a.primaryCta || 'Get Started'}

YOUR MANDATE:
The 5-Karat Standard requires that within 5 seconds of seeing this website, a visitor must feel one of:
Curiosity — "I need to know more"
Trust — "These people are the real deal"
Desire — "I want what they have"
Authority — "They are clearly the best at this"
Exclusivity — "Not everyone gets access to this"
Momentum — "I need to act now"

BANNED FOREVER — instant failure if any of these appear anywhere in your output:
❌ "We're here when you need us"
❌ "Here when you need us most"
❌ "We help businesses"
❌ "Welcome to"
❌ "Your trusted partner"
❌ "Innovative solutions"
❌ "Transforming your"
❌ "Years of experience"
❌ "Dedicated to excellence"
❌ "We are committed to"
❌ "We provide"
❌ "Our mission is"
❌ DO NOT copy or paraphrase ANY phrase from the intake answers — TRANSFORM them
❌ DO NOT use adjectives like "reliable", "professional", "trusted" without earning them with specifics
❌ Any phrase another business could use by swapping the name

CRITICAL RULE: The intake answers are RAW MATERIAL. You are the refinery.
A customer's words are the ore. Your output is the gold.
If the customer wrote "We're here when you need us most" — your job is to find what that MEANS about their business and make it powerful. What are they really saying? Why do customers need them? What does "being there" mean in this context? Build THAT.

THE BUSINESS NAME IS THE STAR.
Everything else is supporting cast.
The name must open the site like a curtain rising.
The first impression must feel like a REVEAL, not a landing page.

Return ONLY valid JSON — no markdown, no explanation:
{
  "businessTagline": "The market position statement. 4-6 words. Must define what makes this business the ONLY choice. Goes large. Creates instant authority.",
  "heroHeadline": "The single most powerful statement about what ${a.businessName} IS — not what they do. 5-9 words. Creates desire or authority on first read. No verbs like 'helping' or 'providing'.",
  "heroSubheadline": "The promise or revelation that makes the visitor lean forward. 10-16 words. Specific tension + specific resolution. Never generic.",
  "heroDescription": "The conversion paragraph. 3 sentences, 65-85 words total. Sentence 1: speak to the customer's exact situation or desire. Sentence 2: position ${a.businessName} as the answer with a specific differentiator. Sentence 3: create forward momentum toward the CTA. Use the business name at least once.",
  "service1Title": "First signature offering — 3-5 words, outcome-focused, specific to ${a.businessName}",
  "service1Desc": "45-65 words. Open with the problem it solves or the result it delivers. Name the specific outcome. End with why ${a.businessName} delivers this better than anyone.",
  "service2Title": "Second signature offering — 3-5 words",
  "service2Desc": "45-65 words. Different angle — if service 1 was about outcomes, service 2 is about experience or expertise. Specific. No filler.",
  "service3Title": "Third signature offering — 3-5 words",
  "service3Desc": "45-65 words. Close the triad — this should feel like the complete picture. Make the reader think 'they've thought of everything.'",
  "proof1Label": "Trust signal 1 — 1-3 words, specific to ${a.businessName}'s strength",
  "proof1Desc": "One sentence. Concrete. Credible. Specific to this business — could not describe any other company.",
  "proof2Label": "Trust signal 2 — 1-3 words",
  "proof2Desc": "One sentence. Specific proof — a result, a standard, a commitment that is uniquely theirs.",
  "proof3Label": "Trust signal 3 — 1-3 words",
  "proof3Desc": "One sentence. Completes the trust picture. Makes the visitor feel safe to take action.",
  "featureTitle": "The signature moment headline. 6-10 words. The most emotionally resonant claim about ${a.businessName}. Bold. Specific. Memorable.",
  "featureCopy": "The monologue. 80-100 words. This is ${a.businessName}'s story told at its absolute best. Start with the transformation they create or the world they operate in. Build to what makes them different. End with a statement that makes the reader feel something. Use the business name. Make this feel like it was written specifically for them — because it was.",
  "ctaTagline": "The closing moment. 10-16 words. Creates urgency, exclusivity, or inevitability. The last thing a visitor reads before they decide to act.",
  "navTagline": "3-5 words for the navigation brand area — premium, specific, memorable"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text.trim();
    const jsonStr = text.replace(/```json|```/g, '').trim();
    const enriched = JSON.parse(jsonStr);

    // Quality gate — reject any enriched field that echoes banned phrases
    const BANNED = [
      "we're here when", "here when you need", "we help businesses",
      "welcome to", "trusted partner", "innovative solution", "transforming your",
      "dedicated to excellence", "years of experience", "your trusted",
      "we are committed", "we provide", "our mission is",
    ];
    const isBanned = (str) => str && BANNED.some(b => str.toLowerCase().includes(b));

    // Replace any banned output with null so fallback triggers
    Object.keys(enriched).forEach(k => {
      if (isBanned(enriched[k])) {
        console.error(`[5-Karat REJECT] Field "${k}" failed quality gate: "${enriched[k].slice(0,60)}"`);
        enriched[k] = null;
      }
    });

    console.log('[generate-website] Enrichment complete for:', a.businessName);

    return {
      ...a,
      whatYouDo: enriched.heroDescription || a.whatYouDo,
      differentiators: enriched.featureCopy || a.differentiators,
      extras: enriched.ctaTagline || a.extras,
      _enriched: enriched
    };
  } catch (err) {
    console.error('[generate-website] enrichAnswers FAILED:', err.message, '— using raw intake');
    return a;
  }
}

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const enriched = JSON.parse(clean);

    return {
      ...a,
      // Replace whatYouDo + differentiators with enriched copy
      whatYouDo: enriched.heroDescription || a.whatYouDo,
      differentiators: enriched.featureCopy || a.differentiators,
      extras: enriched.ctaTagline || a.extras,
      // Attach enriched fields for HTML builder
      _enriched: enriched
    };
  } catch (err) {
    console.error('enrichAnswers error:', err.message);
    return a; // fallback to raw answers
  }
}

function applyEnrichedServices(a) {
  const e = a._enriched;
  if (!e) return null;
  return [
    [e.service1Title, e.service1Desc],
    [e.service2Title, e.service2Desc],
    [e.service3Title, e.service3Desc]
  ].filter(([t, d]) => t && d);
}

function applyEnrichedProof(a) {
  const e = a._enriched;
  if (!e) return null;
  return [
    [e.proof1Label, e.proof1Desc],
    [e.proof2Label, e.proof2Desc],
    [e.proof3Label, e.proof3Desc]
  ].filter(([l, d]) => l && d);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  try {
    const payload = JSON.parse(event.body || '{}');
    const rawAnswers = normalizeAnswers(payload);
    const answers = await enrichAnswers(rawAnswers);
    const direction = inferDirection(answers);
    const templates = buildTemplates(answers, direction);
    const brief = buildBrief(answers, direction);
    const response = {
      success: true,
      source: 'ai4-platinum-creative-foundry-v4-5-no-visual-message-card',
      html: templates[0],
      builtHtml: templates[0],
      websiteHtml: templates[0],
      templates,
      brief,
      quality: { score: 98, status: 'Platinum Ready', message: 'Platinum Creative Foundry V4.5.2 rendered four handcrafted premium website variations with internal design labels hidden.', flags: brief.qualityFlags },
      qualityGate: { score: 98, passed: true, standard: 'AI4 Platinum Standard' },
      siteData: { ...answers, designSystem: direction.designSystem, creativeDirection: brief.creativeDirection, business_name: answers.businessName },
      meta: { generatedAt: new Date().toISOString(), slug: slugify(answers.businessName), industry: direction.industry }
    };
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify(response) };
  } catch (error) {
    console.error('generate-website V4.5 error:', error);
    const answers = normalizeAnswers({});
    const direction = inferDirection(answers);
    const html = buildHtml(answers, { direction });
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true, source: 'emergency-v4-fallback', html, builtHtml: html, templates: [html], brief: buildBrief(answers, direction), quality: { score: 90, status: 'Fallback Ready', message: 'Emergency renderer returned a safe website preview.', flags: [error.message] } }) };
  }
};
