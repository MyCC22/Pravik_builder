import Anthropic from '@anthropic-ai/sdk'
import { getGeneratorPrompt } from '@/services/agents/prompts/generator'
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

  lines.push('You are a website rebuilder. You have been given content extracted from an existing website.')
  lines.push('')

  // == EXTRACTED CONTENT ==
  lines.push('== EXTRACTED CONTENT ==')

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

  lines.push('')

  // == RAW MARKDOWN ==
  lines.push('== RAW MARKDOWN ==')
  lines.push(extracted.rawMarkdown)
  lines.push('')

  // == VISUAL ANALYSIS == (optional)
  if (visualAnalysis) {
    lines.push('== VISUAL ANALYSIS ==')
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

  // == INSTRUCTIONS ==
  lines.push('== INSTRUCTIONS ==')
  lines.push('- Use extracted content as-is; do not invent fake content')
  if (visualAnalysis) {
    lines.push('- Visual analysis has been provided — use its recommendedTemplate and recommendedTheme')
  }
  lines.push('- Fill ALL content fields relevant to the chosen template')
  lines.push('- Check the raw markdown for any missing fields not captured in the extracted content')
  lines.push(`- Set ctaUrl to /book/${projectId} and bookingUrl to /book/${projectId}`)
  lines.push('- Set heroImageQuery to a 1-3 word business type search term (e.g., "italian restaurant", "yoga class")')
  lines.push('- Set businessCategory to the closest match from the 40 predefined categories')
  lines.push('')

  // Append template/theme selection rules from getGeneratorPrompt
  const fullGeneratorPrompt = getGeneratorPrompt(projectId)
  const rulesMarker = 'Template selection rules:'
  const rulesIndex = fullGeneratorPrompt.indexOf(rulesMarker)
  if (rulesIndex !== -1) {
    lines.push(fullGeneratorPrompt.slice(rulesIndex))
  }

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
        content: 'Generate a complete TemplateConfig JSON to rebuild this website. Return only valid JSON with no markdown fences or explanation.',
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
