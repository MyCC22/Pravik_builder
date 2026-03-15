#!/usr/bin/env node

/**
 * Prefetch Unsplash images for 53 business categories.
 * Fetches 30 images per category (1 request each, per_page=30).
 * Total: 53 requests — exceeds Unsplash free tier (50/hour), runs in ~80 seconds with rate limiting.
 *
 * Usage: UNSPLASH_ACCESS_KEY=xxx node scripts/prefetch-unsplash.mjs
 */

const UNSPLASH_BASE = 'https://api.unsplash.com'
const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY

if (!ACCESS_KEY) {
  console.error('Missing UNSPLASH_ACCESS_KEY environment variable')
  process.exit(1)
}

const PER_PAGE = 30

// Each category uses a broad query to maximize diversity in a single request.
const CATEGORIES = [
  { id: 'yoga', query: 'yoga class meditation practice', keywords: ['yoga', 'meditation', 'mindfulness', 'pilates'] },
  { id: 'fitness', query: 'gym fitness workout exercise', keywords: ['fitness', 'gym', 'workout', 'personal trainer', 'crossfit'] },
  { id: 'spa', query: 'spa wellness massage relaxation', keywords: ['spa', 'wellness', 'massage', 'relaxation'] },
  { id: 'salon', query: 'hair salon beauty barber styling', keywords: ['salon', 'hair', 'beauty', 'barber', 'barbershop'] },
  { id: 'restaurant', query: 'restaurant dining food chef kitchen', keywords: ['restaurant', 'dining', 'food', 'bistro'] },
  { id: 'cafe', query: 'cafe coffee shop barista espresso', keywords: ['cafe', 'coffee', 'coffee shop', 'espresso'] },
  { id: 'bakery', query: 'bakery bread pastry cake fresh', keywords: ['bakery', 'bread', 'pastry', 'cake', 'patisserie'] },
  { id: 'bar', query: 'bar cocktail brewery lounge drinks', keywords: ['bar', 'cocktail', 'pub', 'nightlife', 'brewery', 'wine bar'] },
  { id: 'dental', query: 'dentist dental clinic teeth smile', keywords: ['dental', 'dentist', 'orthodontist', 'teeth', 'oral', 'dental office', 'dental care'] },
  { id: 'medical', query: 'doctor medical clinic hospital healthcare', keywords: ['medical', 'clinic', 'doctor', 'healthcare', 'hospital', 'physician', 'urgent care', 'walk-in clinic', 'family medicine'] },
  { id: 'veterinary', query: 'veterinarian pet dog cat animal care', keywords: ['veterinary', 'vet', 'pet', 'animal', 'dog', 'cat'] },
  { id: 'real-estate', query: 'real estate home house property luxury', keywords: ['real estate', 'property', 'home', 'house', 'realtor'] },
  { id: 'law', query: 'legal office law books justice professional', keywords: ['law', 'attorney', 'lawyer', 'legal', 'law firm', 'immigration', 'family law', 'immigration lawyer', 'family lawyer', 'divorce lawyer', 'visa', 'green card'] },
  { id: 'accounting', query: 'accounting finance business office tax', keywords: ['accounting', 'finance', 'tax', 'bookkeeping', 'cpa'] },
  { id: 'insurance', query: 'insurance protection family business meeting', keywords: ['insurance', 'coverage', 'protection', 'policy'] },
  { id: 'plumbing', query: 'plumber plumbing repair pipe faucet bathroom', keywords: ['plumbing', 'plumber', 'pipe', 'leak', 'faucet', 'drain', 'water heater', 'sewer'] },
  { id: 'electrician', query: 'electrician electrical wiring tools repair', keywords: ['electrician', 'electrical', 'wiring', 'power', 'circuit', 'outlet', 'panel', 'lighting installation'] },
  { id: 'landscaping', query: 'landscaping garden lawn flowers outdoor yard', keywords: ['landscaping', 'garden', 'lawn', 'outdoor', 'yard', 'gardener', 'gardening', 'tree service', 'lawn care', 'sprinkler', 'hedge'] },
  { id: 'auto-repair', query: 'auto mechanic car repair garage service', keywords: ['auto', 'mechanic', 'car repair', 'garage', 'automotive'] },
  { id: 'hvac', query: 'hvac heating cooling air conditioning technician', keywords: ['hvac', 'heating', 'cooling', 'air conditioning', 'furnace', 'ac repair', 'heat pump', 'ventilation', 'ductwork'] },
  { id: 'garage-door', query: 'garage door repair installation opener', keywords: ['garage door', 'garage door repair', 'overhead door', 'garage opener', 'garage installation'] },
  { id: 'med-spa', query: 'medical spa aesthetics skin treatment facial', keywords: ['med spa', 'medical spa', 'medspa', 'aesthetics', 'botox', 'skin treatment', 'laser treatment', 'facial', 'cosmetic', 'dermatology'] },
  { id: 'construction', query: 'construction building site contractor renovation', keywords: ['construction', 'building', 'contractor', 'renovation'] },
  { id: 'cleaning', query: 'cleaning service home professional housekeeping', keywords: ['cleaning', 'maid', 'janitorial', 'housekeeping', 'cleaner', 'house cleaning', 'carpet cleaning', 'pressure washing', 'window cleaning'] },
  { id: 'moving', query: 'moving service truck boxes packing relocation', keywords: ['moving', 'relocation', 'movers', 'packing'] },
  { id: 'photography', query: 'photographer camera studio portrait creative', keywords: ['photography', 'photographer', 'photo', 'portrait'] },
  { id: 'videography', query: 'videographer film camera production cinema', keywords: ['video', 'film', 'videographer', 'production', 'cinema'] },
  { id: 'music', query: 'music studio instruments musician guitar piano', keywords: ['music', 'musician', 'instrument', 'band', 'guitar', 'piano'] },
  { id: 'dance', query: 'dance studio ballet dancer performance class', keywords: ['dance', 'dancer', 'ballet', 'choreography'] },
  { id: 'art', query: 'art studio painting gallery artist creative', keywords: ['art', 'artist', 'painting', 'gallery', 'sculpture'] },
  { id: 'education', query: 'education classroom learning student teacher school', keywords: ['tutoring', 'education', 'teaching', 'tutor', 'school', 'learning'] },
  { id: 'test-prep', query: 'test preparation sat exam study group tutoring', keywords: ['test prep', 'sat prep', 'exam preparation', 'college prep', 'study group'] },
  { id: 'driving-school', query: 'driving school lessons instructor car', keywords: ['driving school', 'driving lessons', 'driving instructor', 'learn to drive', 'drivers ed'] },
  { id: 'language-school', query: 'language school class esl foreign language', keywords: ['language school', 'language class', 'esl', 'foreign language', 'language learning'] },
  { id: 'music-lessons', query: 'music lessons piano guitar teacher student', keywords: ['music lessons', 'piano lessons', 'guitar lessons', 'music teacher', 'music school'] },
  { id: 'tutoring', query: 'tutoring private tutor homework help student', keywords: ['tutoring', 'tutor', 'private tutor', 'homework help', 'academic tutoring'] },
  { id: 'nursing-school', query: 'nursing school program student education', keywords: ['nursing school', 'nursing program', 'nursing student', 'nursing education', 'rn program'] },
  { id: 'medical-school', query: 'medical school education student pre-med', keywords: ['medical school', 'med school', 'medical education', 'medical student', 'pre-med'] },
  { id: 'adult-certification', query: 'adult certification professional learning course', keywords: ['adult certification', 'professional certification', 'adult learning', 'continuing education', 'certification course'] },
  { id: 'kids-bootcamp', query: 'kids camp youth sports children outdoor activity', keywords: ['kids bootcamp', 'kids camp', 'children camp', 'summer camp', 'youth program', 'soccer', 'football', 'basketball', 'swim', 'tennis', 'youth sports', 'sports academy', 'kids sports', 'kids classes', 'after school program'] },
  { id: 'kids-coding', query: 'kids coding programming children computer stem', keywords: ['kids coding', 'coding for kids', 'children programming', 'kids tech', 'stem kids'] },
  { id: 'martial-arts', query: 'martial arts karate boxing training dojo', keywords: ['martial arts', 'karate', 'judo', 'boxing', 'mma', 'taekwondo'] },
  { id: 'tech', query: 'tech startup software coding modern workspace', keywords: ['tech', 'startup', 'saas', 'software', 'app', 'technology'] },
  { id: 'marketing', query: 'marketing agency team creative branding', keywords: ['marketing', 'advertising', 'branding', 'agency'] },
  { id: 'web-design', query: 'web design developer programming workspace', keywords: ['web design', 'developer', 'programming', 'web development'] },
  { id: 'consulting', query: 'consulting business meeting strategy advisor', keywords: ['consulting', 'consultant', 'advisory', 'strategy'] },
  { id: 'coaching', query: 'coaching mentor personal growth development', keywords: ['coaching', 'coach', 'mentor', 'life coach', 'personal development'] },
  { id: 'wedding', query: 'wedding ceremony bride flowers celebration', keywords: ['wedding', 'bride', 'ceremony', 'bridal'] },
  { id: 'event', query: 'event conference party celebration venue', keywords: ['event', 'conference', 'party', 'celebration', 'summit'] },
  { id: 'catering', query: 'catering food service banquet buffet chef', keywords: ['catering', 'food service', 'banquet', 'buffet'] },
  { id: 'florist', query: 'florist flowers bouquet arrangement shop', keywords: ['florist', 'flower', 'floral', 'bouquet'] },
  { id: 'fashion', query: 'fashion boutique clothing style apparel store', keywords: ['fashion', 'clothing', 'boutique', 'apparel', 'style'] },
  { id: 'interior-design', query: 'interior design modern room decor home', keywords: ['interior design', 'decor', 'interior', 'home decor'] },
]

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function fetchCategoryImages(category) {
  const params = new URLSearchParams({
    query: category.query,
    per_page: String(PER_PAGE),
    orientation: 'landscape',
  })

  const response = await fetch(`${UNSPLASH_BASE}/search/photos?${params}`, {
    headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
  })

  if (!response.ok) {
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining')
    if (response.status === 403 || rateLimitRemaining === '0') {
      // Wait for rate limit reset
      console.error(`  ⏳ Rate limited. Waiting 120 seconds...`)
      await delay(120000)
      // Retry
      const retryResponse = await fetch(`${UNSPLASH_BASE}/search/photos?${params}`, {
        headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
      })
      if (!retryResponse.ok) {
        console.error(`  ❌ Retry failed: ${retryResponse.status}`)
        return null
      }
      const retryData = await retryResponse.json()
      return (retryData.results || []).map(photo => ({
        regular: photo.urls.regular,
        small: photo.urls.small,
        alt: photo.alt_description || category.query,
        photographer: photo.user.name,
        photographerUrl: photo.user.links.html,
      }))
    }
    console.error(`  ❌ ${category.id}: ${response.status} (rate limit remaining: ${rateLimitRemaining})`)
    return null
  }

  const data = await response.json()
  const photos = data.results || []

  return photos.map(photo => ({
    regular: photo.urls.regular,
    small: photo.urls.small,
    alt: photo.alt_description || category.query,
    photographer: photo.user.name,
    photographerUrl: photo.user.links.html,
  }))
}

