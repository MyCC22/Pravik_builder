const PEXELS_BASE_URL = 'https://api.pexels.com/v1'
const REQUEST_TIMEOUT_MS = 5000

interface PexelsPhoto {
  id: number
  src: {
    original: string
    large2x: string
    large: string
    medium: string
    small: string
    portrait: string
    landscape: string
    tiny: string
  }
  photographer: string
  alt: string
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[]
  total_results: number
}

/**
 * Search Pexels for a hero image matching the given query.
 * Returns the `src.large` URL (max 940px wide) of the first result,
 * or null on any failure. Never throws.
 */
export async function searchPexelsHeroImage(query: string): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    console.warn('[pexels] PEXELS_API_KEY not set, skipping Pexels search')
    return null
  }

  if (!query || query.trim().length === 0) {
    return null
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const params = new URLSearchParams({
      query: query.trim(),
      orientation: 'landscape',
      per_page: '1',
    })

    const response = await fetch(`${PEXELS_BASE_URL}/search?${params}`, {
      headers: {
        Authorization: apiKey,
      },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.warn(`[pexels] Search failed: ${response.status} ${response.statusText} for query: "${query}"`)
      return null
    }

    const data = (await response.json()) as PexelsSearchResponse

    if (!data.photos || data.photos.length === 0) {
      console.warn(`[pexels] No results for query: "${query}"`)
      return null
    }

    const imageUrl = data.photos[0].src?.large
    if (!imageUrl) {
      console.warn(`[pexels] First result missing src.large for query: "${query}"`)
      return null
    }

    return imageUrl
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[pexels] Search timed out after ${REQUEST_TIMEOUT_MS}ms for query: "${query}"`)
    } else {
      console.warn('[pexels] Search error:', error)
    }
    return null
  }
}
