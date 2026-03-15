# Pexels API-First Hero Image Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stock-category-based hero image selection with a Pexels API search using the AI's specific `heroImageQuery`, so hero images actually match the business (e.g., Bollywood dance → Bollywood dance photo, not ballet).

**Architecture:** New `src/services/pexels/client.ts` wraps the Pexels search endpoint. `fetchTemplateImages()` in `image-fetcher.ts` calls Pexels first for hero images; falls back to existing stock → Unsplash → gradient chain on failure. Gallery images are untouched.

**Tech Stack:** Pexels API v1, native `fetch` with AbortController timeout, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-15-pexels-hero-image-design.md`

---

## Chunk 1: Pexels Client + Image Fetcher Integration

### Task 1: Create Pexels API client

**Files:**
- Create: `src/services/pexels/client.ts`

- [ ] **Step 1: Create the Pexels client module**

Create `src/services/pexels/client.ts`:

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i pexels || echo "No pexels errors"`
Expected: No errors related to pexels

- [ ] **Step 3: Commit**

```bash
git add src/services/pexels/client.ts
git commit -m "feat: add Pexels API client for hero image search"
```

---

### Task 2: Wire Pexels into image-fetcher for hero images

**Files:**
- Modify: `src/services/unsplash/image-fetcher.ts`

- [ ] **Step 1: Add Pexels import and modify fetchTemplateImages**

At the top of `image-fetcher.ts`, add the import:

```typescript
import { searchPexelsHeroImage } from '@/services/pexels/client'
```

Replace the current `fetchTemplateImages` function body with:

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "image-fetcher\|pexels" || echo "No errors"`
Expected: No errors

- [ ] **Step 3: Run full build**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/services/unsplash/image-fetcher.ts
git commit -m "feat: use Pexels API-first for hero images, stock as fallback"
```

---

### Task 3: Add environment variable and deploy

**Files:**
- Modify: `.env.local` (add PEXELS_API_KEY)

- [ ] **Step 1: Add PEXELS_API_KEY to .env.local**

Append to `.env.local`:

```
PEXELS_API_KEY=<obtain from team — do not commit to git>
```

- [ ] **Step 2: Add PEXELS_API_KEY to Vercel environment variables**

Run: `npx vercel env add PEXELS_API_KEY production`

Or set via Vercel dashboard: Project Settings → Environment Variables.

- [ ] **Step 3: Push and deploy**

```bash
git push origin main
npx vercel --prod --yes
```

- [ ] **Step 4: Smoke test — verify all spec test scenarios**

1. Generate a "Bollywood dance class" site → hero should show Bollywood dance, not ballet
2. Generate a "soccer academy" site → hero should show soccer, not generic sports
3. Remove `PEXELS_API_KEY` from env → regenerate site → should fall back to stock images (no crash)
4. When Pexels hero succeeds, verify gallery images are still stock-based (unchanged)
5. Site with empty `heroImageQuery` → should fall back to `siteName` then `'business'`
6. If Pexels returns a result without `src.large` → should return null, fall back to stock
