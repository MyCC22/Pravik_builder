import Anthropic from '@anthropic-ai/sdk'
import { getTemplateDescriptions, getThemeDescriptions, getContentSchema } from '@/services/agents/prompts/generator'
import { TEMPLATE_IDS, THEME_IDS, resolveTemplateId } from '@/templates/types'
import type { TemplateConfig, ThemeId } from '@/templates/types'
import type { ExtractedContent } from './extractor'
import type { VisualAnalysis } from './visual-analyzer'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

function buildClonePrompt(
  extracted: ExtractedContent,
  visualAnalysis: VisualAnalysis | null | undefined,
  projectId: string
): string {
  const lines: string[] = []

  lines.push('You are a website cloner. Your ONLY job is to faithfully reproduce an existing website\'s content using our template system.')
  lines.push('')

  // ===== CRITICAL CONTENT FIDELITY RULES =====
  lines.push('===== CRITICAL RULES — READ CAREFULLY =====')
  lines.push('')
  lines.push('RULE 1: NEVER INVENT CONTENT. Every piece of text in your output MUST come from the source website.')
  lines.push('- Every testimonial quote, name, and role must be copied EXACTLY from the source markdown.')
  lines.push('- Every statistic, number, and metric must be copied EXACTLY from the source.')
  lines.push('- Every service name, feature name, and description must be copied EXACTLY.')
  lines.push('- Every heading, tagline, and hero text must be copied EXACTLY.')
  lines.push('- If the source says "Home of 2 World Champions" — you write "Home of 2 World Champions", NOT "Premier Training Center".')
  lines.push('- If the source has a testimonial from "Felix O." — you use "Felix O.", NOT "John Smith".')
  lines.push('')
  lines.push('RULE 2: If the source website has content for a field, USE IT. Read the raw markdown carefully.')
  lines.push('RULE 3: If the source website does NOT have content for a field, OMIT that field or use a minimal placeholder. Do NOT invent realistic-sounding content.')
  lines.push('RULE 4: The RAW MARKDOWN below is your primary source of truth. Mine it thoroughly for ALL content.')
  lines.push('')

  // == RAW MARKDOWN (PRIMARY SOURCE) ==
  lines.push('===== RAW MARKDOWN FROM SOURCE WEBSITE (PRIMARY SOURCE — mine this thoroughly) =====')
  lines.push(extracted.rawMarkdown)
  lines.push('')

  // == STRUCTURED HINTS (secondary) ==
  lines.push('===== STRUCTURED EXTRACTION HINTS (secondary — may be incomplete) =====')

  if (extracted.siteName) {
    lines.push(`siteName: ${extracted.siteName}`)
  }
  if (extracted.tagline) {
    lines.push(`tagline: ${extracted.tagline}`)
  }
  if (extracted.heroTitle) {
    lines.push(`heroTitle: ${extracted.heroTitle}`)
  }
  if (extracted.heroSubtitle) {
    lines.push(`heroSubtitle: ${extracted.heroSubtitle}`)
  }
  if (extracted.services) {
    lines.push(`services: ${JSON.stringify(extracted.services)}`)
  }
  if (extracted.features) {
    lines.push(`features: ${JSON.stringify(extracted.features)}`)
  }
  if (extracted.testimonials) {
    lines.push(`testimonials: ${JSON.stringify(extracted.testimonials)}`)
  }
  if (extracted.team) {
    lines.push(`team: ${JSON.stringify(extracted.team)}`)
  }
  if (extracted.faq) {
    lines.push(`faq: ${JSON.stringify(extracted.faq)}`)
  }
  if (extracted.pricing) {
    lines.push(`pricing: ${JSON.stringify(extracted.pricing)}`)
  }
  if (extracted.menuItems) {
    lines.push(`menuItems: ${JSON.stringify(extracted.menuItems)}`)
  }
  if (extracted.email) {
    lines.push(`email: ${extracted.email}`)
  }
  if (extracted.phone) {
    lines.push(`phone: ${extracted.phone}`)
  }
  if (extracted.address) {
    lines.push(`address: ${extracted.address}`)
  }
  if (extracted.hours) {
    lines.push(`hours: ${JSON.stringify(extracted.hours)}`)
  }
  if (extracted.galleryItems) {
    lines.push(`galleryItems: ${JSON.stringify(extracted.galleryItems)}`)
  }
  lines.push(`hasGallery: ${extracted.hasGallery}`)

  lines.push('')
  lines.push('NOTE: The structured hints above may be incomplete — the regex extraction often misses content.')
  lines.push('ALWAYS cross-reference with the raw markdown above. The raw markdown is the ground truth.')
  if (extracted.hasGallery) {
    lines.push('*** The source website HAS a photo gallery. Choose a template that supports galleryItems (agency, agency-editorial, restaurant, restaurant-dark). ***')
  }
  lines.push('')

  // == VISUAL ANALYSIS == (optional)
  if (visualAnalysis) {
    lines.push('===== VISUAL ANALYSIS =====')
    lines.push(`recommendedTemplate: ${visualAnalysis.recommendedTemplate}`)
    lines.push(`recommendedTheme: ${visualAnalysis.recommendedTheme}`)
    lines.push(`layout.heroStyle: ${visualAnalysis.layout.heroStyle}`)
    lines.push(`layout.hasGallery: ${visualAnalysis.layout.hasGallery}`)
    lines.push(`layout.sectionCount: ${visualAnalysis.layout.sectionCount}`)
    lines.push(`colors.background: ${visualAnalysis.colors.background}`)
    lines.push(`colors.mood: ${visualAnalysis.colors.mood}`)
    lines.push(`typography.style: ${visualAnalysis.typography.style}`)
    lines.push(`typography.weight: ${visualAnalysis.typography.weight}`)
    lines.push('')
  }

  // == AVAILABLE TEMPLATES AND THEMES ==
  lines.push('===== AVAILABLE TEMPLATES =====')
  lines.push(getTemplateDescriptions())
  lines.push('')
  lines.push('===== AVAILABLE THEMES =====')
  lines.push(getThemeDescriptions())
  lines.push('')
  lines.push('===== CONTENT FIELD SCHEMA =====')
  lines.push(getContentSchema())
  lines.push('')

  // == TEMPLATE SELECTION RULES ==
  lines.push('===== TEMPLATE SELECTION =====')
  lines.push('Choose the template that BEST matches the source website\'s content and sections:')
  lines.push('1. Food/restaurant/cafe/bakery → "restaurant" or "restaurant-dark"')
  lines.push('2. Event/conference/workshop/course → "event" or "event-dark"')
  lines.push('3. Creative studio/agency/freelancer/portfolio → "agency" or "agency-editorial"')
  lines.push('4. Service provider (coach, plumber, tutor, contractor, consultant, martial arts) → "services" or "services-bold"')
  lines.push('5. SaaS/app/product launch/general → "landing" or "landing-bold"')
  lines.push('')
  lines.push('IMPORTANT: If the source site has a PHOTO GALLERY section, prefer a template that supports galleryItems:')
  lines.push('- "agency" or "agency-editorial" have gallery grids (for services/studios/schools with photo galleries)')
  lines.push('- "restaurant" or "restaurant-dark" also have gallery support')
  lines.push('- A martial arts school, gym, or studio with a photo gallery should use "agency" template to include the gallery')
  lines.push(`Template IDs: ${JSON.stringify(TEMPLATE_IDS)}`)
  lines.push(`Theme IDs: ${JSON.stringify(THEME_IDS)}`)
  if (visualAnalysis) {
    lines.push('Visual analysis recommends: use its recommendedTemplate and recommendedTheme')
  }
  lines.push('')

  // == FINAL INSTRUCTIONS (at end for recency bias) ==
  lines.push('===== FINAL INSTRUCTIONS (MOST IMPORTANT) =====')
  lines.push(`- ctaUrl: "/book/${projectId}"`)
  lines.push(`- bookingUrl: "/book/${projectId}"`)
  lines.push('- heroImageQuery: 1-3 word business type (e.g., "taekwondo training")')
  lines.push('- businessCategory: pick closest from the 40 predefined categories')
  lines.push('')
  lines.push('CONTENT FIDELITY CHECKLIST — verify each before outputting:')
  lines.push('✓ heroTitle comes VERBATIM from the source markdown heading or hero text')
  lines.push('✓ heroSubtitle comes VERBATIM from the source')
  lines.push('✓ Every testimonial quote is copied WORD FOR WORD from the source')
  lines.push('✓ Every testimonial name matches the source EXACTLY (Felix O., not "John Smith")')
  lines.push('✓ Every stat number matches the source EXACTLY (e.g., "2 World Champions" not "500+ Students")')
  lines.push('✓ Service/feature names match the source EXACTLY')
  lines.push('✓ Contact info (email, phone, address) comes from the source, not invented')
  lines.push('✓ NO content was fabricated — everything traces back to the raw markdown')
  lines.push('')
  lines.push('Return format: { "template": "template-id", "theme": "theme-id", "content": { ...all fields } }')
  lines.push('Return ONLY valid JSON, no markdown fences, no explanation.')

  return lines.join('\n')
}

