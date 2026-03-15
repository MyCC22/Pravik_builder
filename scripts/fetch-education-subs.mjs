#!/usr/bin/env node

/**
 * Fetch 10 education sub-categories with 15 images each.
 * Appends them to stock-images.ts alongside the existing 'education' category.
 */

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY
if (!ACCESS_KEY) { console.error('Missing UNSPLASH_ACCESS_KEY'); process.exit(1) }

const delay = (ms) => new Promise(r => setTimeout(r, ms))

const SUBCATEGORIES = [
  {
    id: 'kids-bootcamp',
    query: 'kids camp children outdoor activities group',
    keywords: ['kids bootcamp', 'kids camp', 'children camp', 'summer camp', 'youth program'],
  },
  {
    id: 'kids-coding',
    query: 'children coding computer programming classroom',
    keywords: ['kids coding', 'coding for kids', 'children programming', 'kids tech', 'stem kids'],
  },
  {
    id: 'adult-certification',
    query: 'adult education certification professional training classroom',
    keywords: ['adult certification', 'professional certification', 'adult learning', 'continuing education', 'certification course'],
  },
  {
    id: 'medical-school',
    query: 'medical school students anatomy lab healthcare education',
    keywords: ['medical school', 'med school', 'medical education', 'medical student', 'pre-med'],
  },
  {
    id: 'nursing-school',
    query: 'nursing student hospital clinical training healthcare',
    keywords: ['nursing school', 'nursing program', 'nursing student', 'nursing education', 'rn program'],
  },
  {
    id: 'tutoring',
    query: 'tutor student one-on-one learning homework help',
    keywords: ['tutoring', 'tutor', 'private tutor', 'homework help', 'academic tutoring'],
  },
  {
    id: 'music-lessons',
    query: 'music lesson piano guitar teacher student instrument',
    keywords: ['music lessons', 'piano lessons', 'guitar lessons', 'music teacher', 'music school'],
  },
  {
    id: 'language-school',
    query: 'language class foreign language learning classroom students',
    keywords: ['language school', 'language class', 'esl', 'foreign language', 'language learning'],
  },
  {
    id: 'driving-school',
    query: 'driving school student car instructor learning drive',
    keywords: ['driving school', 'driving lessons', 'driving instructor', 'learn to drive', 'drivers ed'],
  },
  {
    id: 'test-prep',
    query: 'student studying exam preparation books library university',
    keywords: ['test prep', 'sat prep', 'exam preparation', 'college prep', 'study group'],
  },
]

async function fetchImages(query) {
  const params = new URLSearchParams({ query, per_page: '15', orientation: 'landscape' })
  const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
    headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
  })
  const remaining = res.headers.get('x-ratelimit-remaining')
  console.log(`  Rate limit remaining: ${remaining}`)
  if (!res.ok) {
    console.error(`  Error: ${res.status}`)
    if (res.status === 403 || remaining === '0') {
      console.log('  Waiting 120s for rate limit...')
      await delay(120000)
      const retry = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
        headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
      })
      if (!retry.ok) { console.error(`  Retry failed: ${retry.status}`); return [] }
      const retryData = await retry.json()
      return (retryData.results || []).map(p => ({
        regular: p.urls.regular, small: p.urls.small,
        alt: p.alt_description || query,
        photographer: p.user.name, photographerUrl: p.user.links.html,
      }))
    }
    return []
  }
  const data = await res.json()
  return (data.results || []).map(p => ({
    regular: p.urls.regular, small: p.urls.small,
    alt: p.alt_description || query,
    photographer: p.user.name, photographerUrl: p.user.links.html,
  }))
}

async function main() {
  const fs = await import('fs')
  const path = await import('path')
  const outPath = path.join(process.cwd(), 'src/services/unsplash/stock-images.ts')

  console.log(`Fetching ${SUBCATEGORIES.length} education sub-categories (15 images each)...\n`)

  const results = {}

  for (let i = 0; i < SUBCATEGORIES.length; i++) {
    const sub = SUBCATEGORIES[i]
    console.log(`[${i + 1}/${SUBCATEGORIES.length}] ${sub.id} ("${sub.query}")`)
    const images = await fetchImages(sub.query)
    console.log(`  Got ${images.length} images`)
    if (images.length > 0) {
      results[sub.id] = { keywords: sub.keywords, images }
    }
    if (i < SUBCATEGORIES.length - 1) await delay(1500)
  }

  // Read existing file and insert new categories after 'education'
  let content = fs.readFileSync(outPath, 'utf8')

  for (const [catId, catData] of Object.entries(results)) {
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

    // Check if already exists
    const catRegex = new RegExp(`  '${catId}':\\s*\\{[\\s\\S]*?\\],\\n  \\},`, 'm')
    if (catRegex.test(content)) {
      content = content.replace(catRegex, block)
      console.log(`  Updated existing: ${catId}`)
    } else {
      // Insert after 'education' block
      const eduEndRegex = /('education':\s*\{[\s\S]*?\],\n  \},)/m
      const eduMatch = content.match(eduEndRegex)
      if (eduMatch) {
        const insertIdx = content.indexOf(eduMatch[0]) + eduMatch[0].length
        content = content.slice(0, insertIdx) + '\n' + block + content.slice(insertIdx)
        console.log(`  Inserted: ${catId}`)
      }
    }
  }

  // Update the CATEGORY_IDS array
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
  const totalCats = allCatIds.length
  console.log(`\nDone! Added ${Object.keys(results).length} education sub-categories`)
  console.log(`Total categories: ${totalCats}`)
  console.log(`Total images: ${totalImages}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
