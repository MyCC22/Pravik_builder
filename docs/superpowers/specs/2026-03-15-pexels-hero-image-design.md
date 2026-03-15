# Pexels API-First Hero Image Selection

**Date:** 2026-03-15
**Status:** Draft
**Scope:** Hero image only (gallery images unchanged)

## Problem

The current image system uses 39 broad stock categories to select hero images. When a user asks for a "Bollywood dance class" website, the system maps to the "dance" stock category — which contains almost exclusively ballet photos. The AI generates a specific `heroImageQuery` (e.g., "bollywood dance class") but the stock path ignores it entirely, always preferring the category-based stock image.

## Solution

Switch hero image selection to a **Pexels API-first** strategy. Use the AI's `heroImageQuery` to search the Pexels photo API for a relevant hero image. Fall back to the existing stock/Unsplash system only if the API call fails.

**Priority order (hero only):**
1. Pexels API search using `heroImageQuery` → use `src.large` (max width 940px, height varies by aspect ratio)
2. Stock image category → existing fallback
3. Unsplash API → existing fallback
4. Gradient placeholder → final fallback

Gallery images remain unchanged (stock-first, as today).

## Architecture

### New File: `src/services/pexels/client.ts`

Thin wrapper around the Pexels search endpoint.

```
Endpoint:  GET https://api.pexels.com/v1/search
Auth:      Authorization header with bare API key (no prefix, unlike Unsplash's "Client-ID")
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
- Empty results or missing `src.large` URL → return `null`
- All failures logged via `console.warn` (matching Unsplash client pattern) but never throw

### Modified File: `src/services/unsplash/image-fetcher.ts`

Only `fetchTemplateImages()` changes. The Pexels call is inserted **at the very top** of the function, **before** the `hasStockImages()` branch, so it runs in all environments (dev and production).

```
1. Extract heroQuery from config.content.heroImageQuery || config.content.siteName || 'business'
2. Call searchPexelsHeroImage(heroQuery)
3. If Pexels returns a URL:
   - Set pexelsHeroUrl = result
   - Still run the existing stock/Unsplash path for gallery images
   - Override only the heroImageUrl in the returned TemplateImages with pexelsHeroUrl
4. If Pexels returns null:
   - Fall through to existing stock → Unsplash → gradient chain (unchanged behavior)
   - Both hero AND gallery come from the existing path as before
```

Key detail: even when Pexels succeeds for hero, the existing `fetchFromStockImages()` or `fetchFromUnsplashApi()` still runs to provide gallery images. We just override `heroImageUrl` in the result.

### Environment Variable

- **Key:** `PEXELS_API_KEY`
- **Where:** `.env.local` (local dev) + Vercel environment variables (production)
- **Not hardcoded** in source code

## Image Size Choice

Using `src.large` from Pexels responses. Max width is 940px; height varies based on original photo's aspect ratio (not a fixed 650px). With `orientation=landscape`, photos will be wider than tall.

| Size | Max Dimensions | Decision |
|------|---------------|----------|
| `original` | Varies, potentially huge | Too heavy |
| `large2x` | 1880px wide | Full HD, unnecessarily large |
| `large` | 940px wide | **Selected** — good balance of quality/size for hero banners |
| `medium` | 350px tall | Too small for full-width hero backgrounds |

## Pexels License & Attribution

Pexels photos are free to use with no attribution required (unlike Unsplash). Their license allows use for any purpose including commercial. No photographer credit needs to be stored or displayed.

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
3. Remove `PEXELS_API_KEY` env var → should gracefully fall back to stock images (no crash)
4. Verify gallery images are still stock-based (unchanged) even when Pexels hero succeeds
5. Empty/undefined `heroImageQuery` → should fall back to `siteName` then `'business'`
6. Pexels returns result but `src.large` is missing → should return null, fall back to stock
