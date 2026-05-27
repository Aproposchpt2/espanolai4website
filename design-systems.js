const designSystems = {
  "luxury-reveal": {
    id: "luxury-reveal",
    name: "Luxury Reveal",
    tagline: "Premium. Cinematic. Unforgettable.",
    bestFor: ["Premium personal brands", "Luxury services", "High-end consultants", "Exclusive launches", "Fashion", "Architecture"],
    visualSignature: {
      hero: "Large cinematic full-screen entry with slow reveal animation",
      typography: "Elegant serif headings with refined sans-serif body",
      layout: "Ultra-spacious sections with dramatic whitespace",
      colorMood: "Deep neutrals, champagne, platinum, or rich jewel tones",
      cta: "Understated premium button treatment — never loud"
    },
    colorDefaults: { primary: "#1a1a1a", secondary: "#c9a96e", accent: "#e8dcc8", background: "#f8f5f0", text: "#1a1a1a" },
    typographyDefaults: { heading: "Playfair Display", body: "Libre Baskerville", accent: "Cormorant Garamond" },
    layoutPattern: "fullscreen-hero | spacious-reveal | editorial-sections | minimal-footer"
  },

  "executive-presence": {
    id: "executive-presence",
    name: "Executive Presence",
    tagline: "Authority. Trust. Results.",
    bestFor: ["Business leaders", "Consultants", "Professional services", "B2B authority sites", "Corporate"],
    visualSignature: {
      hero: "Strong editorial hero with bold headline and clear value proposition",
      typography: "Clean geometric sans-serif with strong hierarchy",
      layout: "Structured grid with clear visual hierarchy",
      colorMood: "Navy, charcoal, white with a single strong accent",
      cta: "Clear, direct, conversion-focused"
    },
    colorDefaults: { primary: "#0f2b4a", secondary: "#1a5276", accent: "#2e86ab", background: "#ffffff", text: "#1a1a2e" },
    typographyDefaults: { heading: "Inter", body: "Inter", accent: "none" },
    layoutPattern: "editorial-hero | trust-sections | metric-blocks | strong-cta"
  },

  "cinematic-portfolio": {
    id: "cinematic-portfolio",
    name: "Cinematic Portfolio",
    tagline: "Show. Don't tell.",
    bestFor: ["Creatives", "Designers", "Photographers", "Artists", "Case study portfolios", "Agencies"],
    visualSignature: {
      hero: "Full-screen visual entry — image or video dominant",
      typography: "Large bold display type over visual content",
      layout: "Large project panels with immersive visual presence",
      colorMood: "Dark backdrop to make work shine, or stark white gallery",
      cta: "View work / See projects — always visual-led"
    },
    colorDefaults: { primary: "#0d0d0d", secondary: "#1a1a1a", accent: "#ffffff", background: "#0d0d0d", text: "#ffffff" },
    typographyDefaults: { heading: "Bebas Neue", body: "DM Sans", accent: "none" },
    layoutPattern: "fullscreen-visual | project-panels | case-study-grid | minimal-about"
  },

  "digital-magazine": {
    id: "digital-magazine",
    name: "Digital Magazine",
    tagline: "Publish. Influence. Lead.",
    bestFor: ["Blogs", "Publications", "Thought leadership", "Content creators", "News", "Industry analysis"],
    visualSignature: {
      hero: "Featured story section with editorial grid below",
      typography: "Strong editorial serif + clean sans-serif combination",
      layout: "Magazine-style asymmetric grid with featured and secondary stories",
      colorMood: "Clean white with strong typographic hierarchy",
      cta: "Subscribe / Read more — content-forward"
    },
    colorDefaults: { primary: "#111111", secondary: "#333333", accent: "#e63946", background: "#ffffff", text: "#111111" },
    typographyDefaults: { heading: "Merriweather", body: "Source Sans Pro", accent: "none" },
    layoutPattern: "editorial-hero | magazine-grid | article-cards | category-nav"
  },

  "creator-spotlight": {
    id: "creator-spotlight",
    name: "Creator Spotlight",
    tagline: "Your audience. Your brand. Your moment.",
    bestFor: ["Influencers", "YouTubers", "Podcasters", "Personal promotion", "Social-first creators"],
    visualSignature: {
      hero: "Personal intro hero with social proof bar immediately below",
      typography: "Friendly, approachable, energetic type",
      layout: "Featured content modules with social integration",
      colorMood: "Vibrant, energetic, personality-driven palette",
      cta: "Follow / Subscribe / Join — community-building"
    },
    colorDefaults: { primary: "#6c3483", secondary: "#a569bd", accent: "#f0b429", background: "#fafafa", text: "#1a1a1a" },
    typographyDefaults: { heading: "Poppins", body: "Nunito", accent: "none" },
    layoutPattern: "personal-hero | social-proof | content-modules | media-highlights"
  },

  "personal-brand-authority": {
    id: "personal-brand-authority",
    name: "Personal Brand Authority",
    tagline: "You are the expert. Make them believe it.",
    bestFor: ["Coaches", "Speakers", "Career professionals", "Consultants", "Experts", "Authors"],
    visualSignature: {
      hero: "Strong personal hero with bio and credibility markers",
      typography: "Professional with warmth — approachable authority",
      layout: "Story-driven with authority proof blocks",
      colorMood: "Confident, warm, professional palette",
      cta: "Work with me / Book a call / Get started"
    },
    colorDefaults: { primary: "#2c3e50", secondary: "#34495e", accent: "#e67e22", background: "#ffffff", text: "#2c3e50" },
    typographyDefaults: { heading: "Raleway", body: "Open Sans", accent: "none" },
    layoutPattern: "personal-hero | bio-story | authority-blocks | media-credibility | contact-cta"
  },

  "product-launch": {
    id: "product-launch",
    name: "Product Launch",
    tagline: "One product. One moment. Maximum impact.",
    bestFor: ["Product drops", "SaaS previews", "Digital products", "App launches", "Offer pages"],
    visualSignature: {
      hero: "Conversion-first hero with product visual and immediate CTA",
      typography: "Bold, direct, benefit-focused",
      layout: "Feature reveals, benefit cards, urgency sections",
      colorMood: "High contrast, energetic, conversion-optimized",
      cta: "Get it now / Start free / Join waitlist — urgent and clear"
    },
    colorDefaults: { primary: "#16213e", secondary: "#0f3460", accent: "#e94560", background: "#ffffff", text: "#16213e" },
    typographyDefaults: { heading: "Space Grotesk", body: "DM Sans", accent: "none" },
    layoutPattern: "conversion-hero | benefit-cards | feature-reveal | pricing-cta | urgency-section"
  },

  "event-invitation": {
    id: "event-invitation",
    name: "Event Invitation",
    tagline: "The moment. The place. The reason to be there.",
    bestFor: ["Events", "Conferences", "Weddings", "Private invitations", "Ticketed experiences"],
    visualSignature: {
      hero: "Date-forward hero with event identity",
      typography: "Event-appropriate type — formal to celebratory depending on event",
      layout: "Date, details, agenda, location, RSVP in clear sequence",
      colorMood: "Event-matched palette — premium, celebratory, or corporate",
      cta: "Register / RSVP / Get tickets — date-urgent"
    },
    colorDefaults: { primary: "#1a1a2e", secondary: "#16213e", accent: "#c9a96e", background: "#fafafa", text: "#1a1a1a" },
    typographyDefaults: { heading: "Cormorant Garamond", body: "Lato", accent: "none" },
    layoutPattern: "date-hero | event-details | agenda-timeline | speakers | rsvp-block | location"
  },

  "nonprofit-story": {
    id: "nonprofit-story",
    name: "Nonprofit Story",
    tagline: "The mission. The people. The change.",
    bestFor: ["Causes", "Community efforts", "Fundraising", "Awareness campaigns", "NGOs"],
    visualSignature: {
      hero: "Human story hero with emotional resonance",
      typography: "Warm, trustworthy, human",
      layout: "Mission, impact stats, stories, donation CTA",
      colorMood: "Warm, hopeful, trustworthy palette",
      cta: "Donate / Support / Get involved — emotionally resonant"
    },
    colorDefaults: { primary: "#1b4332", secondary: "#2d6a4f", accent: "#f4a261", background: "#ffffff", text: "#1b1b1b" },
    typographyDefaults: { heading: "Lora", body: "Source Sans Pro", accent: "none" },
    layoutPattern: "story-hero | mission-section | impact-stats | stories | donation-cta | community-trust"
  },

  "artist-showcase": {
    id: "artist-showcase",
    name: "Artist Showcase",
    tagline: "Raw. Expressive. Unforgettable.",
    bestFor: ["Musicians", "Artists", "Performers", "Creative portfolios", "Studios"],
    visualSignature: {
      hero: "Expressive, full-bleed visual or audio-visual hero",
      typography: "Expressive, personality-driven type choices",
      layout: "Gallery-forward with featured work prominence",
      colorMood: "Bold, expressive, artist-specific palette",
      cta: "Listen / View / Book / Commission"
    },
    colorDefaults: { primary: "#0d0d0d", secondary: "#1a1a1a", accent: "#ff006e", background: "#0d0d0d", text: "#ffffff" },
    typographyDefaults: { heading: "Anton", body: "DM Sans", accent: "none" },
    layoutPattern: "expressive-hero | gallery-section | featured-work | project-blocks | booking-cta"
  },

  "modern-trust": {
    id: "modern-trust",
    name: "Modern Trust",
    tagline: "Clear. Reliable. Ready to serve.",
    bestFor: ["Local services", "Small businesses", "Practical service providers", "Professional offers"],
    visualSignature: {
      hero: "Clean trust-first hero with clear service statement",
      typography: "Clean, readable, professional",
      layout: "Service explanation, reviews, simple contact path",
      colorMood: "Trustworthy blue or green with clean white",
      cta: "Call now / Get a quote / Book service — practical and direct"
    },
    colorDefaults: { primary: "#1565c0", secondary: "#1976d2", accent: "#ffa000", background: "#ffffff", text: "#1a1a1a" },
    typographyDefaults: { heading: "Roboto", body: "Roboto", accent: "none" },
    layoutPattern: "trust-hero | service-explanation | reviews | simple-contact | map-location"
  },

  "futuristic-interface": {
    id: "futuristic-interface",
    name: "Futuristic Interface",
    tagline: "The future is operational.",
    bestFor: ["AI products", "Tech products", "Automation services", "Digital tools", "Innovative brands", "SaaS"],
    visualSignature: {
      hero: "Dark interface feel with grid overlays and electric accents",
      typography: "Geometric, precise, technical",
      layout: "Data-card layout with command-center aesthetic",
      colorMood: "Dark background with neon/electric accent colors",
      cta: "Start now / Launch / Access — action-forward"
    },
    colorDefaults: { primary: "#0a0e1a", secondary: "#0d1b2a", accent: "#4F6EF7", background: "#050810", text: "#e0e6ff" },
    typographyDefaults: { heading: "Space Grotesk", body: "Inter", accent: "JetBrains Mono" },
    layoutPattern: "dark-interface-hero | feature-grid | data-cards | demo-section | command-cta"
  }
};

