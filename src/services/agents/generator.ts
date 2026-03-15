import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getGeneratorPrompt } from './prompts/generator'
import { TEMPLATE_IDS, THEME_IDS, resolveTemplateId } from '@/templates/types'
import type { TemplateConfig, TemplateId, ThemeId } from '@/templates/types'
import { renderTemplate } from '@/templates/render'
import { getSupabaseClient } from '@/services/supabase/client'
import { fetchTemplateImages } from '@/services/unsplash/image-fetcher'
import type { Block, HeroFormConfig, ToolField } from './types'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

// Use service role key for server-side tool writes (RLS requires auth.uid() for
// owner-only INSERT, but server agents don't have a user session)
function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
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

  // Clear any existing blocks for this project before inserting new ones
  const { error: deleteError } = await supabase
    .from('blocks')
    .delete()
    .eq('project_id', projectId)

  if (deleteError) {
    console.error(`Failed to clear old blocks for project ${projectId}:`, deleteError.message)
    // Continue anyway — inserting new blocks is more important
  }

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

/**
 * Attempt to repair common JSON issues from AI output:
 * - Trailing commas before ] or }
 * - Single-line // comments
 * - Unescaped newlines inside strings
 */
function tryRepairJson(raw: string): string {
  let s = raw
  // Remove single-line comments (not inside strings — best-effort)
  s = s.replace(/^\s*\/\/.*$/gm, '')
  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([\]}])/g, '$1')
  return s
}

/**
 * Safely parse JSON with repair attempts.
 * Returns parsed object or throws with informative error.
 */
function safeParseJson(raw: string): TemplateConfig {
  // 1. Strip markdown fences
  const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()

  // 2. Try direct parse first
  try {
    return JSON.parse(cleaned) as TemplateConfig
  } catch (_firstErr) {
    // ignore — try repair
  }

  // 3. Try repaired JSON
  const repaired = tryRepairJson(cleaned)
  try {
    return JSON.parse(repaired) as TemplateConfig
  } catch (_repairErr) {
    // ignore — try extraction
  }

  // 4. Try extracting JSON object from mixed text
  const braceMatch = cleaned.match(/\{[\s\S]*\}/)
  if (braceMatch) {
    const extracted = tryRepairJson(braceMatch[0])
    try {
      return JSON.parse(extracted) as TemplateConfig
    } catch (_extractErr) {
      // fall through to error
    }
  }

  throw new Error(
    'Failed to parse AI response as JSON after repair attempts. ' +
    `Raw output starts with: "${cleaned.slice(0, 120)}..."`
  )
}

/**
 * Validate that required content fields exist and provide defaults for missing ones.
 */
function validateRequiredFields(config: TemplateConfig): TemplateConfig {
  const content = { ...config.content }

  if (!content.siteName || typeof content.siteName !== 'string') {
    console.warn('[content-validation] Missing siteName — using default')
    content.siteName = 'My Website'
  }
  if (!content.heroTitle || typeof content.heroTitle !== 'string') {
    console.warn('[content-validation] Missing heroTitle — using default')
    content.heroTitle = content.siteName
  }
  if (!content.heroSubtitle || typeof content.heroSubtitle !== 'string') {
    console.warn('[content-validation] Missing heroSubtitle — using default')
    content.heroSubtitle = 'Welcome to our website'
  }
  if (!content.tagline || typeof content.tagline !== 'string') {
    console.warn('[content-validation] Missing tagline — using default')
    content.tagline = content.siteName
  }
  if (!content.ctaText || typeof content.ctaText !== 'string') {
    console.warn('[content-validation] Missing ctaText — using default')
    content.ctaText = 'Get Started'
  }
  if (!content.ctaUrl || typeof content.ctaUrl !== 'string') {
    console.warn('[content-validation] Missing ctaUrl — using default')
    content.ctaUrl = '#contact'
  }

  return { ...config, content }
}

/**
 * Validate and sanitize hero form config from AI output.
 * Ensures field count, types, and required name/email presence.
 */
function validateHeroFormConfig(config: Partial<HeroFormConfig>): HeroFormConfig {
  // Filter to allowed types, enforce snake_case names, cap at 4
  let fields = (config.fields || [])
    .filter((f: ToolField) => ['text', 'email', 'phone', 'dropdown'].includes(f.type))
    .map((f: ToolField) => ({
      ...f,
      name: f.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    }))
    .slice(0, 4)

  // Ensure name and email fields exist
  const hasName = fields.some((f: ToolField) => f.type === 'text' && f.name === 'name')
  const hasEmail = fields.some((f: ToolField) => f.type === 'email')

  if (!hasEmail) {
    fields.unshift({ name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'Your email' })
  }
  if (!hasName) {
    fields.unshift({ name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Your name' })
  }

  // Re-cap after potential injection
  fields = fields.slice(0, 4)

  return {
    formTitle: config.formTitle || 'Get Started',
    submitText: config.submitText || 'Submit',
    successMessage: config.successMessage || 'Thanks! We will be in touch soon.',
    fields,
  }
}

/**
 * Creates a hero_registration tool in the database.
 * Returns the tool ID and validated fields for template rendering.
 */
async function createHeroRegistrationTool(
  projectId: string,
  config: HeroFormConfig
): Promise<{ toolId: string; fields: ToolField[] }> {
  const supabase = getServiceSupabase()

  const { data, error } = await supabase
    .from('tools')
    .insert({
      project_id: projectId,
      tool_type: 'hero_registration',
      config: {
        title: config.formTitle,
        submitText: config.submitText,
        successMessage: config.successMessage,
        fields: config.fields,
      },
      is_active: true,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('Failed to create hero_registration tool:', error?.message)
    throw new Error(`Failed to create hero registration tool: ${error?.message}`)
  }

  return { toolId: data.id, fields: config.fields }
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

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  if (!text) {
    throw new Error('AI returned empty response — no content generated')
  }

  const parsed = safeParseJson(text)

  // Validate and fallback template + theme
  const template = resolveTemplateId(parsed.template)
  const theme: ThemeId = THEME_IDS.includes(parsed.theme as ThemeId)
    ? (parsed.theme as ThemeId)
    : 'clean'

  let config: TemplateConfig = { ...parsed, template, theme }

  // Validate required content fields exist (provide defaults if missing)
  config = validateRequiredFields(config)

  // Post-generation: strip sections that don't belong on this template/business
  config = validateSections(config, message)

  // Create hero registration tool if AI decided to include one
  if (parsed.content?.includeHeroForm && (parsed as unknown as Record<string, unknown>).heroFormConfig) {
    try {
      const rawHeroConfig = (parsed as unknown as Record<string, unknown>).heroFormConfig as Partial<HeroFormConfig>
      const validatedHeroConfig = validateHeroFormConfig(rawHeroConfig)
      const { toolId, fields: heroFields } = await createHeroRegistrationTool(projectId, validatedHeroConfig)

      config = {
        ...config,
        heroToolId: toolId,
        heroFormFields: heroFields,
      }

      // Pass display strings from AI to content
      config.content = {
        ...config.content,
        includeHeroForm: true,
        heroFormTitle: validatedHeroConfig.formTitle,
        heroFormSubmitText: validatedHeroConfig.submitText,
        heroFormSuccessMessage: validatedHeroConfig.successMessage,
      }
    } catch (err) {
      console.error('Hero registration tool creation failed, skipping:', err)
      // Non-fatal — site generates without inline form
    }
  }

  return renderAndStoreBlocks(config, projectId)
}
