import Anthropic from '@anthropic-ai/sdk'
import type { TemplateConfig } from '@/templates/types'
import { TEMPLATE_IDS, THEME_IDS } from '@/templates/types'
import { getNewChatPrompt, getUpdatePrompt } from './prompts'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

function validateConfig(parsed: Record<string, unknown>): TemplateConfig {
  const template = parsed.template as string
  const theme = parsed.theme as string

  if (!TEMPLATE_IDS.includes(template as TemplateConfig['template'])) {
    throw new Error(`Invalid template: ${template}`)
  }
  if (!THEME_IDS.includes(theme as TemplateConfig['theme'])) {
    throw new Error(`Invalid theme: ${theme}`)
  }
  if (!parsed.content || typeof parsed.content !== 'object') {
    throw new Error('Missing content object')
  }

  return parsed as unknown as TemplateConfig
}

export async function pickTemplate(
  message: string,
  currentConfig: TemplateConfig | null
): Promise<TemplateConfig> {
  const systemPrompt = currentConfig
    ? getUpdatePrompt(currentConfig)
    : getNewChatPrompt()

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
  })

  const text =
    response.content[0].type === 'text' ? response.content[0].text : ''

  // Strip markdown code fences if present
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()

  const parsed = JSON.parse(cleaned)
  return validateConfig(parsed)
}
