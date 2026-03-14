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

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function routeIntent(
  message: string,
  blocks: Block[],
  currentTheme: string | null,
  history?: ChatMessage[]
): Promise<RouterResult> {
  const systemPrompt = getRouterPrompt(blocks, currentTheme)

  // Build messages array with conversation history for context
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

  if (history && history.length > 0) {
    // Include last 6 messages for context (3 turns)
    const recentHistory = history.slice(-6)
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content })
    }
  }

  // Add the current message
  messages.push({ role: 'user', content: message })

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: systemPrompt,
    messages,
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()

  try {
    return JSON.parse(cleaned) as RouterResult
  } catch {
    // Haiku sometimes returns invalid JSON — try to extract a JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as RouterResult
      } catch {
        // Fall through to clarify
      }
    }
    console.warn(`[router] Failed to parse router response: "${cleaned.substring(0, 200)}"`)
    return {
      intent: 'clarify',
      description: message,
      question: "I'm not sure what you'd like me to change. Could you describe the edit you want?",
      target_blocks: [],
    } as RouterResult
  }
}