export async function generateCloneConfig(
  extracted: ExtractedContent,
  visualAnalysis: VisualAnalysis | null | undefined,
  projectId: string
): Promise<TemplateConfig> {
  const systemPrompt = buildClonePrompt(extracted, visualAnalysis, projectId)

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: 'Generate a complete TemplateConfig JSON to rebuild this website. CRITICAL: Use ONLY real content from the raw markdown — do NOT make up any testimonials, stats, names, descriptions, or other content. Every text field must come from the source. Return only valid JSON with no markdown fences or explanation.',
      },
    ],
  })

  const rawText =
    response.content[0].type === 'text' ? response.content[0].text : ''

  // Strip markdown fences if present
  const cleaned = rawText
    .replace(/```json?\n?/g, '')
    .replace(/```/g, '')
    .trim()

  const parsed = JSON.parse(cleaned)

  // Validate template id, fallback to 'landing' if invalid
  const resolvedTemplate = resolveTemplateId(parsed.template ?? '')

  // Validate theme id, fallback to 'clean' if invalid
  const resolvedTheme: ThemeId =
    THEME_IDS.includes(parsed.theme as ThemeId) ? (parsed.theme as ThemeId) : 'clean'

  const config: TemplateConfig = {
    template: resolvedTemplate,
    theme: resolvedTheme,
    content: parsed.content ?? {},
  }

  return config
}
