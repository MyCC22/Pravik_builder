#!/usr/bin/env node

/**
 * Fix kids-coding and adult-certification with better queries.
 */

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY
if (!ACCESS_KEY) { console.error('Missing UNSPLASH_ACCESS_KEY'); process.exit(1) }

const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function fetchImages(query, count = 15) {
  const params = new URLSearchParams({ query, per_page: String(count), orientation: 'landscape' })
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

  // kids-coding: try broader queries
  console.log('=== kids-coding ===')
  const kidsCodingQueries = [
    'kids computer laptop technology learning',
    'children tablet technology classroom stem',
    'young students computer lab school',
  ]
  let kidsImages = []
  for (const q of kidsCodingQueries) {
    console.log(`  Query: "${q}"`)
    const imgs = await fetchImages(q)
    console.log(`  Got ${imgs.length}`)
    kidsImages.push(...imgs)
    await delay(1500)
  }
  kidsImages = dedup(kidsImages).slice(0, 15)
  console.log(`  Total unique: ${kidsImages.length}`)

  // adult-certification: broader queries
  console.log('\n=== adult-certification ===')
  const adultQueries = [
    'professional training workshop seminar adult',
    'corporate training classroom presentation',
    'adult students classroom certificate diploma',
  ]
  let adultImages = []
  for (const q of adultQueries) {
    console.log(`  Query: "${q}"`)
    const imgs = await fetchImages(q)
    console.log(`  Got ${imgs.length}`)
    adultImages.push(...imgs)
    await delay(1500)
  }
  adultImages = dedup(adultImages).slice(0, 15)
  console.log(`  Total unique: ${adultImages.length}`)

  // Patch the file
  let content = fs.readFileSync(outPath, 'utf8')

  function buildBlock(catId, keywords, images) {
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
    return block
  }

  // For kids-coding: insert new (it wasn't inserted before since 0 results)
  if (kidsImages.length > 0) {
    const block = buildBlock('kids-coding',
      ['kids coding', 'coding for kids', 'children programming', 'kids tech', 'stem kids'],
      kidsImages)
    const catRegex = new RegExp(`  'kids-coding':\\s*\\{[\\s\\S]*?\\],\\n  \\},`, 'm')
    if (catRegex.test(content)) {
      content = content.replace(catRegex, block)
      console.log(`\nUpdated: kids-coding (${kidsImages.length} images)`)
    } else {
      // Insert after kids-bootcamp
      const afterRegex = /('kids-bootcamp':\s*\{[\s\S]*?\],\n  \},)/m
      const afterMatch = content.match(afterRegex)
      if (afterMatch) {
        const idx = content.indexOf(afterMatch[0]) + afterMatch[0].length
        content = content.slice(0, idx) + '\n' + block + content.slice(idx)
        console.log(`\nInserted: kids-coding (${kidsImages.length} images)`)
      }
    }
  }

  // For adult-certification: patch existing
  if (adultImages.length > 0) {
    const block = buildBlock('adult-certification',
      ['adult certification', 'professional certification', 'adult learning', 'continuing education', 'certification course'],
      adultImages)
    const catRegex = new RegExp(`  'adult-certification':\\s*\\{[\\s\\S]*?\\],\\n  \\},`, 'm')
    if (catRegex.test(content)) {
      content = content.replace(catRegex, block)
      console.log(`Updated: adult-certification (${adultImages.length} images)`)
    }
  }

  // Update CATEGORY_IDS
  const allCatIds = []
  const catIdRegex = /'([a-z-]+)':\s*\{/g
  let m
  while ((m = catIdRegex.exec(content)) !== null) {
    if (!allCatIds.includes(m[1])) allCatIds.push(m[1])
  }
  content = content.replace(
    /export const CATEGORY_IDS = \[.*?\] as const/s,
    `export const CATEGORY_IDS = ${JSON.stringify(allCatIds)} as const`
  )

  fs.writeFileSync(outPath, content)
  const totalImages = (content.match(/regular:/g) || []).length
  console.log(`\nTotal categories: ${allCatIds.length}`)
  console.log(`Total images: ${totalImages}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
