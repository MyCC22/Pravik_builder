const UNSPLASH_BASE_URL = 'https://api.unsplash.com'
const REQUEST_TIMEOUT_MS = 5000 // 5 second timeout per request

export interface UnsplashPhoto {
  id: string
  urls: {
    raw: string
    regular: string
    small: string
    thumb: string
  }
  alt_description: string | null
  user: {
    name: string
    links: { html: string }
  }
}

interface SearchOptions {
  perPage?: number
  orientation?: 'landscape' | 'portrait' | 'squarish'
}

function getAccessKey(): string | null {
  return process.env.UNSPLASH_ACCESS_KEY || null
}

/**
 * Search Unsplash photos by query.
 * Returns empty array if API key is missing or request fails (graceful fallback).
 * Includes a 5-second timeout to prevent hanging.
 */
export async function searchPhotos(
  query: string,
  options: SearchOptions = {}
): Promise<UnsplashPhoto[]> {
  const accessKey = getAccessKey()
  if (!accessKey) return []

  const { perPage = 5, orientation = 'landscape' } = options

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const params = new URLSearchParams({
      query,
      per_page: String(perPage),
      orientation,
    })

    const response = await fetch(`${UNSPLASH_BASE_URL}/search/photos?${params}`, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.error(`Unsplash search failed: ${response.status} ${response.statusText}`)
      return []
    }

    const data = await response.json()
    return (data.results || []) as UnsplashPhoto[]
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Unsplash search timed out after ${REQUEST_TIMEOUT_MS}ms for query: "${query}"`)
    } else {
      console.error('Unsplash search error:', error)
    }
    return []
  }
}

/**
 * Get a single random photo matching a query.
 * Returns null if API key is missing or request fails.
 */
export async function getRandomPhoto(
  query: string,
  orientation: 'landscape' | 'portrait' | 'squarish' = 'landscape'
): Promise<UnsplashPhoto | null> {
  const accessKey = getAccessKey()
  if (!accessKey) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const params = new URLSearchParams({ query, orientation })

    const response = await fetch(`${UNSPLASH_BASE_URL}/photos/random?${params}`, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.error(`Unsplash random failed: ${response.status} ${response.statusText}`)
      return null
    }

    return (await response.json()) as UnsplashPhoto
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Unsplash random timed out after ${REQUEST_TIMEOUT_MS}ms for query: "${query}"`)
    } else {
      console.error('Unsplash random error:', error)
    }
    return null
  }
}
