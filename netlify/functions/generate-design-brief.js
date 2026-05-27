// AI4 Design Studio — Sandbox Design Brief Generator
// Purpose-first sandbox function. Uses Anthropic only when available;
// otherwise returns a deterministic fallback brief so the sandbox can be tested safely.

const https = require("https");
const { designSystems, getPurposeToSystemMap } = require("../../design-systems.js");

const AI_TIMEOUT_MS = 6500;

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const SYSTEM_NAME_TO_ID = Object.fromEntries(
  Object.values(designSystems).map((system) => [system.name.toLowerCase(), system.id])
);

function safeJsonParse(value, fallback = {}) {
  try {
    return JSON.parse(value || "{}");
  } catch (_) {
    return fallback;
  }
}

function clean(value, fallback = "") {
  if (Array.isArray(value)) return value.filter(Boolean);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections
    .map((item) => {
      if (typeof item === "string") {
        return {
          sectionName: item,
          headlineDirection: `A purpose-built ${item.toLowerCase()} section aligned to the visitor goal.`
        };
      }
      return {
        sectionName: clean(item.sectionName || item.name || item.title, "Website Section"),
        headlineDirection: clean(item.headlineDirection || item.purpose || item.description, "Clarifies the visitor path and supports the primary CTA.")
      };
    })
    .filter((item) => item.sectionName);
}

function inferDesignSystem(input) {
  const purposeMap = getPurposeToSystemMap();
  const preferred = clean(input.visualStylePreference);
  const purpose = clean(input.websitePurpose, "Custom / Other");
  const goal = clean(input.primaryGoal);
  const audience = clean(input.targetAudience);
  const impression = clean(input.desiredImpression).toLowerCase();

  if (preferred && preferred !== "Not sure — let AI choose") {
    const id = SYSTEM_NAME_TO_ID[preferred.toLowerCase()];
    if (id && designSystems[id]) return designSystems[id];
  }

  if (purpose === "Business Website") return designSystems["executive-presence"];
  if (purpose === "Local Service Website") return designSystems["modern-trust"];
  if (purpose === "Artist / Music / Creative Showcase") return designSystems["artist-showcase"];
  if (purpose === "Blog / Publication" || goal === "Publish content") return designSystems["digital-magazine"];
  if (purpose === "Portfolio Website" || goal === "Showcase my work") return designSystems["cinematic-portfolio"];
  if (purpose === "Creator / Influencer Website" || goal === "Promote myself") return designSystems["creator-spotlight"];
  if (purpose === "Event / Invitation Website" || goal === "Announce an event" || goal === "Register") return designSystems["event-invitation"];
  if (purpose === "Product / Launch Page" || purpose === "Ecommerce / Product Catalog" || goal === "Sell a product") return designSystems["product-launch"];
  if (purpose === "Nonprofit / Cause Website" || audience === "Donors / supporters" || goal === "Tell a story") return designSystems["nonprofit-story"];
  if (purpose === "Resume / Career Website" || audience === "Recruiters / employers") return designSystems["personal-brand-authority"];
  if (purpose === "Course / Education Website" || audience === "Students / learners") return designSystems["personal-brand-authority"];
  if (purpose === "Community / Membership Website") return designSystems["creator-spotlight"];
  if (purpose === "Restaurant / Hospitality Website" || purpose === "Real Estate / Property Showcase") return designSystems["luxury-reveal"];
  if (impression.includes("futuristic")) return designSystems["futuristic-interface"];
  if (impression.includes("luxurious") || impression.includes("premium") || impression.includes("elegant")) return designSystems["luxury-reveal"];

  const mapped = purposeMap[purpose] || purposeMap["Custom / Other"];
  return designSystems[mapped[0]] || designSystems["executive-presence"];
}

