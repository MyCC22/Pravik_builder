import { searchPhotos } from './client'
import { hasStockImages, pickRandomImage, pickRandomImages, matchCategory } from './stock-images'
import { searchPexelsHeroImage } from '@/services/pexels/client'
import type { TemplateConfig } from '@/templates/types'

export interface TemplateImages {
  heroImageUrl?: string
  galleryImageUrls?: string[]
}

/**
 * Fetch images for a template config.
 *
 * Strategy:
 * 1. Try Pexels API first for hero image (uses AI's specific heroImageQuery)
 * 2. If stock images are available (prefetched), use those — instant, no API call.
 *    Uses businessCategory from the AI config to pick the right category.
 * 3. Otherwise, fall back to live Unsplash API calls (slower, needs API key).
 * 4. If both fail, return empty object — templates gracefully fall back to gradient placeholders.
 */
export async function fetchTemplateImages(config: TemplateConfig): Promise<TemplateImages> {
  // 1. Try Pexels API first for hero image (uses AI's specific heroImageQuery)
  const heroQuery = config.content.heroImageQuery || config.content.siteName || 'business'
  let pexelsHeroUrl: string | null = null
  try {
    pexelsHeroUrl = await searchPexelsHeroImage(heroQuery)
  } catch {
    // Non-fatal — fall through to stock/Unsplash
  }

  // 2. Get gallery images (and fallback hero) from existing stock/Unsplash chain
  let images: TemplateImages
  if (hasStockImages()) {
    images = fetchFromStockImages(config)
  } else {
    images = await fetchFromUnsplashApi(config)
  }

  // 3. Override hero with Pexels result if available
  if (pexelsHeroUrl) {
    images.heroImageUrl = pexelsHeroUrl
  }

  return images
}

/**
 * Fetch images from pre-fetched stock images. Instant — no API calls.
 */
function fetchFromStockImages(config: TemplateConfig): TemplateImages {
  const result: TemplateImages = {}

  // Determine category from AI-generated businessCategory, or match from heroImageQuery/siteName
  const categoryId =
    config.content.businessCategory ||
    matchCategory(config.content.heroImageQuery || config.content.siteName || '')

  if (!categoryId) return result

  // Pick a random hero image from the category
  const heroImage = pickRandomImage(categoryId)
  if (heroImage) {
    result.heroImageUrl = heroImage.regular
  }

  // Pick gallery images from the same category
  const galleryItems = config.content.galleryItems || []
  if (galleryItems.length > 0) {
    const galleryImages = pickRandomImages(categoryId, galleryItems.length)
    result.galleryImageUrls = galleryItems.map((_item, i) =>
      galleryImages[i]?.small || ''
    )
  }

  return result
}

/**
 * Fetch images from the live Unsplash API. Slower but works without prefetch.
 */
async function fetchFromUnsplashApi(config: TemplateConfig): Promise<TemplateImages> {
  if (!process.env.UNSPLASH_ACCESS_KEY) {
    return {}
  }

  const result: TemplateImages = {}

  // Build all fetch promises in parallel
  const heroQuery = config.content.heroImageQuery || config.content.siteName || 'business'
  const heroPromise = searchPhotos(heroQuery, { perPage: 1, orientation: 'landscape' })

  const galleryPromises = (config.content.galleryItems || []).map(item =>
    searchPhotos(item.title, { perPage: 1, orientation: 'landscape' })
  )

  // Run all in parallel with a 5-second timeout
  const timeoutPromise = <T>(promise: Promise<T>, ms: number): Promise<T | null> =>
    Promise.race([promise, new Promise<null>(resolve => setTimeout(() => resolve(null), ms))])

  const [heroResult, ...galleryResults] = await Promise.allSettled([
    timeoutPromise(heroPromise, 5000),
    ...galleryPromises.map(p => timeoutPromise(p, 5000)),
  ])

  // Extract hero image
  if (heroResult.status === 'fulfilled' && heroResult.value && heroResult.value.length > 0) {
    result.heroImageUrl = heroResult.value[0].urls.regular
  }

  // Extract gallery images
  if (galleryResults.length > 0) {
    result.galleryImageUrls = galleryResults.map(r =>
      r.status === 'fulfilled' && r.value && r.value.length > 0
        ? r.value[0].urls.small
        : ''
    )
  }

  return result
}

/**
 * Search for a single image by query. Used for image change requests.
 * Always uses live API since the user is requesting a specific image.
 * Returns the regular-size URL or null.
 */
export async function fetchSingleImage(
  query: string,
  orientation: 'landscape' | 'portrait' | 'squarish' = 'landscape'
): Promise<string | null> {
  const photos = await searchPhotos(query, { perPage: 1, orientation })
  return photos.length > 0 ? photos[0].urls.regular : null
}
