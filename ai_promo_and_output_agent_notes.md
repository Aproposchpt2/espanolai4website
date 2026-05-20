# Spanish Site Promo + AI Output Agent Notes

This revision brings the Spanish site into alignment with the English promo build.

## Added

- Founder promo backend:
  - `netlify/functions/redeem-founder-promo.js`
  - `netlify/functions/save-build.js`
  - `AI4_founders_offer_promo_supabase_setup.sql`

- AI output quality backend:
  - `netlify/functions/optimize-site-output.js`

- Builder flow:
  - `build.html` now sends generated Spanish HTML through the AI output optimizer.
  - `build.html` now saves the selected build with `save-build` before going to `offer.html`.

- Offer flow:
  - `offer.html` now includes a Spanish Founder promo redemption box.
  - Promo redemption calls `/.netlify/functions/redeem-founder-promo`.

## Required Environment Variables

```text
OPENAI_API_KEY=your_openai_api_key
AI4_OUTPUT_AGENT_MODEL=gpt-5.5
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=AI4 Website Design <jmitchell@ai4websitedesign.com>
FOUNDER_PROMO_CODES=CODE1,CODE2
```

`SUPABASE_SERVICE_KEY` is also supported if the site already uses that name.
