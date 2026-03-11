import Anthropic from '@anthropic-ai/sdk'
import { getToolEditorPrompt } from './prompts/tool-editor'
import { validateToolConfig } from './tool-generator'
import type { ToolConfig } from './types'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

export async function editToolConfig(
  currentConfig: ToolConfig,
  message: string
): Promise<ToolConfig> {
  const systemPrompt = getToolEditorPrompt(currentConfig)

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  const parsed = JSON.parse(cleaned)

  // Reuse the same validation as the generator for consistent config shape
  return validateToolConfig(parsed)
}
