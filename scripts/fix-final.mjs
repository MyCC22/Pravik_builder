#!/usr/bin/env node

/**
 * Fix the last 2 low-count categories: law and bar.
 * Uses multiple alternative queries to maximize results.
 */

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY
if (!ACCESS_KEY) { console.error('Missing UNSPLASH_ACCESS_KEY'); process.exit(1) }

const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function fetchImages(query) {
  const params = new URLSearchParams({ query, per_page: '30', orientation: 'landscape' })
  const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
    headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
  })
  const remaining = res.headers.get('x-ratelimit-remaining')
  console.log(`  Rate limit remaining: ${remaining}`)
  if (!res.ok) { console.error(`  Error: ${res.status}`); return [] }
  const data = await res.json()
  return (data.results || []).map(p => ({
    regular: p.urls.regular, small: p.urls.small,
    alt: p.alt_description || query,
    photographer: p.user.name, photographerUrl: p.user.links.html,
  }))
}

function dedup(images) {
  const seen = new Set()
  return images.filter(img => {
    if (seen.has(img.regular)) return false
    seen.add(img.regular)
    return true
  })
}

async function main() {
  const fs = await import('fs')
  const path = await import('path')
  const outPath = path.join(process.cwd(), 'src/services/unsplash/stock-images.ts')

  // For "law": try multiple queries and combine (dedup)
  console.log('=== Fixing: law ===')
  const lawQueries = [
    'professional business office corporate',
    'boardroom meeting corporate executive',
    'professional desk office books',
  ]
  let lawImages = []
  for (const q of lawQueries) {
    console.log(`  Query: "${q}"`)
    const imgs = await fetchImages(q)
    console.log(`  Got ${imgs.length} images`)
    lawImages.push(...imgs)
    await delay(1500)
  }
  lawImages = dedup(lawImages).slice(0, 30)
  console.log(`  Total unique law images: ${lawImages.length}`)

  // For "bar": retry the original query
  console.log('\n=== Fixing: bar ===')
  console.log('  Query: "bar pub cocktail drinks nightlife"')
  const barImages = await fetchImages('bar pub cocktail drinks nightlife')
  console.log(`  Got ${barImages.length} images`)

  // Patch the file
  let content = fs.readFileSync(outPath, 'utf8')

  function patchCategory(content, catId, keywords, images) {
    let block = `  '${catId}': {\n`
    block += `    keywords: ${JSON.stringify(keywords)},\n`
    block += `    images: [\n`
    for (const img of images) {
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

    const catRegex = new RegExp(`  '${catId}':\\s*\\{[\\s\\S]*?\\],\\n  \\},`, 'm')
    if (catRegex.test(content)) {
      return content.replace(catRegex, block)
    }
    return content
  }

  if (lawImages.length > 0) {
    content = patchCategory(content, 'law', ['law', 'attorney', 'lawyer', 'legal', 'law firm'], lawImages)
    console.log(`\nPatched law: ${lawImages.length} images`)
  }
  if (barImages.length > 0) {
    content = patchCategory(content, 'bar', ['bar', 'cocktail', 'pub', 'nightlife', 'brewery', 'wine bar'], barImages)
    console.log(`Patched bar: ${barImages.length} images`)
  }

  fs.writeFileSync(outPath, content)
  const totalImages = (content.match(/regular:/g) || []).length
  console.log(`\nTotal images: ${totalImages}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