function buildSectionPlan(input, system) {
  const requested = Array.isArray(input.sectionsNeeded) ? input.sectionsNeeded : [];
  const purpose = clean(input.websitePurpose, "Custom / Other");
  const goal = clean(input.primaryGoal, "Create an online presence");
  const cta = clean(input.mainCallToAction, "Start here");

  const defaultsBySystem = {
    "Luxury Reveal": ["Hero / introduction", "About", "Services", "Testimonials", "Call to action", "Contact"],
    "Executive Presence": ["Hero / introduction", "About", "Services", "Testimonials", "FAQ", "Contact"],
    "Cinematic Portfolio": ["Hero / introduction", "Portfolio / gallery", "About", "Media / press", "Call to action", "Contact"],
    "Digital Magazine": ["Hero / introduction", "Blog/articles", "Signup form", "About", "Social links", "Call to action"],
    "Creator Spotlight": ["Hero / introduction", "Social links", "Media / press", "Signup form", "Call to action", "Contact"],
    "Personal Brand Authority": ["Hero / introduction", "About", "Resume / experience", "Media / press", "Call to action", "Contact"],
    "Product Launch": ["Hero / introduction", "Product showcase", "Pricing", "FAQ", "Call to action", "Contact"],
    "Event Invitation": ["Hero / introduction", "Event details", "Booking", "FAQ", "Call to action", "Contact"],
    "Nonprofit Story": ["Hero / introduction", "About", "Donation / support", "Testimonials", "Call to action", "Contact"],
    "Artist Showcase": ["Hero / introduction", "Portfolio / gallery", "Media / press", "Booking", "Call to action", "Contact"],
    "Modern Trust": ["Hero / introduction", "Services", "Testimonials", "FAQ", "Call to action", "Contact"],
    "Futuristic Interface": ["Hero / introduction", "Services", "Product showcase", "Pricing", "FAQ", "Call to action"]
  };

  const merged = [];
  ["Hero / introduction", ...requested, ...(defaultsBySystem[system.name] || [])].forEach((section) => {
    if (section && !merged.includes(section)) merged.push(section);
  });

  if (!merged.includes("Call to action")) merged.push("Call to action");

  return merged.slice(0, 8).map((section, index) => {
    const lower = section.toLowerCase();
    let direction = `Show how this ${purpose.toLowerCase()} supports the visitor goal: ${goal}.`;
    if (index === 0 || lower.includes("hero")) direction = `Open with a premium first viewport that makes the purpose clear and points visitors toward “${cta}.”`;
    if (lower.includes("portfolio") || lower.includes("gallery")) direction = "Use large visual panels that make the work feel selected, intentional, and high-value.";
    if (lower.includes("blog")) direction = "Use an editorial feature layout with clear categories and a strong reason to keep reading.";
    if (lower.includes("testimonial")) direction = "Build trust with concise proof points, reviews, or credibility signals.";
    if (lower.includes("pricing")) direction = "Present the offer clearly with confident value framing and a direct conversion path.";
    if (lower.includes("event")) direction = "Make date, location, agenda, and RSVP details immediately scannable.";
    if (lower.includes("donation") || lower.includes("support")) direction = "Connect the mission to a visible support action without overloading the page.";
    if (lower.includes("contact") || lower.includes("booking") || lower.includes("signup") || lower.includes("call to action")) direction = `Close with a focused action path built around “${cta}.”`;

    return { sectionName: section, headlineDirection: direction };
  });
}

function buildVisualIdentity(system, input) {
  const signature = system.visualSignature || {};
  const colors = system.colorDefaults || {};
  const typography = system.typographyDefaults || {};
  return {
    colorMood: signature.colorMood || "Premium, focused, and purpose-matched",
    typography: `${typography.heading || "Strong display type"} for headlines with ${typography.body || "clean readable type"} for body copy`,
    layoutRhythm: signature.layout || system.layoutPattern || "Purpose-led sections with controlled pacing and clear hierarchy",
    visualMotif: signature.hero || "A clear visual signature that avoids generic card-section repetition"
  };
}

