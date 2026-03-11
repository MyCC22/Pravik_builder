import type { CrawlResult } from './firecrawl'

export interface ExtractedContent {
  siteName: string
  tagline?: string
  heroTitle?: string
  heroSubtitle?: string
  services?: { title: string; description: string }[]
  features?: { title: string; description: string }[]
  testimonials?: { quote: string; name: string; role?: string }[]
  team?: { name: string; role: string; bio?: string }[]
  faq?: { question: string; answer: string }[]
  pricing?: { plan: string; price: string; features: string[] }[]
  menuItems?: { category: string; items: { name: string; price: string; description?: string }[] }[]
  email?: string
  phone?: string
  address?: string
  hours?: { day: string; hours: string }[]
  rawMarkdown: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find a section in markdown by matching a heading against the given keywords.
 * Returns the text from that heading up to (but not including) the next heading
 * of the same or higher level, or end of string.
 */
function findSection(markdown: string, keywords: string[]): string | null {
  const lines = markdown.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (!headingMatch) continue

    const level = headingMatch[1].length
    const headingText = headingMatch[2].toLowerCase()

    const matched = keywords.some((kw) => headingText.includes(kw.toLowerCase()))
    if (!matched) continue

    const sectionLines: string[] = [line]
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j]
      const nextHeading = nextLine.match(/^(#{1,6})\s+/)
      if (nextHeading && nextHeading[1].length <= level) break
      sectionLines.push(nextLine)
    }

    return sectionLines.join('\n')
  }

  return null
}

/** Extract all sub-headings (## or ###) within a section as {heading, body} pairs. */
function extractSubsections(
  section: string
): { heading: string; body: string }[] {
  const lines = section.split('\n')
  const results: { heading: string; body: string }[] = []

  let current: { heading: string; bodyLines: string[] } | null = null

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const headingMatch = line.match(/^#{2,6}\s+(.+)$/)
    if (headingMatch) {
      if (current) {
        results.push({ heading: current.heading, body: current.bodyLines.join('\n').trim() })
      }
      current = { heading: headingMatch[1].trim(), bodyLines: [] }
    } else if (current) {
      current.bodyLines.push(line)
    }
  }

  if (current) {
    results.push({ heading: current.heading, body: current.bodyLines.join('\n').trim() })
  }

  return results
}

/** Get non-empty lines from a block of text. */
function nonEmptyLines(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean)
}

/** Strip leading markdown list/bullet characters from a line. */
function stripBullet(line: string): string {
  return line.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '').trim()
}

// ---------------------------------------------------------------------------
// Section parsers
// ---------------------------------------------------------------------------

function extractServices(
  markdown: string
): { title: string; description: string }[] | undefined {
  const section = findSection(markdown, ['services', 'what we offer', 'our services', 'what we do'])
  if (!section) return undefined

  const subsections = extractSubsections(section)
  if (subsections.length > 0) {
    return subsections.map(({ heading, body }) => ({
      title: heading,
      description: nonEmptyLines(body).join(' '),
    }))
  }

  const bullets = nonEmptyLines(section)
    .slice(1)
    .filter((l) => /^[-*+]/.test(l))
    .map((l) => ({ title: stripBullet(l), description: '' }))

  return bullets.length > 0 ? bullets : undefined
}

function extractFeatures(
  markdown: string
): { title: string; description: string }[] | undefined {
  const section = findSection(markdown, ['features', 'why choose', 'benefits'])
  if (!section) return undefined

  const subsections = extractSubsections(section)
  if (subsections.length > 0) {
    return subsections.map(({ heading, body }) => ({
      title: heading,
      description: nonEmptyLines(body).join(' '),
    }))
  }

  const bullets = nonEmptyLines(section)
    .slice(1)
    .filter((l) => /^[-*+]/.test(l))
    .map((l) => {
      const text = stripBullet(l)
      const colonIdx = text.indexOf(':')
      if (colonIdx > 0 && colonIdx < 60) {
        return {
          title: text.slice(0, colonIdx).trim(),
          description: text.slice(colonIdx + 1).trim(),
        }
      }
      return { title: text, description: '' }
    })

  return bullets.length > 0 ? bullets : undefined
}

