import { vi, describe, it, expect, beforeEach } from 'vitest'

// --- Supabase mock ---
const mockFrom = vi.fn()

vi.mock('@/services/supabase/client', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

// --- next/server mock ---
// The route uses `new NextResponse(body, { headers })`, so we need a class.
vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: class MockNextResponse {
    body: string
    status: number
    headers: Map<string, string>

    constructor(body: string, opts?: { headers?: Record<string, string>; status?: number }) {
      this.body = body
      this.status = opts?.status ?? 200
      this.headers = new Map(Object.entries(opts?.headers ?? {}))
    }
  },
}))

// Mock generateAfterHoursStreamTwiML (imported by the route)
vi.mock('@/services/twilio/client', () => ({
  generateAfterHoursStreamTwiML: vi.fn(() => '<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream /></Connect></Response>'),
}))

import { POST } from '@/app/api/webhooks/twilio/call-forward/route'

/**
 * Create a mock NextRequest whose formData() returns Called, From, and CallSid fields.
 */
function createMockRequest(calledNumber?: string) {
  const map = new Map<string, string>()
  if (calledNumber !== undefined) {
    map.set('Called', calledNumber)
  }
  map.set('From', '+15550001111')
  map.set('CallSid', 'CA_test_123')
  return {
    formData: vi.fn().mockResolvedValue(map),
  } as any
}

/**
 * Wire up `mockFrom` so it returns different chains for 'projects', 'users', and 'tools'.
 */
function setupSupabaseMocks(opts: {
  projectData?: { id?: string; user_id: string; forwarding_phone: string | null } | null
  projectError?: boolean
  userData?: { phone_number: string | null } | null
  userError?: boolean
  toolData?: { id: string; config: any } | null
}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'projects') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: opts.projectData ? { id: opts.projectData.id || 'proj-1', ...opts.projectData } : null,
              error: opts.projectError ? { message: 'not found' } : null,
            }),
          }),
        }),
      }
    }

    if (table === 'users') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: opts.userData ?? null,
              error: opts.userError ? { message: 'not found' } : null,
            }),
          }),
        }),
      }
    }

    if (table === 'tools') {
      // Chain: .select().eq().eq().eq().single()
      const singleFn = vi.fn().mockResolvedValue({
        data: opts.toolData ?? null,
        error: opts.toolData ? null : { message: 'not found' },
      })
      const eqFn = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: singleFn }) }) })
      return {
        select: vi.fn().mockReturnValue({
          eq: eqFn,
        }),
      }
    }

    return {}
  })
}

// ---------------------------------------------------------------------------
describe('POST /api/webhooks/twilio/call-forward', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forwards to forwarding_phone when set on the project', async () => {
    setupSupabaseMocks({
      projectData: { user_id: 'user-1', forwarding_phone: '+15559876543' },
    })

    const res = await POST(createMockRequest('+15551234567'))

    expect(res.body).toContain('<Dial')
    expect(res.body).toContain('+15559876543')
    expect(res.headers.get('Content-Type')).toBe('text/xml')
  })

  it('falls back to user phone when no forwarding_phone is set', async () => {
    setupSupabaseMocks({
      projectData: { user_id: 'user-1', forwarding_phone: null },
      userData: { phone_number: '+15551112222' },
    })

    const res = await POST(createMockRequest('+15551234567'))

    expect(res.body).toContain('<Dial')
    expect(res.body).toContain('+15551112222')
  })

  it('returns "not currently active" when no project is found', async () => {
    setupSupabaseMocks({
      projectData: null,
      projectError: true,
    })

    const res = await POST(createMockRequest('+15559999999'))

    expect(res.body).toContain('not currently active')
  })

  it('returns "could not connect" when no user phone is found', async () => {
    setupSupabaseMocks({
      projectData: { user_id: 'user-1', forwarding_phone: null },
      userData: null,
      userError: true,
    })

    const res = await POST(createMockRequest('+15551234567'))

    expect(res.body).toContain('could not connect')
  })

  it('returns "something went wrong" when Called is missing', async () => {
    // Create request with no Called field
    const req = createMockRequest()

    const res = await POST(req)

    expect(res.body).toContain('something went wrong')
  })

  it('includes the correct phone number in the TwiML Dial element', async () => {
    const targetPhone = '+15553334444'
    setupSupabaseMocks({
      projectData: { user_id: 'user-1', forwarding_phone: targetPhone },
    })

    const res = await POST(createMockRequest('+15551234567'))

    // The TwiML should have the forwarding number inside <Dial>
    // The route escapes XML, but phone numbers don't need escaping
    expect(res.body).toContain(`>${targetPhone}</Dial>`)
    expect(res.body).toContain('<?xml version="1.0"')
    expect(res.body).toContain('<Response>')
  })
})