function computeQuality(input, system, sectionPlan, visualIdentity) {
  const flags = [];
  const recommendations = [];
  let score = 72;

  if (clean(input.websitePurpose)) score += 5; else flags.push("Website purpose is missing.");
  if (clean(input.primaryGoal)) score += 5; else flags.push("Primary goal is missing.");
  if (clean(input.targetAudience)) score += 4; else flags.push("Target audience is missing.");
  if (clean(input.desiredImpression)) score += 4;
  if (clean(input.mainCallToAction)) score += 4; else recommendations.push("Add a clear primary call to action.");
  if (clean(input.shortDescription).length >= 40) score += 4; else recommendations.push("Add a more specific short description to improve the creative brief.");
  if (sectionPlan.length >= 5) score += 3; else flags.push("Too few sections were selected for a confident preview.");
  if (system && system.name) score += 3;
  if (visualIdentity.visualMotif) score += 2;

  const genericWarnings = ["business", "website", "professional"].filter((word) =>
    clean(input.shortDescription).toLowerCase() === word
  );
  if (genericWarnings.length) {
    score -= 10;
    flags.push("The description is too generic for a premium design direction.");
  }

  score = Math.max(50, Math.min(98, score));

  let status = "approved";
  if (score < 60) status = "reject";
  else if (score < 75) status = "redesign";
  else if (score < 90) status = "needs_polish";

  if (status !== "approved") {
    recommendations.push("This design direction needs refinement before customer preview.");
  }

  return {
    score,
    status,
    flags,
    recommendations
  };
}

function fallbackBrief(input) {
  const system = inferDesignSystem(input);
  const sectionPlan = buildSectionPlan(input, system);
  const visualIdentity = buildVisualIdentity(system, input);
  const review = computeQuality(input, system, sectionPlan, visualIdentity);
  const purpose = clean(input.websitePurpose, "Custom / Other");
  const audience = clean(input.targetAudience, "Mixed audience");
  const goal = clean(input.primaryGoal, "Create an online presence");
  const cta = clean(input.mainCallToAction, "Start here");
  const brand = clean(input.brandName, "Your Website");

  const creativeDirection = `${brand} should feel like a ${system.name} experience: ${system.tagline || "purpose-built, premium, and distinct"} The site should guide ${audience.toLowerCase()} from immediate clarity into a confident next action, with design decisions driven by ${purpose.toLowerCase()} rather than a generic business template.`;

  const brief = {
    purposeCategory: purpose,
    recommendedDesignSystem: system.name,
    creativeDirection,
    audienceStrategy: `Speak directly to ${audience.toLowerCase()} with a first viewport that clarifies the offer, establishes trust, and supports the primary goal: ${goal}.`,
    sectionPlan,
    visualIdentity,
    ctaStrategy: `Primary CTA: ${cta}. Secondary CTA: Learn more or explore the strongest proof section before converting.`,
    qualityScore: review.score,
    qualityNotes: [...review.flags, ...review.recommendations],
    status: review.status
  };

  return normalizeBrief(brief, input, system, review);
}

