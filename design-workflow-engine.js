// ============================================
// AI4 Design Studio — Frontend Workflow Engine
// Test-ready sandbox version.
// - Calls generate-design-brief Netlify Function.
// - Uses a browser-side deterministic fallback if the function stalls.
// - Prevents the loading screen from freezing during final assembly.
// ============================================

const totalSteps = 13;
let currentStep = 1;
const formData = {};
let pipelineSettled = false;
let pipelineWatchdog = null;

// ── Step navigation ──────────────────────────
function updateProgress() {
  const pct = (currentStep / totalSteps) * 100;
  document.getElementById("progressFill").style.width = pct + "%";
  document.getElementById("progressLabel").textContent = `Step ${currentStep} of ${totalSteps}`;
}

function nextStep() {
  if (!validateStep(currentStep)) return;
  collectStep(currentStep);
  if (currentStep < totalSteps) {
    document.querySelector(`[data-step="${currentStep}"]`).classList.remove("active");
    currentStep++;
    document.querySelector(`[data-step="${currentStep}"]`).classList.add("active");
    updateProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function prevStep() {
  if (currentStep > 1) {
    document.querySelector(`[data-step="${currentStep}"]`).classList.remove("active");
    currentStep--;
    document.querySelector(`[data-step="${currentStep}"]`).classList.add("active");
    updateProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

// ── Validation ───────────────────────────────
function validateStep(step) {
  const stepEl = document.querySelector(`[data-step="${step}"]`);
  const grid = stepEl.querySelector(".options-grid");
  const input = stepEl.querySelector(".studio-input");

  if (grid) {
    const selected = grid.querySelectorAll(".option-btn.selected");
    if (selected.length === 0) {
      showStepError(stepEl, "Please make a selection to continue.");
      return false;
    }
  }

  if (input && input.id === "brandName" && !input.value.trim()) {
    showStepError(stepEl, "Please enter your brand or website name.");
    return false;
  }

  if (input && input.id === "shortDescription" && !input.value.trim()) {
    showStepError(stepEl, "Please describe what you do.");
    return false;
  }

  clearStepError(stepEl);
  return true;
}

function showStepError(stepEl, msg) {
  let err = stepEl.querySelector(".step-error");
  if (!err) {
    err = document.createElement("div");
    err.className = "step-error";
    err.style.cssText = "color:#ef4444;font-size:13px;margin-bottom:12px;padding:8px 12px;background:rgba(239,68,68,0.08);border-left:2px solid #ef4444;border-radius:0 4px 4px 0;";
    stepEl.querySelector(".step-nav").before(err);
  }
  err.textContent = msg;
}

function clearStepError(stepEl) {
  const err = stepEl.querySelector(".step-error");
  if (err) err.remove();
}

// ── Collect form data ────────────────────────
function collectStep(step) {
  const stepEl = document.querySelector(`[data-step="${step}"]`);
  const grid = stepEl.querySelector(".options-grid");
  const input = stepEl.querySelector(".studio-input");

  if (grid) {
    const field = grid.dataset.field;
    const type = grid.dataset.type;
    if (type === "single") {
      const sel = grid.querySelector(".option-btn.selected");
      if (sel) formData[field] = sel.dataset.value;
    } else {
      const sels = grid.querySelectorAll(".option-btn.selected");
      formData[field] = Array.from(sels).map(b => b.dataset.value);
    }
  }

  if (input) formData[input.id] = input.value.trim();
}

// ── Option buttons ───────────────────────────
document.querySelectorAll(".options-grid").forEach(grid => {
  const type = grid.dataset.type;
  grid.querySelectorAll(".option-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (type === "single") {
        grid.querySelectorAll(".option-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      } else {
        btn.classList.toggle("selected");
      }
    });
  });
});

// ── Submit & pipeline ────────────────────────
async function submitForm() {
  collectStep(13);
  pipelineSettled = false;

  // Hide form, show pipeline
  document.getElementById("studioForm").style.display = "none";
  document.getElementById("pipelineLoading").classList.add("active");

  const progressTrack = document.querySelector(".progress-track");
  if (progressTrack) progressTrack.style.display = "none";

  const progressLabel = document.getElementById("progressLabel");
  if (progressLabel) progressLabel.style.display = "none";

  resetWorkflowProgress();
  simulateWorkflowProgress();

  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => controller.abort(), 18000);

  // Hard UI safety net: the sandbox should never stay frozen during testing.
  pipelineWatchdog = setTimeout(() => {
    if (!pipelineSettled) {
      pipelineSettled = true;
      controller.abort();
      const fallback = buildClientFallbackBrief(formData, "client_fallback_after_timeout");
      renderResults(fallback);
    }
  }, 21000);

  try {
    const res = await fetch("/.netlify/functions/generate-design-brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
      signal: controller.signal
    });

    clearTimeout(fetchTimeout);

    if (!res.ok) {
      throw new Error(`Design brief function returned ${res.status}`);
    }

    const data = await res.json();
    if (pipelineSettled) return;
    pipelineSettled = true;
    clearTimeout(pipelineWatchdog);
    renderResults(data);

  } catch (err) {
    clearTimeout(fetchTimeout);
    if (pipelineSettled) return;
    pipelineSettled = true;
    clearTimeout(pipelineWatchdog);
    console.warn("Pipeline fallback used:", err);
    const fallback = buildClientFallbackBrief(formData, "client_fallback_after_function_error");
    renderResults(fallback);
  }
}

