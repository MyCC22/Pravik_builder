import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getToolGeneratorPrompt } from './prompts/tool-generator'
import type { ToolConfig } from './types'

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

export function validateToolConfig(parsed: unknown): ToolConfig {
  const config = parsed as Record<string, unknown>

  // Ensure required top-level fields exist with sensible defaults
  const title = typeof config.title === 'string' ? config.title : 'Book Now'
  const subtitle = typeof config.subtitle === 'string' ? config.subtitle : 'Fill in your details below'
  const submitText = typeof config.submitText === 'string' ? config.submitText : 'Submit'
  const successMessage = typeof config.successMessage === 'string'
    ? config.successMessage
    : 'Thanks! We\'ll be in touch soon.'
  const trustSignals = Array.isArray(config.trustSignals)
    ? config.trustSignals.filter((s): s is string => typeof s === 'string')
    : []

  // Validate fields array
  const rawFields = Array.isArray(config.fields) ? config.fields : []
  const validTypes = ['text', 'email', 'phone', 'textarea', 'number', 'dropdown']
  const fields = rawFields
    .filter((f: unknown): f is Record<string, unknown> =>
      typeof f === 'object' && f !== null && typeof (f as Record<string, unknown>).name === 'string'
    )
    .map((f: Record<string, unknown>) => ({
      name: String(f.name),
      label: typeof f.label === 'string' ? f.label : String(f.name),
      type: validTypes.includes(String(f.type)) ? String(f.type) as ToolConfig['fields'][0]['type'] : 'text' as const,
      required: f.required === true,
      ...(typeof f.placeholder === 'string' ? { placeholder: f.placeholder } : {}),
      ...(Array.isArray(f.options) ? { options: f.options.filter((o): o is string => typeof o === 'string') } : {}),
    }))

  return { title, subtitle, submitText, successMessage, trustSignals, fields }
}

export async function generateBookingTool(
  businessDescription: string,
  projectId: string,
  templateType: string
): Promise<ToolConfig | null> {
  try {
    const systemPrompt = getToolGeneratorPrompt(templateType)

    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: businessDescription }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    const config = validateToolConfig(parsed)

    // Store in DB (service role key bypasses RLS for server-side inserts)
    const supabase = getServiceSupabase()
    const { error } = await supabase
      .from('tools')
      .insert({
        project_id: projectId,
        tool_type: 'booking',
        config,
      })

    if (error) {
      console.error('Failed to insert tool:', error.message)
      return null
    }

    return config
  } catch (err) {
    console.error('generateBookingTool failed:', err)
    return null
  }
}