function normalizeBrief(rawBrief, input, inferredSystem, reviewOverride) {
  const systemName = clean(rawBrief.recommendedDesignSystem, inferredSystem && inferredSystem.name ? inferredSystem.name : "Executive Presence");
  const systemId = SYSTEM_NAME_TO_ID[systemName.toLowerCase()] || (inferredSystem && inferredSystem.id) || "executive-presence";
  const system = designSystems[systemId] || inferredSystem || designSystems["executive-presence"];
  const sectionPlan = normalizeSections(rawBrief.sectionPlan && rawBrief.sectionPlan.length ? rawBrief.sectionPlan : buildSectionPlan(input, system));
  const visualIdentity = rawBrief.visualIdentity && typeof rawBrief.visualIdentity === "object"
    ? {
        colorMood: clean(rawBrief.visualIdentity.colorMood, system.visualSignature.colorMood),
        typography: clean(rawBrief.visualIdentity.typography, `${system.typographyDefaults.heading} + ${system.typographyDefaults.body}`),
        layoutRhythm: clean(rawBrief.visualIdentity.layoutRhythm, system.visualSignature.layout),
        visualMotif: clean(rawBrief.visualIdentity.visualMotif, system.visualSignature.hero)
      }
    : buildVisualIdentity(system, input);

  const review = reviewOverride || computeQuality(input, system, sectionPlan, visualIdentity);
  const notes = Array.isArray(rawBrief.qualityNotes) && rawBrief.qualityNotes.length
    ? rawBrief.qualityNotes
    : [...review.flags, ...review.recommendations];

  const status = ["approved", "needs_polish", "redesign", "reject"].includes(rawBrief.status)
    ? rawBrief.status
    : review.status;

  const qualityScore = Number.isFinite(Number(rawBrief.qualityScore)) ? Number(rawBrief.qualityScore) : review.score;
  const brandName = clean(input.brandName, "Your Website");
  const ctaText = clean(input.mainCallToAction, "Start here");

  const colorDefaults = system.colorDefaults || {};
  const typeDefaults = system.typographyDefaults || {};

  const finalBrief = {
    purposeCategory: clean(rawBrief.purposeCategory, clean(input.websitePurpose, "Custom / Other")),
    recommendedDesignSystem: system.name,
    creativeDirection: clean(rawBrief.creativeDirection, `${brandName} should use the ${system.name} to create a premium, purpose-built website direction.`),
    audienceStrategy: clean(rawBrief.audienceStrategy, `Guide ${clean(input.targetAudience, "mixed audience").toLowerCase()} toward a confident next action.`),
    sectionPlan,
    visualIdentity,
    ctaStrategy: clean(rawBrief.ctaStrategy, `Primary CTA: ${ctaText}. Secondary CTA: Learn more.`),
    qualityScore,
    qualityNotes: notes,
    status
  };

  return {
    ...finalBrief,
    source: rawBrief.source || "fallback",
    userFacingBrief: {
      brandName,
      websitePurpose: finalBrief.purposeCategory,
      recommendedDesignSystem: finalBrief.recommendedDesignSystem,
      emotionalTone: clean(input.desiredImpression, system.tagline),
      creativeDirection: finalBrief.creativeDirection,
      audienceStrategy: finalBrief.audienceStrategy,
      colorSystem: {
        primary: colorDefaults.primary || "#0a0e1a",
        secondary: colorDefaults.secondary || "#0d1b2a",
        accent: colorDefaults.accent || "#4F6EF7",
        background: colorDefaults.background || "#050810",
        surface: colorDefaults.secondary || "#111827",
        colorMoodDescription: finalBrief.visualIdentity.colorMood
      },
      typographySystem: {
        headingFont: typeDefaults.heading || "Space Grotesk",
        bodyFont: typeDefaults.body || "Inter",
        typographyRationale: finalBrief.visualIdentity.typography
      },
      sectionPlan,
      ctaStrategy: {
        primary: ctaText,
        secondary: finalBrief.ctaStrategy.replace(/^Primary CTA:\s*/i, "")
      },
      qualityScore,
      qualityFlags: notes,
      approvalMessage: status === "approved"
        ? "Approved premium direction. This sandbox brief is ready for preview."
        : "This design direction needs refinement before customer preview."
    }
  };
}

async function tryAnthropicBrief(input) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  let Anthropic;
  try {
    Anthropic = require("@anthropic-ai/sdk");
  } catch (error) {
    return null;
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: AI_TIMEOUT_MS
  });
  const fallback = fallbackBrief(input);
  const prompt = `Create a design-first website brief for this AI4 Design Studio sandbox intake.

Input:
${JSON.stringify(input, null, 2)}

Return JSON only with this exact structure:
{
  "purposeCategory": "",
  "recommendedDesignSystem": "",
  "creativeDirection": "",
  "audienceStrategy": "",
  "sectionPlan": [{"sectionName":"","headlineDirection":""}],
  "visualIdentity": {
    "colorMood": "",
    "typography": "",
    "layoutRhythm": "",
    "visualMotif": ""
  },
  "ctaStrategy": "",
  "qualityScore": 0,
  "qualityNotes": [],
  "status": "approved | needs_polish | redesign | reject"
}

Allowed design systems:
${Object.values(designSystems).map((system) => `- ${system.name}`).join("\n")}

Use the deterministic baseline below as guidance, but make the creative direction more specific:
${JSON.stringify(fallback, null, 2)}`;

  try {
    const response = await Promise.race([
      client.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
        max_tokens: 1200,
        temperature: 0.35,
        system: "You are the AI4 Website Design Studio creative director. Return valid JSON only. No markdown. No commentary.",
        messages: [{ role: "user", content: prompt }]
      }, { timeout: AI_TIMEOUT_MS }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("AI_TIMEOUT_FALLBACK_USED")), AI_TIMEOUT_MS + 500))
    ]);

    const text = response && response.content && response.content[0] && response.content[0].text
      ? response.content[0].text
      : "";
    const parsed = safeJsonParse(text, null);
    if (!parsed || typeof parsed !== "object") return null;

    const inferred = inferDesignSystem(input);
    return normalizeBrief({ ...parsed, source: "anthropic" }, input, inferred);
  } catch (error) {
    return null;
  }
}