function extractTestimonials(
  markdown: string
): { quote: string; name: string; role?: string }[] | undefined {
  const section = findSection(markdown, ['testimonials', 'reviews', 'what people say', 'what our clients say'])
  if (!section) return undefined

  const results: { quote: string; name: string; role?: string }[] = []

  const blockquoteRegex = />\s*["""](.+?)["""]\s*[\r\n]+\s*[-\u2013\u2014]?\s*\*{0,2}([^,\n*]+)\*{0,2}(?:[,\s]+([^\n]+))?/g
  let match: RegExpExecArray | null
  while ((match = blockquoteRegex.exec(section)) !== null) {
    results.push({
      quote: match[1].trim(),
      name: match[2].trim(),
      role: match[3]?.trim(),
    })
  }

  if (results.length > 0) return results

  const lines = section.split('\n').map((l) => l.trim()).filter(Boolean)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const quoteMatch = line.match(/^["""](.+)["""]$/)
    if (!quoteMatch) continue
    const quote = quoteMatch[1].trim()

    const attribution = lines[i + 1] || ''
    const attrMatch = attribution.match(/^[-\u2013\u2014]?\s*\*{0,2}([^,\n*]+)\*{0,2}(?:[,\s]+(.+))?$/)
    if (attrMatch) {
      results.push({ quote, name: attrMatch[1].trim(), role: attrMatch[2]?.trim() })
      i++
    } else {
      results.push({ quote, name: '' })
    }
  }

  return results.length > 0 ? results : undefined
}

