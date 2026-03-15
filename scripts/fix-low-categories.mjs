#!/usr/bin/env node

/**
 * Fix categories that got low image counts with improved queries.
 * Reads current stock-images.ts, patches in the new results, rewrites.
 */

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY
if (!ACCESS_KEY) {
  console.error('Missing UNSPLASH_ACCESS_KEY')
  process.exit(1)
}

const delay = (ms) => new Promise(r => setTimeout(r, ms))

// Improved queries for categories that returned <25 images
const FIXES = [
  { id: 'law', query: 'lawyer professional office boardroom', keywords: ['law', 'attorney', 'lawyer', 'legal', 'law firm'] },
  { id: 'landscaping', query: 'garden landscape lawn green outdoor', keywords: ['landscaping', 'garden', 'lawn', 'outdoor', 'yard'] },
  { id: 'moving', query: 'moving boxes truck delivery logistics', keywords: ['moving', 'relocation', 'movers', 'packing'] },
  { id: 'photography', query: 'photography studio camera creative portrait', keywords: ['photography', 'photographer', 'photo', 'portrait'] },
  { id: 'tech', query: 'technology office computer startup modern', keywords: ['tech', 'startup', 'saas', 'software', 'app', 'technology'] },
  { id: 'marketing', query: 'digital marketing social media creative team', keywords: ['marketing', 'advertising', 'branding', 'agency'] },
  { id: 'bar', query: 'bar pub cocktail drinks nightlife', keywords: ['bar', 'cocktail', 'pub', 'nightlife', 'brewery', 'wine bar'] },
]

async function fetchImages(query) {
  const params = new URLSearchParams({
    query,
    per_page: '30',
    orientation: 'landscape',
  })
  const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
    headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
  })
  if (!res.ok) {
    const remaining = res.headers.get('x-ratelimit-remaining')
    console.error(`  Error: ${res.status} (remaining: ${remaining})`)
    return []
  }
  const data = await res.json()
  return (data.results || []).map(photo => ({
    regular: photo.urls.regular,
    small: photo.urls.small,
    alt: photo.alt_description || query,
    photographer: photo.user.name,
    photographerUrl: photo.user.links.html,
  }))
}

async function main() {
  const fs = await import('fs')
  const path = await import('path')
  const outPath = path.join(process.cwd(), 'src/services/unsplash/stock-images.ts')

  // Read the current file and parse it (we'll use dynamic import)
  // We need to parse the TS file to extract existing data.
  // Simpler approach: fetch new images and rebuild the patched categories in memory.

  console.log(`Fixing ${FIXES.length} low-count categories...\n`)

  const patches = {}

  for (let i = 0; i < FIXES.length; i++) {
    const fix = FIXES[i]
    console.log(`[${i + 1}/${FIXES.length}] Fetching: ${fix.id} ("${fix.query}")`)
    const images = await fetchImages(fix.query)
    console.log(`  Got ${images.length} images`)

    if (images.length > 0) {
      patches[fix.id] = { keywords: fix.keywords, images }
    }

    if (i < FIXES.length - 1) await delay(1500)
  }

  // Now read the existing TS file and patch categories
  let content = fs.readFileSync(outPath, 'utf8')

  for (const [catId, catData] of Object.entries(patches)) {
    // Build replacement block
    let block = `  '${catId}': {\n`
    block += `    keywords: ${JSON.stringify(catData.keywords)},\n`
    block += `    images: [\n`
    for (const img of catData.images) {
      block += `      {\n`
      block += `        regular: '${img.regular}',\n`
      block += `        small: '${img.small}',\n`
      block += `        alt: ${JSON.stringify(img.alt)},\n`
      block += `        photographer: ${JSON.stringify(img.photographer)},\n`
      block += `        photographerUrl: '${img.photographerUrl}',\n`
      block += `      },\n`
    }
    block += `    ],\n`
    block += `  },`

    // Find and replace the existing category block, or insert if missing
    const catRegex = new RegExp(`  '${catId}':\\s*\\{[\\s\\S]*?\\],\\n  \\},`, 'm')
    if (catRegex.test(content)) {
      content = content.replace(catRegex, block)
      console.log(`  Patched: ${catId} (${catData.images.length} images)`)
    } else {
      // Insert before the closing }
      const insertPoint = content.lastIndexOf('}')
      // Find the last category entry
      const lastCatEnd = content.lastIndexOf('  },')
      if (lastCatEnd > 0) {
        content = content.slice(0, lastCatEnd + 4) + '\n' + block + '\n' + content.slice(lastCatEnd + 4)
        console.log(`  Inserted: ${catId} (${catData.images.length} images)`)
      }
    }
  }

  fs.writeFileSync(outPath, content)
  console.log(`\nDone! File updated at ${outPath}`)

  // Count total images
  const totalImages = (content.match(/regular:/g) || []).length
  console.log(`Total images: ${totalImages}`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
