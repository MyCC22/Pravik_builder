import { vi, describe, it, expect, beforeEach } from 'vitest'

// --- Supabase mock ---
const mockFrom = vi.fn()

vi.mock('@/services/supabase/client', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

// --- next/server mock ---
vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    json: vi.fn((data: unknown, opts?: { status?: number }) => ({
      data,
      status: opts?.status ?? 200,
    })),
  },
}))

import { GET } from '@/app/api/voice/state/[callSid]/route'

// Helpers
const mockReq = {} as any
const mockParams = { params: Promise.resolve({ callSid: 'CA_test_123' }) }

/**
 * Build chained mocks for all tables used by the reconciliation endpoint.
 *
 * call_sessions -> .from('call_sessions').select(...).eq('call_sid', ...).single()
 * projects      -> .from('projects').select(...).eq('id', ...).single()
 * blocks        -> .from('blocks').select(...).eq('project_id', ...)
 * tools         -> .from('tools').select(...).eq('project_id', ...).eq('tool_type', 'booking')
 */
function setupSupabaseMocks(opts: {
  sessionData: Record<string, unknown> | null
  projectData?: Record<string, unknown> | null
  blocksCount?: number | null
  bookingCount?: number | null
}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'call_sessions') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: opts.sessionData, error: null }),
          }),
        }),
      }
    }

    if (table === 'projects') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: opts.projectData ?? null, error: null }),
          }),
        }),
      }
    }

    if (table === 'blocks') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: opts.blocksCount ?? 0, error: null }),
        }),
      }
    }

    if (table === 'tools') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: opts.bookingCount ?? 0, error: null }),
          }),
        }),
      }
    }

    return {}
  })
}

// ---------------------------------------------------------------------------
describe('GET /api/voice/state/[callSid]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns completed steps including build_site when blocks exist', async () => {
    setupSupabaseMocks({
      sessionData: { project_id: 'proj-1', state: 'building' },
      projectData: { name: 'My Site', provisioned_phone: null, forwarding_phone: null },
      blocksCount: 3,
      bookingCount: 0,
    })

    const res = await GET(mockReq, mockParams)

    expect(res.data.completedSteps).toContain('build_site')
    expect(res.data.completedSteps).not.toContain('contact_form')
    expect(res.data.completedSteps).not.toContain('phone_number')
    expect(res.data.completedSteps).not.toContain('call_forwarding')
  })

  it('returns completed steps including phone_number when phone is provisioned', async () => {
    setupSupabaseMocks({
      sessionData: { project_id: 'proj-1', state: 'follow_up' },
      projectData: { name: 'My Site', provisioned_phone: '+15551234567', forwarding_phone: null },
      blocksCount: 3,
      bookingCount: 0,
    })

    const res = await GET(mockReq, mockParams)

    expect(res.data.completedSteps).toContain('phone_number')
    expect(res.data.completedSteps).toContain('build_site')
    expect(res.data.completedSteps).not.toContain('call_forwarding')
  })

  it('returns completed steps including call_forwarding when forwarding phone exists', async () => {
    setupSupabaseMocks({
      sessionData: { project_id: 'proj-1', state: 'follow_up' },
      projectData: {
        name: 'My Site',
        provisioned_phone: '+15551234567',
        forwarding_phone: '+15559876543',
      },
      blocksCount: 3,
      bookingCount: 0,
    })

    const res = await GET(mockReq, mockParams)

    expect(res.data.completedSteps).toContain('call_forwarding')
    expect(res.data.completedSteps).toContain('phone_number')
  })

  it('returns completed steps including contact_form when booking tool exists', async () => {
    setupSupabaseMocks({
      sessionData: { project_id: 'proj-1', state: 'building' },
      projectData: { name: 'My Site', provisioned_phone: null, forwarding_phone: null },
      blocksCount: 3,
      bookingCount: 1,
    })

    const res = await GET(mockReq, mockParams)

    expect(res.data.completedSteps).toContain('contact_form')
    expect(res.data.completedSteps).toContain('build_site')
  })

  it('returns empty completedSteps for a new project with no content', async () => {
    setupSupabaseMocks({
      sessionData: { project_id: 'proj-1', state: 'greeting' },
      projectData: { name: 'My Site', provisioned_phone: null, forwarding_phone: null },
      blocksCount: 0,
      bookingCount: 0,
    })

    const res = await GET(mockReq, mockParams)

    expect(res.data.completedSteps).toEqual([])
  })

  it('returns 404 for an unknown callSid', async () => {
    setupSupabaseMocks({
      sessionData: null,
    })

    const res = await GET(mockReq, mockParams)

    expect(res.status).toBe(404)
    expect(res.data).toEqual({ error: 'not_found' })
  })

  it('returns the correct projectId from the session', async () => {
    setupSupabaseMocks({
      sessionData: { project_id: 'proj-abc-123', state: 'building' },
      projectData: { name: 'Test Project', provisioned_phone: null, forwarding_phone: null },
      blocksCount: 0,
      bookingCount: 0,
    })

    const res = await GET(mockReq, mockParams)

    expect(res.data.projectId).toBe('proj-abc-123')
  })

  it('returns the projectName from the project', async () => {
    setupSupabaseMocks({
      sessionData: { project_id: 'proj-1', state: 'building' },
      projectData: { name: 'Awesome Pizza', provisioned_phone: null, forwarding_phone: null },
      blocksCount: 0,
      bookingCount: 0,
    })

    const res = await GET(mockReq, mockParams)

    expect(res.data.projectName).toBe('Awesome Pizza')
  })
})