async function main() {
  console.log(`Prefetching ${PER_PAGE} images for ${CATEGORIES.length} categories...`)
  console.log(`Using Unsplash API key: ${ACCESS_KEY.slice(0, 8)}...`)
  console.log(`Total requests: ${CATEGORIES.length} (within 50/hour limit)\n`)

  const results = {}
  let successCount = 0
  let failCount = 0
  let totalImages = 0

  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i]
    console.log(`[${i + 1}/${CATEGORIES.length}] Fetching: ${cat.id} ("${cat.query}")`)

    const images = await fetchCategoryImages(cat)

    if (images && images.length > 0) {
      results[cat.id] = {
        keywords: cat.keywords,
        images: images,
      }
      successCount++
      totalImages += images.length
      console.log(`  ✅ Got ${images.length} images`)
    } else {
      failCount++
      console.log(`  ⚠️  No images found`)
    }

    // Rate limit: wait 1.5 seconds between requests
    if (i < CATEGORIES.length - 1) {
      await delay(1500)
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`Done! ${successCount} categories fetched, ${failCount} failed.`)
  console.log(`Total images: ${totalImages}`)
  console.log(`Average per category: ${(totalImages / Math.max(successCount, 1)).toFixed(1)}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  // Generate TypeScript file
  const tsContent = generateTypeScript(results)

  // Write to file
  const fs = await import('fs')
  const path = await import('path')
  const outPath = path.join(process.cwd(), 'src/services/unsplash/stock-images.ts')
  fs.writeFileSync(outPath, tsContent)
  console.log(`Written to: ${outPath}`)
  console.log(`File size: ${(Buffer.byteLength(tsContent) / 1024).toFixed(0)} KB`)
}

function generateTypeScript(results) {
  const totalImages = Object.values(results).reduce((sum, cat) => sum + cat.images.length, 0)

  let ts = `/**
 * Pre-fetched stock images from Unsplash, organized by business category.
 * Generated by scripts/prefetch-unsplash.mjs — do not edit manually.
 *
 * ${Object.keys(results).length} business categories × ~${PER_PAGE} images each = ~${totalImages} total.
 * During site generation, we randomly pick from these instead of making live API calls.
 * This makes generation instant and ensures sites don't all look the same.
 */

export interface StockImage {
  regular: string  // 1080px wide — use for hero backgrounds
  small: string    // 400px wide — use for gallery/thumbnails
  alt: string
  photographer: string
  photographerUrl: string
}

export interface StockCategory {
  keywords: string[]
  images: StockImage[]
}

export const STOCK_IMAGES: Record<string, StockCategory> = {\n`

  for (const [catId, catData] of Object.entries(results)) {
    ts += `  '${catId}': {\n`
    ts += `    keywords: ${JSON.stringify(catData.keywords)},\n`
    ts += `    images: [\n`
    for (const img of catData.images) {
      ts += `      {\n`
      ts += `        regular: '${img.regular}',\n`
      ts += `        small: '${img.small}',\n`
      ts += `        alt: ${JSON.stringify(img.alt)},\n`
      ts += `        photographer: ${JSON.stringify(img.photographer)},\n`
      ts += `        photographerUrl: '${img.photographerUrl}',\n`
      ts += `      },\n`
    }
    ts += `    ],\n`
    ts += `  },\n`
  }

  ts += `}

/**
 * All valid category IDs for use in generator prompts.
 */
export const CATEGORY_IDS = ${JSON.stringify(Object.keys(results))} as const

export type CategoryId = typeof CATEGORY_IDS[number]

/**
 * Pick a random image from a category.
 * Returns null if category not found or has no images.
 */
export function pickRandomImage(categoryId: string): StockImage | null {
  const category = STOCK_IMAGES[categoryId]
  if (!category || category.images.length === 0) return null
  const index = Math.floor(Math.random() * category.images.length)
  return category.images[index]
}

/**
 * Pick multiple unique random images from a category (for galleries).
 * Returns up to \`count\` images, fewer if category has less.
 */
export function pickRandomImages(categoryId: string, count: number): StockImage[] {
  const category = STOCK_IMAGES[categoryId]
  if (!category || category.images.length === 0) return []

  // Shuffle and take up to count
  const shuffled = [...category.images].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

/**
 * Try to match a search query or business description to a category.
 * Uses keyword matching — returns the best matching category ID or null.
 */
export function matchCategory(query: string): string | null {
  const lower = query.toLowerCase()
  let bestMatch: string | null = null
  let bestScore = 0

  for (const [catId, catData] of Object.entries(STOCK_IMAGES)) {
    let score = 0
    for (const keyword of catData.keywords) {
      if (lower.includes(keyword)) {
        score += keyword.length // longer keyword matches are more specific
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestMatch = catId
    }
  }

  return bestMatch
}

/**
 * Check if stock images are available (prefetch has been run).
 */
export function hasStockImages(): boolean {
  return Object.keys(STOCK_IMAGES).length > 0
}
`

  return ts
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
