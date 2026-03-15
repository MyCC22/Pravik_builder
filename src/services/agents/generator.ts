import Anthropic from '@anthropic-ai/sdk'
import { getGeneratorPrompt } from './prompts/generator'
import { TEMPLATE_IDS, THEME_IDS, resolveTemplateId } from '@/templates/types'
import type { TemplateConfig, TemplateId, ThemeId } from '@/templates/types'
import { renderTemplate } from '@/templates/render'
import { getSupabaseClient } from '@/services/supabase/client'
import { fetchTemplateImages } from '@/services/unsplash/image-fetcher'
import type { Block } from './types'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

function splitHtmlIntoBlocks(html: string): { block_type: string; html: string }[] {
  const blocks: { block_type: string; html: string }[] = []

  // Extract <nav> blocks
  const navRegex = /<nav[\s\S]*?<\/nav>/gi
  const navMatches = html.match(navRegex)
  if (navMatches) {
    for (const match of navMatches) {
      blocks.push({ block_type: 'navbar', html: match })
    }
  }

  // Extract <section> blocks
  const sectionRegex = /<section[\s\S]*?<\/section>/gi
  const sectionMatches = html.match(sectionRegex)
  let heroAssigned = false
  if (sectionMatches) {
    for (const match of sectionMatches) {
      const lower = match.toLowerCase()
      let blockType = 'custom'

      if (lower.includes('id="features"')) {
        blockType = 'features'
      } else if (lower.includes('id="pricing"') || lower.includes('pricing')) {
        blockType = 'pricing'
      } else if (lower.includes('id="gallery"') || lower.includes('gallery')) {
        blockType = 'gallery'
      } else if (lower.includes('id="contact"') || lower.includes('contact')) {
        blockType = 'contact'
      } else if (lower.includes('id="testimonials"') || lower.includes('testimonial')) {
        blockType = 'testimonials'
      } else if (lower.includes('id="cta"') || lower.includes('call-to-action') || lower.includes('get started')) {
        blockType = 'cta'
      } else if (lower.includes('id="services"') || lower.includes('what we offer')) {
        blockType = 'services'
      } else if (lower.includes('id="process"') || lower.includes('how it works')) {
        blockType = 'process'
      } else if (lower.includes('id="team"') || lower.includes('meet the team')) {
        blockType = 'team'
      } else if (lower.includes('id="clients"') || lower.includes('trusted by')) {
        blockType = 'clients'
      } else if (lower.includes('id="faq"') || lower.includes('frequently asked')) {
        blockType = 'faq'
      } else if (lower.includes('id="menu"') || lower.includes('our menu')) {
        blockType = 'menu'
      } else if (lower.includes('id="hours"') || lower.includes('visit us')) {
        blockType = 'hours'
      } else if (lower.includes('id="booking"') || lower.includes('ready to get started')) {
        blockType = 'booking'
      } else if (lower.includes('id="schedule"') || lower.includes('schedule')) {
        blockType = 'schedule'
      } else if (lower.includes('id="speakers"') || lower.includes('speakers')) {
        blockType = 'speakers'
      } else if (lower.includes('id="stats"')) {
        blockType = 'stats'
      } else if (lower.includes('id="results"') || lower.includes('real results')) {
        blockType = 'before-after'
      } else if (!heroAssigned) {
        blockType = 'hero'
        heroAssigned = true
      }

      blocks.push({ block_type: blockType, html: match })
    }
  }

  // Extract <footer> blocks
  const footerRegex = /<footer[\s\S]*?<\/footer>/gi
  const footerMatches = html.match(footerRegex)
  if (footerMatches) {
    for (const match of footerMatches) {
      blocks.push({ block_type: 'footer', html: match })
    }
  }

  return blocks
}

/**
 * Given a validated TemplateConfig and a projectId, this function:
 * 1. Fetches images from Unsplash (with graceful fallback)
 * 2. Injects image URLs into config.content
 * 3. Renders full HTML via renderTemplate
 * 4. Extracts body content
 * 5. Splits into blocks via splitHtmlIntoBlocks
 * 6. Stores blocks in DB
 * 7. Updates the project row with theme, template_config, preview_url
 * 8. Returns { blocks, theme, config }
 */