function resetWorkflowProgress() {
  ["workflow-1", "workflow-2", "workflow-3", "workflow-4", "workflow-5", "workflow-6", "workflow-7"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("running", "complete");
    const status = el.querySelector(".workflow-status");
    if (status) status.textContent = "waiting";
  });
}

function simulateWorkflowProgress() {
  const workflows = ["workflow-1", "workflow-2", "workflow-3", "workflow-4", "workflow-5", "workflow-6", "workflow-7"];
  const delays = [0, 1800, 3600, 5400, 7200, 9000, 10800];
  const completeTimes = [1500, 3300, 5100, 6900, 8700, 10500, 12500];

  workflows.forEach((id, i) => {
    setTimeout(() => {
      if (pipelineSettled) return;
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove("complete");
      el.classList.add("running");
      const status = el.querySelector(".workflow-status");
      if (status) status.textContent = "running...";
    }, delays[i]);

    setTimeout(() => {
      if (pipelineSettled) return;
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove("running");
      el.classList.add("complete");
      const status = el.querySelector(".workflow-status");
      if (status) status.textContent = "complete ✓";
    }, completeTimes[i]);
  });
}

function completeAllWorkflows() {
  ["workflow-1", "workflow-2", "workflow-3", "workflow-4", "workflow-5", "workflow-6", "workflow-7"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("running");
    el.classList.add("complete");
    const status = el.querySelector(".workflow-status");
    if (status) status.textContent = "complete ✓";
  });
}

// ── Browser-side deterministic fallback ──────
function safeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getSystemById(id) {
  if (typeof designSystems !== "undefined" && designSystems[id]) return designSystems[id];
  return {
    id: "executive-presence",
    name: "Executive Presence",
    tagline: "Professional. Credible. Built for trust.",
    colorDefaults: { primary: "#0a0e1a", secondary: "#0d1b2a", accent: "#4F6EF7", background: "#050810", text: "#e0e6ff" },
    typographyDefaults: { heading: "Space Grotesk", body: "Inter" },
    visualSignature: {
      colorMood: "Deep, credible, premium, and polished",
      layout: "Strong hero, trust sections, proof blocks, and focused CTA flow",
      hero: "Editorial hero with professional authority framing"
    }
  };
}