const getPurposeToSystemMap = () => ({
  "Business Website": ["executive-presence", "modern-trust"],
  "Personal Brand Website": ["personal-brand-authority", "luxury-reveal"],
  "Portfolio Website": ["cinematic-portfolio", "artist-showcase"],
  "Blog / Publication": ["digital-magazine", "personal-brand-authority"],
  "Creator / Influencer Website": ["creator-spotlight", "personal-brand-authority"],
  "Event / Invitation Website": ["event-invitation"],
  "Product / Launch Page": ["product-launch", "futuristic-interface"],
  "Nonprofit / Cause Website": ["nonprofit-story"],
  "Resume / Career Website": ["personal-brand-authority", "executive-presence"],
  "Course / Education Website": ["personal-brand-authority", "modern-trust"],
  "Community / Membership Website": ["creator-spotlight", "nonprofit-story"],
  "Artist / Music / Creative Showcase": ["artist-showcase", "cinematic-portfolio"],
  "Real Estate / Property Showcase": ["luxury-reveal", "modern-trust"],
  "Restaurant / Hospitality Website": ["luxury-reveal", "artist-showcase"],
  "Local Service Website": ["modern-trust", "executive-presence"],
  "Ecommerce / Product Catalog": ["product-launch", "modern-trust"],
  "Custom / Other": ["executive-presence", "luxury-reveal"],
  "AI / Tech Product": ["futuristic-interface", "product-launch"]
});

if (typeof module !== "undefined") {
  module.exports = { designSystems, getPurposeToSystemMap };
}
