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

import { GET } from '@/app/api/projects/[projectId]/completion/route'

// Helpers
const mockReq = {} as any
const mockParams = { params: Promise.resolve({ projectId: 'test-project-id' }) }

/**
 * Build the chained mock for a given table.
 *
 * blocks  -> .from('blocks').select(...).eq('project_id', ...) => { count }
 * tools   -> .from('tools').select(...).eq('project_id', ...).eq('tool_type', 'booking') => { count }
 * projects -> .from('projects').select(...).eq('id', ...).single() => { data }
 */
function setupSupabaseMocks(opts: {
  blocksCount: number | null
  bookingCount: number | null
  projectData: Record<string, unknown> | null
}) {
  // Track call order to distinguish tables
  mockFrom.mockImplementation((table: string) => {
    if (table === 'blocks') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: opts.blocksCount, error: null }),
        }),
      }
    }

    if (table === 'tools') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: opts.bookingCount, error: null }),
          }),
        }),
      }
    }

    if (table === 'projects') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: opts.projectData, error: null }),
          }),
        }),
      }
    }

    return {}
  })
}

// ---------------------------------------------------------------------------
describe('GET /api/projects/[projectId]/completion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all true when blocks, booking tool, phone, and forwarding phone exist', async () => {
    setupSupabaseMocks({
      blocksCount: 3,
      bookingCount: 1,
      projectData: {
        provisioned_phone: '+15551234567',
        forwarding_phone: '+15559876543',
      },
    })

    const res = await GET(mockReq, mockParams)

    expect(res.data).toEqual({
      hasBlocks: true,
      hasBookingTool: true,
      hasPhone: true,
      hasForwardingPhone: true,
    })
  })

  it('returns all false when project is empty', async () => {
    setupSupabaseMocks({
      blocksCount: 0,
      bookingCount: 0,
      projectData: {
        provisioned_phone: null,
        forwarding_phone: null,
      },
    })

    const res = await GET(mockReq, mockParams)

    expect(res.data).toEqual({
      hasBlocks: false,
      hasBookingTool: false,
      hasPhone: false,
      hasForwardingPhone: false,
    })
  })

  it('returns only hasBlocks true when only blocks exist', async () => {
    setupSupabaseMocks({
      blocksCount: 5,
      bookingCount: 0,
      projectData: {
        provisioned_phone: null,
        forwarding_phone: null,
      },
    })

    const res = await GET(mockReq, mockParams)

    expect(res.data).toEqual({
      hasBlocks: true,
      hasBookingTool: false,
      hasPhone: false,
      hasForwardingPhone: false,
    })
  })

  it('returns hasPhone true but hasForwardingPhone false when phone exists without forwarding', async () => {
    setupSupabaseMocks({
      blocksCount: 0,
      bookingCount: 0,
      projectData: {
        provisioned_phone: '+15551234567',
        forwarding_phone: null,
      },
    })

    const res = await GET(mockReq, mockParams)

    expect(res.data).toEqual({
      hasBlocks: false,
      hasBookingTool: false,
      hasPhone: true,
      hasForwardingPhone: false,
    })
  })

  it('returns graceful fallback (all false, status 200) on database error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('DB connection failed')
    })

    const res = await GET(mockReq, mockParams)

    expect(res.data).toEqual({
      hasBlocks: false,
      hasBookingTool: false,
      hasPhone: false,
      hasForwardingPhone: false,
    })
    expect(res.status).toBe(200)
  })
})
