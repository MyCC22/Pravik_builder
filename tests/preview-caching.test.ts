import { vi, describe, it, expect, beforeEach } from 'vitest'

// --- Supabase mock ---
const mockFrom = vi.fn()

vi.mock('@/services/supabase/client', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

// --- Template render mocks ---
vi.mock('@/templates/render', () => ({
  renderTemplate: vi.fn(() => '<html><body>Template</body></html>'),
}))

vi.mock('@/templates/render-blocks', () => ({
  renderFromBlocks: vi.fn(() => '<html><body>Blocks</body></html>'),
}))

import { GET } from '@/app/api/builder/preview/[projectId]/route'

const mockReq = {} as any
const mockParams = { params: Promise.resolve({ projectId: 'test-project-id' }) }

// ---------------------------------------------------------------------------
describe('GET /api/builder/preview/[projectId] — caching headers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns Cache-Control with s-maxage (CDN caching)', async () => {
    const res = await GET(mockReq, mockParams)

    const cacheControl = res.headers.get('Cache-Control')
    expect(cacheControl).toContain('s-maxage')
  })

  it('does NOT include no-store in Cache-Control', async () => {
    const res = await GET(mockReq, mockParams)

    const cacheControl = res.headers.get('Cache-Control')
    expect(cacheControl).not.toContain('no-store')
    expect(cacheControl).not.toContain('no-cache')
  })

  it('returns Content-Type text/html', async () => {
    const res = await GET(mockReq, mockParams)

    expect(res.headers.get('Content-Type')).toBe('text/html')
  })

  it('includes stale-while-revalidate for CDN freshness', async () => {
    const res = await GET(mockReq, mockParams)

    const cacheControl = res.headers.get('Cache-Control')
    expect(cacheControl).toContain('stale-while-revalidate')
  })
})
