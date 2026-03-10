import Anthropic from '@anthropic-ai/sdk'
import { getRouterPrompt } from './prompts/router'
import type { Block, RouterResult } from './types'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

export async function routeIntent(
  message: string,
  blocks: Block[],
  currentTheme: string | null
): Promise<RouterResult> {
  const systemPrompt = getRouterPrompt(blocks, currentTheme)

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()

  return JSON.parse(cleaned) as RouterResult
}
