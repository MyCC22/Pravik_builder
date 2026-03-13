import { vi, describe, it, expect } from 'vitest'

// Mock Next.js server modules
vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: vi.fn(),
}))

// Mock Supabase client
vi.mock('@/services/supabase/client', () => ({
  getSupabaseClient: vi.fn(),
}))

import { escapeXml } from '@/app/api/webhooks/twilio/call-forward/route'

describe('escapeXml', () => {
  it('escapes ampersand', () => {
    expect(escapeXml('AT&T')).toBe('AT&amp;T')
  })

  it('escapes angle brackets', () => {
    expect(escapeXml('<script>')).toBe('&lt;script&gt;')
  })

  it('escapes double quotes', () => {
    expect(escapeXml('he said "hi"')).toBe('he said &quot;hi&quot;')
  })

  it('escapes apostrophe', () => {
    expect(escapeXml("it's")).toBe("it&apos;s")
  })

  it('leaves clean strings unchanged', () => {
    expect(escapeXml('+15125551234')).toBe('+15125551234')
  })

  it('handles empty string', () => {
    expect(escapeXml('')).toBe('')
  })
})
