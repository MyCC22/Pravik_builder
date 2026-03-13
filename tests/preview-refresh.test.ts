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

const mockReq = {} as any
const mockParams = { params: Promise.resolve({ callSid: 'CA_test_preview' }) }

/**
 * Build chained Supabase mocks for reconciliation endpoint.
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
describe('Reconciliation endpoint — preview refresh support', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns lastEditTimestamp from project updated_at', async () => {
    const updatedAt = '2025-03-13T10:30:00.000Z'
    setupSupabaseMocks({
      sessionData: { project_id: 'proj-1', state: 'building' },
      projectData: {
        name: 'My Site',
        provisioned_phone: null,
        forwarding_phone: null,
        updated_at: updatedAt,
      },
      blocksCount: 3,
      bookingCount: 0,
    })

    const res = await GET(mockReq, mockParams)

    expect(res.data.lastEditTimestamp).toBe(new Date(updatedAt).getTime())
  })

  it('returns null lastEditTimestamp when project has no updated_at', async () => {
    setupSupabaseMocks({
      sessionData: { project_id: 'proj-1', state: 'building' },
      projectData: {
        name: 'My Site',
        provisioned_phone: null,
        forwarding_phone: null,
        updated_at: null,
      },
      blocksCount: 0,
      bookingCount: 0,
    })

    const res = await GET(mockReq, mockParams)

    expect(res.data.lastEditTimestamp).toBeNull()
  })

  it('returns build_site in completedSteps when blocks exist (triggers preview refresh)', async () => {
    setupSupabaseMocks({
      sessionData: { project_id: 'proj-1', state: 'building' },
      projectData: {
        name: 'My Site',
        provisioned_phone: null,
        forwarding_phone: null,
        updated_at: '2025-03-13T10:00:00.000Z',
      },
      blocksCount: 5,
      bookingCount: 0,
    })

    const res = await GET(mockReq, mockParams)

    expect(res.data.completedSteps).toContain('build_site')
  })

  it('returns empty completedSteps when no blocks (no preview to refresh)', async () => {
    setupSupabaseMocks({
      sessionData: { project_id: 'proj-1', state: 'greeting' },
      projectData: {
        name: 'My Site',
        provisioned_phone: null,
        forwarding_phone: null,
        updated_at: null,
      },
      blocksCount: 0,
      bookingCount: 0,
    })

    const res = await GET(mockReq, mockParams)

    expect(res.data.completedSteps).toEqual([])
    expect(res.data.lastEditTimestamp).toBeNull()
  })

  it('includes timestamp for reconciliation freshness checks', async () => {
    setupSupabaseMocks({
      sessionData: { project_id: 'proj-1', state: 'building' },
      projectData: {
        name: 'My Site',
        provisioned_phone: null,
        forwarding_phone: null,
        updated_at: '2025-03-13T10:00:00.000Z',
      },
      blocksCount: 0,
      bookingCount: 0,
    })

    const before = Date.now()
    const res = await GET(mockReq, mockParams)
    const after = Date.now()

    expect(res.data.timestamp).toBeGreaterThanOrEqual(before)
    expect(res.data.timestamp).toBeLessThanOrEqual(after)
  })
})

// ---------------------------------------------------------------------------
describe('No polling interval in page component', () => {
  it('page.tsx does not contain setInterval for preview polling', async () => {
    // Read the actual page source to verify no polling pattern exists
    const fs = await import('fs')
    const path = await import('path')
    const pageSource = fs.readFileSync(
      path.resolve(__dirname, '../src/app/build/[projectId]/page.tsx'),
      'utf-8'
    )

    // Should NOT have the old polling fetch with ?poll=1 parameter
    expect(pageSource).not.toContain('?poll=1')

    // Should NOT have a setInterval that fetches the preview API
    // (matches "setInterval(async () => { ... fetch(.../preview/..." patterns)
    const pollingPattern = /setInterval\s*\(\s*async\s*\(\)\s*=>\s*\{[^}]*preview/s
    expect(pageSource).not.toMatch(pollingPattern)
  })
})
