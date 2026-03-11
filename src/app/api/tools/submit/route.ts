import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ToolConfig, ToolField } from '@/services/agents/types'

// --- Rate Limiting ---

const ipSubmissions = new Map<string, { count: number; resetAt: number }>()
const toolSubmissions = new Map<string, { count: number; resetAt: number }>()

const IP_LIMIT = 10        // per minute
const IP_WINDOW = 60_000   // 1 minute
const TOOL_LIMIT = 100     // per hour
const TOOL_WINDOW = 3600_000 // 1 hour

function checkRateLimit(
  store: Map<string, { count: number; resetAt: number }>,
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now()
  const entry = store.get(key)

  // Expired or no entry — reset the window
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) {
    return false
  }

  entry.count++
  return true
}

// NOTE: No setInterval for cleanup — serverless functions are ephemeral.
// The checkRateLimit function handles expiry lazily by resetting expired entries.
// This in-memory rate limiter resets on cold starts. For production, use
// Upstash Redis or Vercel's built-in rate limiting.

// --- Validation ---

function stripHtmlTags(str: string): string {
  return str.replace(/<[^>]*>/g, '')
}

function validateEmail(email: string): boolean {
  return /^.+@.+\..+$/.test(email)
}

function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 7
}

function validateSubmission(
  data: Record<string, unknown>,
  fields: ToolField[]
): { valid: boolean; errors: string[]; sanitized: Record<string, string> } {
  const errors: string[] = []
  const sanitized: Record<string, string> = {}

  for (const field of fields) {
    const value = data[field.name]

    // Check required
    if (field.required && (!value || String(value).trim() === '')) {
      errors.push(`${field.label} is required`)
      continue
    }

    // Skip optional empty fields
    if (!value || String(value).trim() === '') continue

    const strValue = stripHtmlTags(String(value).trim())

    // Max length check
    if (strValue.length > 2000) {
      errors.push(`${field.label} is too long (max 2000 characters)`)
      continue
    }

    // Type-specific validation
    switch (field.type) {
      case 'email':
        if (!validateEmail(strValue)) {
          errors.push(`${field.label} must be a valid email address`)
          continue
        }
        break
      case 'phone':
        if (!validatePhone(strValue)) {
          errors.push(`${field.label} must contain at least 7 digits`)
          continue
        }
        break
      case 'number':
        if (isNaN(Number(strValue))) {
          errors.push(`${field.label} must be a number`)
          continue
        }
        break
      case 'dropdown':
        if (field.options && !field.options.includes(strValue)) {
          errors.push(`${field.label} must be one of: ${field.options.join(', ')}`)
          continue
        }
        break
    }

    sanitized[field.name] = strValue
  }

  return { valid: errors.length === 0, errors, sanitized }
}

// --- Route Handler ---

// Use service role key for unauthenticated inserts
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(ipSubmissions, ip, IP_LIMIT, IP_WINDOW)) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse body
    const body = await req.json()
    const { tool_id, data } = body as { tool_id?: string; data?: Record<string, unknown> }

    if (!tool_id || !data) {
      return NextResponse.json(
        { error: 'tool_id and data are required' },
        { status: 400 }
      )
    }

    // Check payload size (rough check)
    if (JSON.stringify(data).length > 50_000) {
      return NextResponse.json(
        { error: 'Payload too large' },
        { status: 413 }
      )
    }

    // Rate limit by tool
    if (!checkRateLimit(toolSubmissions, tool_id, TOOL_LIMIT, TOOL_WINDOW)) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      )
    }

    const supabase = getServiceClient()

    // Load tool config
    const { data: tool, error: toolError } = await supabase
      .from('tools')
      .select('config, is_active')
      .eq('id', tool_id)
      .single()

    if (toolError || !tool) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404 }
      )
    }

    if (!tool.is_active) {
      return NextResponse.json(
        { error: 'This form is currently unavailable' },
        { status: 403 }
      )
    }

    const config = tool.config as ToolConfig

    if (!config.fields || !Array.isArray(config.fields)) {
      return NextResponse.json(
        { error: 'Form configuration error' },
        { status: 500 }
      )
    }

    // Validate submission data against field config
    const { valid, errors, sanitized } = validateSubmission(data, config.fields)

    if (!valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      )
    }

    // Insert submission
    const { error: insertError } = await supabase
      .from('tool_submissions')
      .insert({
        tool_id,
        data: sanitized,
      })

    if (insertError) {
      console.error('Failed to insert submission:', insertError.message)
      return NextResponse.json(
        { error: 'Failed to save submission' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Submit error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