export async function renderAndStoreBlocks(
  config: TemplateConfig,
  projectId: string
): Promise<{ blocks: Block[]; theme: ThemeId; config: TemplateConfig }> {
  const theme = config.theme as ThemeId

  // Fetch images from Unsplash (runs in parallel, gracefully falls back to gradients)
  try {
    const images = await fetchTemplateImages(config)

    if (images.heroImageUrl) {
      config.content.heroImageUrl = images.heroImageUrl
    }

    if (images.galleryImageUrls && config.content.galleryItems) {
      config.content.galleryItems = config.content.galleryItems.map((item, i) => ({
        ...item,
        imageUrl: images.galleryImageUrls![i] || undefined,
      }))
    }
  } catch (err) {
    console.error('Image fetch failed, using gradient placeholders:', err)
  }

  // Render full HTML using existing template system
  const fullHtml = renderTemplate(config)

  // Extract body content (between <body> and </body>)
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  const bodyHtml = bodyMatch ? bodyMatch[1].trim() : fullHtml

  // Split into blocks
  const rawBlocks = splitHtmlIntoBlocks(bodyHtml)

  const supabase = getSupabaseClient()

  // Store blocks in DB
  const blockRows = rawBlocks.map((b, i) => ({
    project_id: projectId,
    block_type: b.block_type,
    html: b.html,
    position: i,
  }))

  const { data: insertedBlocks, error } = await supabase
    .from('blocks')
    .insert(blockRows)
    .select()

  if (error) {
    throw new Error(`Failed to insert blocks: ${error.message}`)
  }

  // Update project with theme and config
  await supabase
    .from('projects')
    .update({
      theme,
      template_config: config,
      preview_url: `/site/${projectId}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)

  return { blocks: insertedBlocks as Block[], theme, config }
}

/**
 * Post-generation section validation.
 *
 * After the AI picks a template and generates content, this function strips
 * out sections that are clearly irrelevant to the user's business.
 *
 * For example: an "event" template has speakers/schedule which make no sense
 * for a soccer academy.  A services template might occasionally get pricing
 * tiers from a landing template leak. This catches those mismatches.
 *
 * The templates conditionally render sections based on whether the content
 * array exists and has items, so removing a field here = no section rendered.
 */
function validateSections(
  config: TemplateConfig,
  userMessage: string,
): TemplateConfig {
  const content = { ...config.content }
  // Use Record<string, unknown> for dynamic field access during validation
  const contentRecord = content as Record<string, unknown>
  const template = config.template as string
  const msg = userMessage.toLowerCase()

  // ── Template ↔ section allow-lists ──────────────────────────────
  // Sections only valid for certain template families.
  // If a section sneaks in via the AI, remove it.
  const TEMPLATE_ALLOWED_SECTIONS: Record<string, string[]> = {
    'landing':          ['features', 'testimonials', 'pricing', 'stats'],
    'landing-bold':     ['features', 'testimonials', 'pricing', 'stats'],
    'services':         ['services', 'process', 'testimonials', 'faq', 'stats', 'beforeAfter'],
    'services-bold':    ['services', 'process', 'testimonials', 'faq', 'stats', 'beforeAfter'],
    'restaurant':       ['menuItems', 'galleryItems', 'testimonials', 'hours', 'address'],
    'restaurant-dark':  ['menuItems', 'galleryItems', 'testimonials', 'hours', 'address'],
    'agency':           ['clients', 'features', 'galleryItems', 'process', 'team', 'testimonials'],
    'agency-editorial': ['clients', 'features', 'galleryItems', 'process', 'team', 'testimonials'],
    'event':            ['stats', 'speakers', 'schedule', 'pricing', 'faq'],
    'event-dark':       ['stats', 'speakers', 'schedule', 'pricing', 'faq'],
  }

  // All optional array-based content fields
  const ALL_OPTIONAL_SECTIONS = [
    'features', 'testimonials', 'pricing', 'stats', 'services', 'process',
    'faq', 'beforeAfter', 'menuItems', 'galleryItems', 'hours', 'clients',
    'team', 'speakers', 'schedule',
  ]

  const allowed = TEMPLATE_ALLOWED_SECTIONS[template]
  if (allowed) {
    for (const field of ALL_OPTIONAL_SECTIONS) {
      if (!allowed.includes(field) && contentRecord[field]) {
        console.log(`[section-validation] Removed "${field}" — not valid for template "${template}"`)
        delete contentRecord[field]
      }
    }
  }

  // ── Context-based pruning ──────────────────────────────────────
  // Even within an allowed template, some sections are nonsensical
  // for certain businesses. Catch the most common embarrassments.
  const eventWords = ['conference', 'summit', 'gala', 'symposium', 'meetup']
  const isActualEvent = eventWords.some(w => msg.includes(w))

  // Speakers section only makes sense for actual events
  if (contentRecord.speakers && !isActualEvent) {
    console.log(`[section-validation] Removed "speakers" — not a conference/summit/event`)
    delete contentRecord.speakers
  }

  // Schedule/agenda only for actual events
  if (contentRecord.schedule && !isActualEvent) {
    console.log(`[section-validation] Removed "schedule" — not a conference/summit/event`)
    delete contentRecord.schedule
  }

  // Menu items only for food businesses
  const foodWords = ['restaurant', 'cafe', 'bakery', 'bar', 'food truck', 'diner', 'bistro', 'pizza', 'sushi']
  const isFoodBusiness = foodWords.some(w => msg.includes(w))
  if (contentRecord.menuItems && !isFoodBusiness) {
    console.log(`[section-validation] Removed "menuItems" — not a food business`)
    delete contentRecord.menuItems
  }

  return { ...config, content: contentRecord as unknown as TemplateConfig['content'] }
}

export async function generateSite(
  message: string,
  projectId: string
): Promise<{ blocks: Block[]; theme: ThemeId; config: TemplateConfig }> {
  const systemPrompt = getGeneratorPrompt(projectId)

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  const parsed = JSON.parse(cleaned) as TemplateConfig

  // Validate and fallback
  const template = resolveTemplateId(parsed.template)
  const theme: ThemeId = THEME_IDS.includes(parsed.theme as ThemeId)
    ? (parsed.theme as ThemeId)
    : 'clean'

  let config: TemplateConfig = { ...parsed, template, theme }

  // Post-generation: strip sections that don't belong on this template/business
  config = validateSections(config, message)

  return renderAndStoreBlocks(config, projectId)
}