function extractOpenAIText(data) {
  if (!data) return "";
  if (typeof data.output_text === "string") return data.output_text;
  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if ((content.type === "output_text" || content.type === "text") && content.text) {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

function callOpenAI(payload, apiKey) {
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.openai.com",
      path: "/v1/responses",
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        let parsed = {};
        try { parsed = JSON.parse(data || "{}"); } catch (_) { parsed = { raw: data }; }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(parsed.error && parsed.error.message ? parsed.error.message : `OpenAI request failed with ${res.statusCode}`));
          return;
        }
        resolve(parsed);
      });
    });

    req.on("error", reject);
    req.setTimeout(AI_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error("OPENAI_TIMEOUT_FALLBACK_USED"));
    });
    req.write(body);
    req.end();
  });
}

async function tryOpenAIBrief(input) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY;
  if (!apiKey) return null;

  const fallback = fallbackBrief(input);
  const prompt = `Create a design-first website brief for this AI4 Design Studio intake.

Input:
${JSON.stringify(input, null, 2)}

Return JSON only with this exact structure:
{
  "purposeCategory": "",
  "recommendedDesignSystem": "",
  "creativeDirection": "",
  "audienceStrategy": "",
  "sectionPlan": [{"sectionName":"","headlineDirection":""}],
  "visualIdentity": {
    "colorMood": "",
    "typography": "",
    "layoutRhythm": "",
    "visualMotif": ""
  },
  "ctaStrategy": "",
  "qualityScore": 0,
  "qualityNotes": [],
  "status": "approved | needs_polish | redesign | reject"
}

Allowed design systems:
${Object.values(designSystems).map((system) => `- ${system.name}`).join("\n")}

Use the deterministic baseline below as guardrails:
${JSON.stringify(fallback, null, 2)}`;

  try {
    const data = await callOpenAI({
      model: process.env.OPENAI_MODEL || process.env.AI4_OUTPUT_AGENT_MODEL || "gpt-5.5",
      input: [
        {
          role: "system",
          content: "You are the AI4 Website Design Studio creative director. Return valid JSON only. No markdown. No commentary."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_output_tokens: 1800
    }, apiKey);

    const text = extractOpenAIText(data);
    const parsed = safeJsonParse(text, null);
    if (!parsed || typeof parsed !== "object") return null;

    const inferred = inferDesignSystem(input);
    return normalizeBrief({ ...parsed, source: "openai" }, input, inferred);
  } catch (error) {
    return null;
  }
}


exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const input = safeJsonParse(event.body, {});
  try {
    const anthropicBrief = await tryAnthropicBrief(input);
    const openAiBrief = anthropicBrief ? null : await tryOpenAIBrief(input);
    const brief = anthropicBrief || openAiBrief || fallbackBrief(input);
    return { statusCode: 200, headers, body: JSON.stringify(brief) };
  } catch (error) {
    const brief = fallbackBrief(input);
    return { statusCode: 200, headers, body: JSON.stringify({ ...brief, source: "fallback_after_error" }) };
  }
};

exports._private = {
  fallbackBrief,
  computeQuality,
  inferDesignSystem,
  normalizeSections
};
