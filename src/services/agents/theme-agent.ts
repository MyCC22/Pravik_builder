import Anthropic from '@anthropic-ai/sdk'
import { getThemePrompt } from './prompts/theme'
import { THEME_IDS } from '@/templates/types'
import type { ThemeId } from '@/templates/types'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

export async function pickTheme(
  message: string,
  currentTheme: string | null
): Promise<{ theme: ThemeId; description: string }> {
  const systemPrompt = getThemePrompt(currentTheme)

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 128,
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  const parsed = JSON.parse(cleaned) as { theme: string; description: string }

  // Validate theme
  const theme: ThemeId = THEME_IDS.includes(parsed.theme as ThemeId)
    ? (parsed.theme as ThemeId)
    : (currentTheme as ThemeId) || 'ocean'

  return { theme, description: parsed.description }
}
