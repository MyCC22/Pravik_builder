# Pexels API-First Hero Image Selection

**Date:** 2026-03-15
**Status:** Draft
**Scope:** Hero image only (gallery images unchanged)

## Problem

The current image system uses 39 broad stock categories to select hero images. When a user asks for a "Bollywood dance class" website, the system maps to the "dance" stock category — which contains almost exclusively ballet photos. The AI generates a specific `heroImageQuery` (e.g., "bollywood dance class") but the stock path ignores it entirely, always preferring the category-based stock image.

## Solution

Switch hero image selection to a **Pexels API-first** strategy. Use the AI's `heroImageQuery` to search the Pexels photo API for a relevant hero image. Fall back to the existing stock image system only if the API call fails.

**Priority order (hero only):**
1. Pexels API search using `heroImageQuery` → use `src.large` (940×650)
2. Stock image category (existing behavior) → fallback
3. Gradient placeholder → final fallback

Gallery images remain unchanged (stock-first, as today).

## Architecture

### New File: `src/services/pexels/client.ts`

Thin wrapper around the Pexels search endpoint.

```
Endpoint:  GET https://api.pexels.com/v1/search
Auth:      Authorization: {PEXELS_API_KEY}
Params:    query, orientation=landscape, per_page=1
Timeout:   5 seconds (matches existing Unsplash timeout)
Returns:   string (image URL) | null
```

**Exports:**
- `searchPexelsHeroImage(query: string): Promise<string | null>` — searches Pexels, returns `src.large` URL of the first result, or `null` on any failure (timeout, no results, missing key).

**Error handling:**
- 5-second AbortController timeout (same pattern as Unsplash client)
- Missing `PEXELS_API_KEY` env var → return `null` immediately (no crash)
- API errors (429 rate limit, 5xx) → return `null`
- Empty results → return `null`
- All failures are non-fatal; function never throws

### Modified File: `src/services/unsplash/image-fetcher.ts`

Only `fetchTemplateImages()` changes. Before the existing stock/Unsplash logic for hero images, attempt a Pexels API call:

```
1. Extract heroQuery from config.content.heroImageQuery || config.content.siteName
2. Call searchPexelsHeroImage(heroQuery)
3. If result is non-null → set heroImageUrl = result, skip stock/Unsplash for hero
4. If null → fall through to existing stock → Unsplash → gradient chain
5. Gallery image logic is completely untouched
```

### Environment Variable

- **Key:** `PEXELS_API_KEY`
- **Where:** `.env.local` (local dev) + Vercel environment variables (production)
- **Not hardcoded** in source code

## Image Size Choice

Using `src.large` (940×650) from Pexels responses. Rationale:

| Size | Dimensions | Decision |
|------|-----------|----------|
| `original` | Varies, potentially huge | Too heavy |
| `large2x` | 1880×1300 | Full HD, unnecessarily large |
| `large` | 940×650 | **Selected** — good balance of quality/size for hero banners |
| `medium` | 350px height | Too small for full-width hero backgrounds |

## Files Changed

| File | Change |
|------|--------|
| `src/services/pexels/client.ts` | **New** — Pexels API client |
| `src/services/unsplash/image-fetcher.ts` | Add Pexels-first call for hero image |
| `.env.local` | Add `PEXELS_API_KEY` |

## What Does NOT Change

- Stock image system (stock-images.ts) — untouched
- Unsplash client (unsplash/client.ts) — untouched
- Gallery image selection — still stock-first
- AI prompt (heroImageQuery generation) — already works well
- Template rendering — receives heroImageUrl same as before
- Image change via chat (orchestrator) — still uses Unsplash fetchSingleImage

## Testing

1. Generate a "Bollywood dance class" site → hero should show Bollywood dance, not ballet
2. Generate a "soccer academy" site → hero should show soccer, not generic sports
3. Disconnect API key → should gracefully fall back to stock images
4. Verify gallery images are still stock-based (unchanged)
