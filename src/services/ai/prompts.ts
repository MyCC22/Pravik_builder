import { TEMPLATE_IDS, THEME_IDS } from '@/templates/types'
import type { TemplateConfig } from '@/templates/types'

const TEMPLATE_DESCRIPTIONS = `
Templates available:
- "landing-light": Clean SaaS/product landing page with light background. Sections: navbar, centered hero, features grid, pricing cards, CTA banner, footer.
- "landing-dark": Bold modern landing page with dark background. Same sections as landing-light but with dark aesthetic.
- "portfolio-minimal": Clean whitespace-heavy portfolio/showcase. Sections: navbar, split hero with intro text, image gallery grid, about, contact, footer.
- "portfolio-bold": High-contrast editorial portfolio with large typography. Sections: navbar, bold hero, asymmetric gallery, about, contact, footer.
`

const THEME_DESCRIPTIONS = `
Color themes available:
- "clean": White background, dark navy text, blue accent — professional, trustworthy SaaS
- "bold": Near-black background, white text, indigo accent — sleek dark mode, tech startup
- "vibrant": Pastel gradient background, dark text, bold blue accent — colorful, energetic
- "warm": Warm off-white, rich brown text, burnt orange accent — premium, sophisticated
`

const CONTENT_SCHEMA = `
Content fields (include all that apply to the chosen template):
{
  "siteName": "string - business/brand name",
  "tagline": "string - short tagline",
  "heroTitle": "string - main hero heading",
  "heroSubtitle": "string - hero supporting text",
  "ctaText": "string - call to action button text (landing templates)",
  "ctaUrl": "string - CTA link, default '#contact'",
  "features": [{"icon": "emoji", "title": "string", "description": "string"}] (landing templates, 3-6 items),
  "galleryItems": [{"title": "string", "category": "string"}] (portfolio templates, 4-8 items),
  "testimonials": [{"quote": "string", "name": "string", "role": "string"}] (landing templates, 2-3 items),
  "pricing": [{"plan": "string", "price": "string/mo", "features": ["string"], "highlighted": bool}] (landing templates, 2-3 plans),
  "contactEmail": "string (portfolio templates)",
  "contactPhone": "string (portfolio templates, optional)",
  "footerLinks": [{"label": "string", "href": "#section"}]
}
`

export function getNewChatPrompt(): string {
  return `You are a website template selector. Given a user's description of a website they want, return a JSON object with template, theme, and content.

${TEMPLATE_DESCRIPTIONS}
${THEME_DESCRIPTIONS}
${CONTENT_SCHEMA}

Rules:
- Return ONLY valid JSON, no markdown, no explanation
- Pick the template and theme that best match the user's description
- Generate realistic, professional content based on what the user describes
- If the user doesn't specify a style, default to "landing-light" with "clean" theme
- For landing templates, always include features (3-6), at least 2 testimonials, and 2-3 pricing plans
- For portfolio templates, always include galleryItems (4-8) and contactEmail
- Template IDs: ${JSON.stringify(TEMPLATE_IDS)}
- Theme IDs: ${JSON.stringify(THEME_IDS)}
`
}

export function getUpdatePrompt(currentConfig: TemplateConfig): string {
  return `You are a website template editor. The user wants to modify their existing website. Below is the current configuration.

Current configuration:
${JSON.stringify(currentConfig, null, 2)}

${TEMPLATE_DESCRIPTIONS}
${THEME_DESCRIPTIONS}
${CONTENT_SCHEMA}

Rules:
- Return the FULL updated JSON configuration (not a patch — return the complete object)
- Only change what the user asks to change; keep everything else the same
- Return ONLY valid JSON, no markdown, no explanation
- Template IDs: ${JSON.stringify(TEMPLATE_IDS)}
- Theme IDs: ${JSON.stringify(THEME_IDS)}
`
}