function chooseClientDesignSystem(input) {
  const purpose = safeText(input.websitePurpose, "Custom / Other");
  const goal = safeText(input.primaryGoal);
  const audience = safeText(input.targetAudience);
  const preference = safeText(input.visualStylePreference);

  const preferenceMap = {
    "Luxury Reveal": "luxury-reveal",
    "Executive Presence": "executive-presence",
    "Cinematic": "cinematic-portfolio",
    "Digital Magazine": "digital-magazine",
    "Portfolio Prestige": "cinematic-portfolio",
    "Creator Spotlight": "creator-spotlight",
    "Product Launch": "product-launch",
    "Minimal Modern": "modern-trust",
    "Bold Graphic": "artist-showcase",
    "Warm Editorial": "digital-magazine",
    "Futuristic Interface": "futuristic-interface",
    "Artistic Showcase": "artist-showcase"
  };

  if (preference && preference !== "Not sure — let AI choose" && preferenceMap[preference]) {
    return getSystemById(preferenceMap[preference]);
  }

  if (purpose === "Business Website") return getSystemById("executive-presence");
  if (purpose === "Local Service Website") return getSystemById("modern-trust");
  if (purpose === "Blog / Publication" || goal === "Publish content") return getSystemById("digital-magazine");
  if (purpose === "Portfolio Website" || goal === "Showcase my work") return getSystemById("cinematic-portfolio");
  if (purpose === "Creator / Influencer Website" || goal === "Promote myself") return getSystemById("creator-spotlight");
  if (purpose === "Event / Invitation Website" || goal === "Announce an event" || goal === "Register") return getSystemById("event-invitation");
  if (purpose === "Product / Launch Page" || purpose === "Ecommerce / Product Catalog" || goal === "Sell a product") return getSystemById("product-launch");
  if (purpose === "Nonprofit / Cause Website" || audience === "Donors / supporters" || goal === "Tell a story") return getSystemById("nonprofit-story");
  if (purpose === "Artist / Music / Creative Showcase") return getSystemById("artist-showcase");
  if (purpose === "Resume / Career Website" || purpose === "Course / Education Website") return getSystemById("personal-brand-authority");
  if (purpose === "Real Estate / Property Showcase" || purpose === "Restaurant / Hospitality Website") return getSystemById("luxury-reveal");
  return getSystemById("executive-presence");
}

