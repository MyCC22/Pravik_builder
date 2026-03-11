import Anthropic from '@anthropic-ai/sdk'
import { getGeneratorPrompt } from './prompts/generator'
import { TEMPLATE_IDS, THEME_IDS } from '@/templates/types'
import type { TemplateConfig, TemplateId, ThemeId } from '@/templates/types'
import { renderTemplate } from '@/templates/render'
import { getSupabaseClient } from '@/services/supabase/client'
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

      if (lower.includes('id="features"') || lower.includes('id="features"')) {
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

export async function generateSite(
  message: string,
  projectId: string
): Promise<{ blocks: Block[]; theme: ThemeId; config: TemplateConfig }> {
  const systemPrompt = getGeneratorPrompt()

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  const parsed = JSON.parse(cleaned) as TemplateConfig

  // Validate and fallback
  const template: TemplateId = TEMPLATE_IDS.includes(parsed.template as TemplateId)
    ? (parsed.template as TemplateId)
    : 'landing'
  const theme: ThemeId = THEME_IDS.includes(parsed.theme as ThemeId)
    ? (parsed.theme as ThemeId)
    : 'clean'

  const config: TemplateConfig = { ...parsed, template, theme }

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
