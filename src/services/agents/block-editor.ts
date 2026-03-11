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

export async function editBlock(
  block: Block,
  message: string,
  allBlockTypes: string[]
): Promise<string> {
  const systemPrompt = getBlockEditorPrompt(block.block_type, block.html, allBlockTypes)

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  // Strip markdown fences if present
  return text.replace(/```html?\n?/g, '').replace(/```/g, '').trim()
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