function buildClientSectionPlan(input, system) {
  const requested = Array.isArray(input.sectionsNeeded) ? input.sectionsNeeded : [];
  const cta = safeText(input.mainCallToAction, "Start here");
  const purpose = safeText(input.websitePurpose, "Custom / Other");

  const defaults = {
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
  ["Hero / introduction", ...requested, ...(defaults[system.name] || defaults["Executive Presence"])].forEach((section) => {
    if (section && !merged.includes(section)) merged.push(section);
  });

  return merged.slice(0, 8).map((section, index) => ({
    sectionName: section,
    headlineDirection: index === 0
      ? `Open with a premium first viewport for this ${purpose.toLowerCase()} and point visitors toward “${cta}.”`
      : `Use this section to support the visitor path and reinforce the ${system.name} direction.`
  }));
}

function buildClientFallbackBrief(input, source) {
  const system = chooseClientDesignSystem(input);
  const brandName = safeText(input.brandName, "Your Website");
  const purpose = safeText(input.websitePurpose, "Custom / Other");
  const audience = safeText(input.targetAudience, "Mixed audience");
  const goal = safeText(input.primaryGoal, "Create an online presence");
  const cta = safeText(input.mainCallToAction, "Start here");
  const sectionPlan = buildClientSectionPlan(input, system);

  let score = 82;
  const notes = [];
  if (safeText(input.shortDescription).length >= 40) score += 6;
  else notes.push("Add a more specific short description to strengthen the creative brief.");
  if (sectionPlan.length >= 5) score += 4;
  else notes.push("Select more sections for a fuller preview direction.");
  if (safeText(input.desiredImpression)) score += 3;
  if (safeText(input.visualStylePreference) && input.visualStylePreference !== "Not sure — let AI choose") score += 3;
  score = Math.min(score, 96);

  const status = score >= 90 ? "approved" : "needs_polish";
  if (status !== "approved") {
    notes.push("This design direction needs refinement before customer preview.");
  }

  const colorDefaults = system.colorDefaults || {};
  const typeDefaults = system.typographyDefaults || {};
  const signature = system.visualSignature || {};

  const creativeDirection = `${brandName} should feel like a ${system.name} experience built around ${purpose.toLowerCase()}, not a generic template. The design should guide ${audience.toLowerCase()} from immediate clarity into the main goal: ${goal}.`;

  return {
    purposeCategory: purpose,
    recommendedDesignSystem: system.name,
    creativeDirection,
    audienceStrategy: `Speak directly to ${audience.toLowerCase()} with a first viewport that clarifies the purpose, establishes credibility, and supports “${cta}.”`,
    sectionPlan,
    visualIdentity: {
      colorMood: signature.colorMood || "Premium, focused, and purpose-matched",
      typography: `${typeDefaults.heading || "Space Grotesk"} for display headlines with ${typeDefaults.body || "Inter"} for readable body copy`,
      layoutRhythm: signature.layout || "Purpose-led sections with controlled pacing and clear hierarchy",
      visualMotif: signature.hero || "A distinct first-viewport signature that avoids generic card-section repetition"
    },
    ctaStrategy: `Primary CTA: ${cta}. Secondary CTA: explore proof, details, or featured work before converting.`,
    qualityScore: score,
    qualityNotes: notes,
    status,
    source,
    userFacingBrief: {
      brandName,
      websitePurpose: purpose,
      recommendedDesignSystem: system.name,
      emotionalTone: safeText(input.desiredImpression, system.tagline || "Premium and purposeful"),
      creativeDirection,
      audienceStrategy: `Guide ${audience.toLowerCase()} from clear purpose to confident action.`,
      colorSystem: {
        primary: colorDefaults.primary || "#0a0e1a",
        secondary: colorDefaults.secondary || "#0d1b2a",
        accent: colorDefaults.accent || "#4F6EF7",
        background: colorDefaults.background || "#050810",
        surface: colorDefaults.secondary || "#111827",
        colorMoodDescription: signature.colorMood || "Premium, focused, and purpose-matched"
      },
      typographySystem: {
        headingFont: typeDefaults.heading || "Space Grotesk",
        bodyFont: typeDefaults.body || "Inter",
        typographyRationale: `${typeDefaults.heading || "Strong display type"} + ${typeDefaults.body || "clean readable type"} creates a polished design direction.`
      },
      sectionPlan,
      ctaStrategy: {
        primary: cta,
        secondary: "Explore the strongest proof section before converting"
      },
      qualityScore: score,
      qualityFlags: notes,
      approvalMessage: status === "approved"
        ? "Approved premium direction. This sandbox brief is ready for preview."
        : "This design direction needs refinement before customer preview."
    }
  };
}

// ── Render results ───────────────────────────
function renderResults(data) {
  clearTimeout(pipelineWatchdog);
  completeAllWorkflows();

  document.getElementById("pipelineLoading").classList.remove("active");
  const panel = document.getElementById("resultsPanel");
  panel.classList.add("active");

  const brief = data.userFacingBrief || {};
  const status = data.status || "error";
  const score = brief.qualityScore || data.qualityScore || 0;

  // Badge
  const badge = document.getElementById("qualityBadge");
  badge.className = `quality-badge ${status}`;
  const statusLabels = {
    approved: "✅ APPROVED — PREMIUM DESIGN",
    needs_polish: "⚠️ NEEDS POLISH",
    redesign: "🔄 REDESIGN IN PROGRESS",
    reject: "❌ DESIGN REJECTED",
    error: "⚠️ PIPELINE ERROR"
  };
  badge.textContent = statusLabels[status] || status.toUpperCase();

  // Score
  document.getElementById("scoreDisplay").textContent = score ? `${score}/100` : "—";
  document.getElementById("approvalMessage").textContent = brief.approvalMessage || data.errorMessage || "";

  // Grid cards
  const grid = document.getElementById("resultsGrid");
  grid.innerHTML = "";

  if (brief.brandName) addCard(grid, "Brand", brief.brandName);
  if (brief.websitePurpose) addCard(grid, "Purpose Category", brief.websitePurpose);
  if (brief.recommendedDesignSystem) addCard(grid, "Design System", brief.recommendedDesignSystem);
  if (brief.emotionalTone) addCard(grid, "Emotional Tone", brief.emotionalTone);

  if (brief.creativeDirection) {
    addCard(grid, "Creative Direction", brief.creativeDirection, true);
  }

  if (brief.colorSystem) {
    const colors = brief.colorSystem;
    const swatchHtml = Object.entries(colors)
      .filter(([k]) => k !== "colorMoodDescription")
      .map(([k, v]) => `<div class="swatch" style="background:${escAttr(v)}" title="${escAttr(k)}: ${escAttr(v)}"></div>`)
      .join("");
    addCard(grid, "Color System", `<div class="color-swatches">${swatchHtml}</div><div style="font-size:12px;color:var(--text-muted);margin-top:8px">${escHtml(colors.colorMoodDescription || "")}</div>`, true, true);
  }

  if (brief.typographySystem) {
    const t = brief.typographySystem;
    addCard(grid, "Typography", `<strong>${escHtml(t.headingFont)}</strong> + ${escHtml(t.bodyFont)}<div style="font-size:12px;color:var(--text-muted);margin-top:4px">${escHtml(t.typographyRationale || "")}</div>`, true, true);
  }

  if (brief.sectionPlan && brief.sectionPlan.length) {
    const sectionHtml = `<div class="section-list">${brief.sectionPlan.map((s, i) => `
      <div class="section-item">
        <span class="section-num">${String(i + 1).padStart(2, "0")}</span>
        <div><strong>${escHtml(s.sectionName)}</strong><br><span style="font-size:12px;color:var(--text-muted)">${escHtml(s.headlineDirection || s.purpose || "")}</span></div>
      </div>`).join("")}</div>`;
    addCard(grid, "Site Structure", sectionHtml, true, true);
  }

  if (brief.ctaStrategy) {
    const cta = brief.ctaStrategy;
    addCard(grid, "CTA Strategy", `Primary: ${escHtml(cta.primary || "—")}<br>Secondary: ${escHtml(cta.secondary || "—")}`, true, true);
  }

  // Flags
  const flags = brief.qualityFlags || data.qualityNotes || [];
  if (flags.length) {
    document.getElementById("flagsSection").style.display = "block";
    document.getElementById("flagsList").innerHTML = flags.map(f => `<div class="flag-item">${escHtml(f)}</div>`).join("");
  } else {
    document.getElementById("flagsSection").style.display = "none";
  }

  // CTAs
  const ctaDiv = document.getElementById("resultsCta");
  ctaDiv.innerHTML = "";

  if (status === "approved" || status === "needs_polish") {
    persistDesignStudioHandoff(data);
    const proceedBtn = document.createElement("a");
    proceedBtn.href = "ai4-design-studio-preview.html";
    proceedBtn.className = "btn-proceed";
    proceedBtn.textContent = "View Full Preview →";
    ctaDiv.appendChild(proceedBtn);
  }

  const refineBtn = document.createElement("button");
  refineBtn.className = "btn-refine";
  refineBtn.textContent = "Start Over";
  refineBtn.onclick = () => location.reload();
  ctaDiv.appendChild(refineBtn);

  panel.scrollIntoView({ behavior: "smooth" });
}


function persistDesignStudioHandoff(data) {
  try {
    const brief = (data && data.userFacingBrief) || data || {};
    const brandName = safeText(brief.brandName || formData.brandName, "AI4 Design Studio Preview");
    const purpose = safeText(brief.websitePurpose || data.purposeCategory || formData.websitePurpose, "Custom / Other");
    const designSystem = safeText(brief.recommendedDesignSystem || data.recommendedDesignSystem, "Executive Presence");
    const goal = safeText(formData.primaryGoal, "Create an online presence");
    const audience = safeText(formData.targetAudience, "Mixed audience");

    const siteData = {
      source: "ai4-design-studio",
      language: "en",
      businessName: brandName,
      business_name: brandName,
      websitePurpose: purpose,
      primaryGoal: goal,
      targetAudience: audience,
      desiredImpression: safeText(formData.desiredImpression),
      visualStylePreference: safeText(formData.visualStylePreference),
      contentPersonality: safeText(formData.contentPersonality),
      shortDescription: safeText(formData.shortDescription),
      mainCallToAction: safeText(formData.mainCallToAction, "Start here"),
      optionalNotes: safeText(formData.optionalNotes),
      designSystem,
      creativeDirection: safeText(brief.creativeDirection || data.creativeDirection),
      audienceStrategy: safeText(brief.audienceStrategy || data.audienceStrategy),
      sectionPlan: brief.sectionPlan || data.sectionPlan || [],
      visualIdentity: data.visualIdentity || {},
      qualityScore: brief.qualityScore || data.qualityScore || null,
      designBrief: data
    };

    sessionStorage.setItem("ai4DesignBrief", JSON.stringify(data));
    sessionStorage.setItem("ai4_design_brief", JSON.stringify(data));
    sessionStorage.setItem("ai4_site_data", JSON.stringify(siteData));
    sessionStorage.setItem("ai4_built_html", buildDesignBriefPreviewHtml(siteData));
    sessionStorage.setItem("ai4_build_persisted", "false");
  } catch (error) {
    console.warn("AI4 Design Studio handoff could not be saved:", error);
    try { sessionStorage.setItem("ai4DesignBrief", JSON.stringify(data)); } catch (_) {}
  }
}

function buildDesignBriefPreviewHtml(siteData) {
  const sections = Array.isArray(siteData.sectionPlan) ? siteData.sectionPlan : [];
  const sectionItems = sections.slice(0, 7).map((item) => {
    const name = escHtml(item.sectionName || item.name || String(item));
    const direction = escHtml(item.headlineDirection || item.description || "");
    return `<article class="section-card"><span>${name}</span><p>${direction}</p></article>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${escHtml(siteData.businessName)} — AI4 Design Brief Preview</title>
<style>
:root{--bg:#030816;--panel:#07172d;--line:rgba(91,211,255,.22);--blue:#5BD3FF;--text:#F5F8FF;--muted:#AEBED3}
*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;background:radial-gradient(circle at 18% 10%,rgba(91,211,255,.22),transparent 30%),linear-gradient(180deg,#030816,#061225);color:var(--text)}
main{min-height:100vh;padding:8vw;display:grid;gap:28px;align-content:center}
.kicker{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--blue);font-weight:800}
h1{font-size:clamp(38px,7vw,82px);line-height:.9;margin:0;letter-spacing:-.06em}
p{color:var(--muted);font-size:18px;line-height:1.65;max-width:780px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-top:14px}
.section-card{border:1px solid var(--line);border-radius:22px;background:rgba(7,23,45,.72);padding:20px}
.section-card span{display:block;color:var(--text);font-weight:800;margin-bottom:8px}
.section-card p{font-size:13px;margin:0;color:var(--muted)}
.cta{display:inline-flex;margin-top:10px;padding:14px 20px;border-radius:999px;background:linear-gradient(135deg,#F5F8FF,#5BD3FF);color:#03101f;font-weight:900;width:max-content}
</style>
</head>
<body>
<main>
  <div class="kicker">${escHtml(siteData.designSystem)} · ${escHtml(siteData.websitePurpose)}</div>
  <h1>${escHtml(siteData.businessName)}</h1>
  <p>${escHtml(siteData.creativeDirection || siteData.shortDescription || "A purpose-built website direction created by AI4 Design Studio.")}</p>
  <div class="grid">${sectionItems}</div>
  <div class="cta">${escHtml(siteData.mainCallToAction || "Start here")}</div>
</main>
</body>
</html>`;
}


function addCard(grid, label, value, fullWidth = false, isHtml = false) {
  const card = document.createElement("div");
  card.className = `result-card${fullWidth ? " full-width" : ""}`;
  card.innerHTML = `<div class="result-card-label">${escHtml(label)}</div><div class="result-card-value">${isHtml ? value : escHtml(value)}</div>`;
  grid.appendChild(card);
}

function renderError(msg) {
  completeAllWorkflows();
  document.getElementById("pipelineLoading").classList.remove("active");
  const panel = document.getElementById("resultsPanel");
  panel.classList.add("active");
  document.getElementById("qualityBadge").className = "quality-badge reject";
  document.getElementById("qualityBadge").textContent = "⚠️ PIPELINE ERROR";
  document.getElementById("approvalMessage").textContent = msg;
  document.getElementById("resultsCta").innerHTML = `<button class="btn-refine" onclick="location.reload()">Try Again</button>`;
}

function escHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function escAttr(str) {
  return escHtml(str).replace(/'/g, "&#39;");
}
