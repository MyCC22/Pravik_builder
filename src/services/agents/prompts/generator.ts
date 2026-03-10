import { TEMPLATE_IDS, THEME_IDS } from '@/templates/types'

const TEMPLATE_DESCRIPTIONS = `
Templates available:
- "landing-light": Clean SaaS/product landing page with light background. Sections: navbar, centered hero, features grid, pricing cards, CTA banner, footer.
- "landing-dark": Bold modern landing page with dark background. Same sections as landing-light but with dark aesthetic.
- "portfolio-minimal": Clean whitespace-heavy portfolio/showcase. Sections: navbar, split hero with intro text, image gallery grid, about, contact, footer.
- "portfolio-bold": High-contrast editorial portfolio with large typography. Sections: navbar, bold hero, asymmetric gallery, about, contact, footer.
`

const THEME_DESCRIPTIONS = `
Color themes available:
- "ocean": Dark slate background, blue accent — professional, tech
- "sunset": Warm cream background, orange accent — warm, inviting
- "violet": Deep purple background, violet accent — modern, creative
- "forest": Light mint background, green accent — natural, fresh
- "mono": White background, black accent — timeless, minimal
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

export function getGeneratorPrompt(): string {
  return `You are a website generator. Given a user's description, pick the best template and theme, then generate all content fields as a complete TemplateConfig JSON object.

${TEMPLATE_DESCRIPTIONS}
${THEME_DESCRIPTIONS}
${CONTENT_SCHEMA}

Rules:
- Return ONLY valid JSON, no markdown fences, no explanation
- Pick the template and theme that best match the user's description
- Generate realistic, professional content based on what the user describes
- If the user doesn't specify a style, default to "landing-light" with "mono" theme
- For landing templates, always include features (3-6), at least 2 testimonials, and 2-3 pricing plans
- For portfolio templates, always include galleryItems (4-8) and contactEmail
- Template IDs: ${JSON.stringify(TEMPLATE_IDS)}
- Theme IDs: ${JSON.stringify(THEME_IDS)}

Return format:
{
  "template": "template-id",
  "theme": "theme-id",
  "content": { ...all content fields }
}`
}