function extractFAQ(
  markdown: string
): { question: string; answer: string }[] | undefined {
  const section = findSection(markdown, ['faq', 'frequently asked', 'common questions'])
  if (!section) return undefined

  const results: { question: string; answer: string }[] = []

  const subsections = extractSubsections(section)
  for (const { heading, body } of subsections) {
    if (heading.includes('?') || /^(what|how|why|when|where|who|can|do|is|are|will|does)/i.test(heading)) {
      results.push({ question: heading, answer: nonEmptyLines(body).join(' ') })
    }
  }

  if (results.length > 0) return results

  const boldQRegex = /\*\*([^*]+\?)\*\*\s*[\r\n]+([^\n*#]+)/g
  while ((match = boldQRegex.exec(section)) !== null) {
    results.push({ question: match[1].trim(), answer: match[2].trim() })
  }

  return results.length > 0 ? results : undefined
}

function extractTeam(
  markdown: string
): { name: string; role: string; bio?: string }[] | undefined {
  const section = findSection(markdown, ['team', 'meet the team', 'our team', 'about us'])
  if (!section) return undefined

  const subsections = extractSubsections(section)
  if (subsections.length === 0) return undefined

  return subsections
    .map(({ heading, body }) => {
      const lines = nonEmptyLines(body)
      const role = lines[0] || ''
      const bio = lines.slice(1).join(' ') || undefined
      return { name: heading, role, bio }
    })
    .filter((m) => m.name.length > 0)
}

function extractPricing(
  markdown: string
): { plan: string; price: string; features: string[] }[] | undefined {
  const section = findSection(markdown, ['pricing', 'plans', 'packages'])
  if (!section) return undefined

  const subsections = extractSubsections(section)
  const results: { plan: string; price: string; features: string[] }[] = []

  for (const { heading, body } of subsections) {
    const priceMatch = body.match(/\$[\d,]+(?:\.\d{2})?(?:\s*\/\s*(?:mo(?:nth)?|yr|year|week))?/)
    if (!priceMatch) continue

    const bulletFeatures = nonEmptyLines(body)
      .filter((l) => /^[-*+]/.test(l))
      .map(stripBullet)

    results.push({
      plan: heading,
      price: priceMatch[0].trim(),
      features: bulletFeatures,
    })
  }

  return results.length > 0 ? results : undefined
}

function extractMenu(
  markdown: string
): { category: string; items: { name: string; price: string; description?: string }[] }[] | undefined {
  const section = findSection(markdown, ['menu', 'our menu', 'food', 'drinks'])
  if (!section) return undefined

  const subsections = extractSubsections(section)
  if (subsections.length === 0) return undefined

  const results: {
    category: string
    items: { name: string; price: string; description?: string }[]
  }[] = []

  const itemPriceRegex = /\*{0,2}([^*\n$]+?)\*{0,2}\s*[.\u2026\s]*\s*(\$[\d.]+)/g

  for (const { heading, body } of subsections) {
    const items: { name: string; price: string; description?: string }[] = []
    let match: RegExpExecArray | null
    itemPriceRegex.lastIndex = 0
    while ((match = itemPriceRegex.exec(body)) !== null) {
      const name = match[1].trim().replace(/^[-*+]\s*/, '')
      const price = match[2].trim()
      if (name.length > 0) {
        items.push({ name, price })
      }
    }

    if (items.length === 0) {
      const lines = nonEmptyLines(body).filter((l) => /^[-*+]/.test(l))
      for (const line of lines) {
        const text = stripBullet(line)
        const inlinePriceMatch = text.match(/^(.+?)\s+(\$[\d.]+)\s*(.*)$/)
        if (inlinePriceMatch) {
          items.push({
            name: inlinePriceMatch[1].trim(),
            price: inlinePriceMatch[2].trim(),
            description: inlinePriceMatch[3].trim() || undefined,
          })
        }
      }
    }

    if (items.length > 0) {
      results.push({ category: heading, items })
    }
  }

  return results.length > 0 ? results : undefined
}

function extractHours(
  markdown: string
): { day: string; hours: string }[] | undefined {
  const section = findSection(markdown, ['hours', 'opening hours', 'business hours', 'open'])
  const searchText = section ?? markdown

  const results: { day: string; hours: string }[] = []

  const hoursRegex = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|weekday|weekdays|weekend|weekends|daily|everyday)\b[:\s\-\u2013]+([^\n,]+(?:am|pm|AM|PM|noon|closed)[^\n]*)/gi
  let match: RegExpExecArray | null
  while ((match = hoursRegex.exec(searchText)) !== null) {
    results.push({
      day: match[1].trim(),
      hours: match[2].trim(),
    })
  }

  const seen = new Set<string>()
  const deduped = results.filter(({ day }) => {
    const key = day.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return deduped.length > 0 ? deduped.slice(0, 14) : undefined
}

function extractEmail(markdown: string): string | undefined {
  const match = markdown.match(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/)
  return match?.[0]
}

function extractPhone(markdown: string): string | undefined {
  const match = markdown.match(
    /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/
  )
  return match?.[0]?.trim()
}

function extractAddress(markdown: string): string | undefined {
  const addressSection = findSection(markdown, ['address', 'location', 'find us', 'visit us', 'contact'])
  const searchText = addressSection ?? markdown

  const match = searchText.match(
    /\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Za-z]+){1,5},\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s*(?:[A-Z]{2}\s+\d{5})?/
  )
  return match?.[0]?.trim()
}

// ---------------------------------------------------------------------------
// Hero extraction
// ---------------------------------------------------------------------------

function extractHeroTitle(markdown: string): string | undefined {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match?.[1]?.trim()
}

function extractHeroSubtitle(markdown: string): string | undefined {
  const lines = markdown.split('\n')
  let foundH1 = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (!foundH1) {
      if (/^#\s+/.test(trimmed)) foundH1 = true
      continue
    }

    if (!trimmed) continue
    if (/^#{1,6}\s/.test(trimmed)) break
    if (/^[!<\[`]/.test(trimmed)) continue
    if (/^[-*+]\s/.test(trimmed)) continue

    const text = trimmed.replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1').replace(/`([^`]+)`/g, '$1')
    if (text.length > 10) return text
  }

  return undefined
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

// Forward-declare match variable for use across functions
// eslint-disable-next-line prefer-const
let match: RegExpExecArray | null

export function extractContent(crawl: CrawlResult): ExtractedContent {
  const { mainPage, pages } = crawl

  // siteName
  const siteName =
    mainPage.metadata?.title?.split(/[|\-\u2013\u2014]/)[0]?.trim() ||
    extractHeroTitle(mainPage.markdown) ||
    'Untitled Site'

  // tagline
  const tagline = mainPage.metadata?.description?.trim() || undefined

  // hero
  const heroTitle = extractHeroTitle(mainPage.markdown)
  const heroSubtitle = extractHeroSubtitle(mainPage.markdown)

  // rawMarkdown: join all pages, truncate to ~6000 chars
  const allMarkdown = pages.map((p) => p.markdown).join('\n\n---\n\n')
  const rawMarkdown = allMarkdown.length > 6000 ? allMarkdown.slice(0, 6000) : allMarkdown

  // contact info (search all pages combined)
  const email = extractEmail(allMarkdown)
  const phone = extractPhone(allMarkdown)
  const address = extractAddress(allMarkdown)

  // sections (search all pages combined)
  const services = extractServices(allMarkdown)
  const features = extractFeatures(allMarkdown)
  const testimonials = extractTestimonials(allMarkdown)
  const faq = extractFAQ(allMarkdown)
  const team = extractTeam(allMarkdown)
  const pricing = extractPricing(allMarkdown)
  const menuItems = extractMenu(allMarkdown)
  const hours = extractHours(allMarkdown)

  return {
    siteName,
    tagline,
    heroTitle,
    heroSubtitle,
    services,
    features,
    testimonials,
    team,
    faq,
    pricing,
    menuItems,
    email,
    phone,
    address,
    hours,
    rawMarkdown,
  }
}
