import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/services/supabase/client', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'user-1' }, error: null }),
        }),
      }),
    }),
  })),
}))

const mockVerify = vi.hoisted(() => vi.fn())
vi.mock('@/services/twilio/client', () => ({
  verifyWebhookSignature: mockVerify,
  generateTwiML: vi.fn((msg: string) => `<Response><Say>${msg}</Say></Response>`),
  generateMediaStreamTwiML: vi.fn(() => '<Response></Response>'),
}))

import { POST } from '@/app/api/webhooks/twilio/route'

function makeRequest(params: Record<string, string> = {}) {
  const form = new FormData()
  Object.entries({ From: '+15551234567', CallSid: 'CA_test', ...params }).forEach(
    ([k, v]) => form.append(k, v)
  )
  return new Request('https://example.com/api/webhooks/twilio', {
    method: 'POST',
    body: form,
    headers: { 'x-twilio-signature': 'test-sig', host: 'example.com' },
  }) as any
}

describe('Twilio webhook signature handling', () => {
  beforeEach(() => vi.clearAllMocks())

  it('allows requests with invalid signature (warn-only mode)', async () => {
    // Signature verification is warn-only until URL parity with Twilio is confirmed.
    // On Vercel, host/proto headers can differ from what Twilio signs against.
    mockVerify.mockResolvedValue(false)
    const res = await POST(makeRequest())
    // Should NOT reject — warn-only mode lets requests through
    expect(res.status).not.toBe(403)
  })

  it('processes valid requests normally', async () => {
    mockVerify.mockResolvedValue(true)
    const res = await POST(makeRequest())
    expect(res.status).not.toBe(403)
  })
})
