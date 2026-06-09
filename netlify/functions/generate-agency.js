'use strict';
// generate-agency.js — Agency Dossier Engine
// Claude acts as Creative Director building a client's digital flagship.
// Every call produces a completely different, genuinely original promotional site.

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const AGENCY_STANDARDS = `
AGENCY STANDARDS — non-negotiable:
- The headline must make this client's competitors uncomfortable. State their market position with total confidence.
- Copy must speak directly to their ideal client — not to everyone, to the ONE person who needs them most.
- Visual design must look like it belongs in a Behance award showcase — deliberate, considered, premium.
- Typography carries authority. Pair display and body fonts with intention. Make a statement.
- Color is strategy. Every palette choice must serve the client's positioning. Commit fully to one direction.
- White space is presence. Premium brands breathe. Never fill space for the sake of it.
- Every section earns its place by moving the visitor one step closer to taking action.
- The contact section is the close — make it feel like an exclusive invitation, not a form.

ABSOLUTELY FORBIDDEN:
- "Welcome to [Business Name]" — banned forever
- "We are dedicated to..." — amateur
- "Your trusted partner" — meaningless
- "We provide quality services" — unacceptable
- "Years of experience" without specifics — empty filler
- Icon + headline + short paragraph grid — generic template
- Safe blue/white/grey palette — invisible
- Any phrase another business could copy by swapping the name

TECHNICAL REQUIREMENTS:
- Complete standalone HTML — all CSS in <style> in <head>
- Load 1-2 Google Fonts via <link> in <head>
- Fully mobile responsive — CSS Grid and Flexbox with media queries
- CSS custom properties for the full design system
- Sections: hero, proof/credentials, services, differentiator/why-us, contact form, footer
- Contact form: data-netlify="true", name/email/phone/message fields, submit button
- No external JavaScript libraries
- Production quality — launch-ready as delivered`;

function buildContext(a) {
  return [
    a.name  ? 'Client: '              + a.name  : null,
    a.what  ? 'What They Do: '        + a.what  : null,
    a.who   ? 'Their Ideal Client: '  + a.who   : null,
    a.diff  ? 'Why They Win: '        + a.diff  : null,
    a.else  ? 'Additional Context: '  + a.else  : null,
    a.site  ? 'Website: '             + a.site  : null,
    a.email ? 'Email: '               + a.email : null,
    a.addr  ? 'Location: '            + a.addr  : null
  ].filter(Boolean).join('\n');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'POST only' }) };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const a               = body.answers || {};
  const mode            = body.mode || 'full';
  const existingContent = body.existingContent || null;
  const ctx             = buildContext(a);

  let prompt;

  if (mode === 'design' && existingContent) {
    prompt = 'You are the Creative Director at AI4 Businesses, a premium digital agency.\n\n'
      + 'A client account has just changed hands within the agency. The previous team delivered a strong dossier.\n'
      + 'Your team has been challenged to produce a completely different creative interpretation.\n'
      + 'Same client intelligence — entirely different strategic vision. Make the previous version feel like a different era.\n\n'
      + 'CLIENT INTELLIGENCE (preserve this content exactly):\n'
      + 'Client: ' + (existingContent.brand || a.name || '') + '\n'
      + (existingContent.context || ctx) + '\n\n'
      + 'YOUR CREATIVE CHALLENGE:\n'
      + '- Opposite mood: if it was dark go luminous, if minimal go rich and layered\n'
      + '- Different structural logic: if centered narrative try editorial split, if bold asymmetry try refined symmetry\n'
      + '- Different typographic personality: if sharp sans-serif try warm humanist or editorial serif\n'
      + '- Different emotional register: if bold and aggressive try confident and understated\n'
      + '- The client\'s facts are the raw material. Your vision is the transformation.\n'
      + AGENCY_STANDARDS + '\n\n'
      + 'Return ONLY the complete HTML starting with <!DOCTYPE html>. No markdown. No explanation.';
  } else {
    prompt = 'You are the Creative Director at AI4 Businesses, a premium digital agency.\n\n'
      + 'You have just received a new client brief. Your deliverable is their DIGITAL DOSSIER —\n'
      + 'a flagship web presence that establishes this client as the definitive authority in their market.\n\n'
      + 'This is not a website build. This is a strategic document executed in HTML.\n'
      + 'The dossier has three jobs:\n'
      + '1. POSITION — the hero stakes their claim before the visitor can look away\n'
      + '2. PROVE — the body builds undeniable credibility and desire\n'
      + '3. CONVERT — the close makes reaching out feel like the obvious next step\n\n'
      + 'CLIENT BRIEF:\n'
      + (ctx || 'A premium business ready to establish market authority.') + '\n\n'
      + 'YOUR CREATIVE MANDATE:\n'
      + '- Write all copy from scratch — transform the brief into authoritative, compelling language\n'
      + '- Invent a visual identity that feels made for this specific client and no other\n'
      + '- Choose an unexpected creative direction: think award-winning agency portfolios, not business templates\n'
      + '- Every design decision must serve their market positioning\n'
      + '- Make competitors uncomfortable. Make prospects lean forward.\n'
      + '- Each generation must be distinctly different — no two dossiers should look alike\n'
      + AGENCY_STANDARDS + '\n\n'
      + 'Return ONLY the complete HTML starting with <!DOCTYPE html>. No markdown code fences. No explanation.';
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!r.ok) {
      const t = await r.text();
      return { statusCode: 502, headers: HEADERS, body: JSON.stringify({ error: 'Claude API error', detail: t.slice(0, 300) }) };
    }

    const data = await r.json();
    const raw  = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const html = raw.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        html,
        content: { brand: a.name || 'Your Business', context: ctx }
      })
    };
  } catch (err) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Generation failed', detail: String(err).slice(0, 200) }) };
  }
};
