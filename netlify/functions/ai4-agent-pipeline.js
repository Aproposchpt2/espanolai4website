'use strict';

/**
 * AI4 Website Design Studio — Agent Pipeline Compatibility Wrapper V4
 * Path: netlify/functions/ai4-agent-pipeline.js
 *
 * The actual preview-producing renderer now lives in generate-website.js.
 * This endpoint remains so older callers do not break.
 */

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function clean(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const out = String(value).trim();
  return out || fallback;
}

function parseBody(event) {
  try { return JSON.parse(event.body || '{}'); } catch (_) { return {}; }
}

function extractProfile(body) {
  const raw = body.rawAnswers || body.answers || body.profile || body || {};
  return {
    businessName: clean(raw.businessName || raw.business_name || raw.brandName || raw.name, 'Your Business'),
    whatYouDo: clean(raw.whatYouDo || raw.whatBusiness || raw.description || raw.shortDescription, 'A premium business built for customers who value quality.'),
    customers: clean(raw.customers || raw.targetAudience || raw.audience, 'High-intent customers'),
    differentiators: clean(raw.differentiators || raw.uniqueValue || raw.difference, 'Quality, care, and a polished customer experience'),
    primaryCta: clean(raw.primaryCta || raw.ctaText || raw.mainCallToAction, 'Contact Us'),
    phone: clean(raw.phone || ''),
    email: clean(raw.email || ''),
    address: clean(raw.address || '')
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };

  const body = parseBody(event);
  const profile = extractProfile(body);

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      success: true,
      source: 'ai4-agent-pipeline-v4-compatibility',
      message: 'Compatibility wrapper active. Use /.netlify/functions/generate-website for final Platinum rendering.',
      profile,
      brand: {
        heroHeadline: profile.businessName,
        heroDescription: profile.whatYouDo,
        ctaText: profile.primaryCta,
        templateKey: 'ai4-platinum-creative-foundry-v4'
      },
      qa: { passed: true, note: 'Creative rendering is handled by generate-website.js.' }
    })
  };
};
