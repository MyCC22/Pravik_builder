import Anthropic from '@anthropic-ai/sdk'
import { getBlockEditorPrompt, getAddBlockPrompt } from './prompts/block-editor'
import { getSupabaseClient } from '@/services/supabase/client'
import type { Block } from './types'

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

export async function editBlock(
  block: Block,
  message: string,
  allBlockTypes: string[],
  projectId?: string,
  history?: ChatMessage[]
): Promise<string> {
  const systemPrompt = getBlockEditorPrompt(block.block_type, block.html, allBlockTypes, projectId)

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
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  // Strip markdown fences if present
  const cleaned = text.replace(/```html?\n?/g, '').replace(/```/g, '').trim()

  // Safety net: if the model returned conversational text instead of HTML,
  // fall back to the original block HTML to prevent destroying the section.
  // Valid HTML blocks always start with a tag like <section, <nav, <footer, <div, <header, etc.
  if (cleaned && !cleaned.startsWith('<')) {
    console.warn(
      `[block-editor] Model returned non-HTML for ${block.block_type} block — returning original HTML. ` +
      `Response started with: "${cleaned.substring(0, 80)}..."`
    )
    return block.html
  }

  return cleaned || block.html
}

export async function addBlock(
  projectId: string,
  blockType: string,
  message: string,
  position: number,
  allBlockTypes: string[]
): Promise<Block> {
  const systemPrompt = getAddBlockPrompt(blockType, allBlockTypes)

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const html = text.replace(/```html?\n?/g, '').replace(/```/g, '').trim()

  const supabase = getSupabaseClient()

  // Shift existing blocks at and after this position
  await supabase.rpc('increment_block_positions', {
    p_project_id: projectId,
    p_from_position: position,
  })

  // Insert new block
  const { data: newBlock, error } = await supabase
    .from('blocks')
    .insert({
      project_id: projectId,
      block_type: blockType,
      html,
      position,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to insert block: ${error.message}`)
  }

  return newBlock as Block
}
