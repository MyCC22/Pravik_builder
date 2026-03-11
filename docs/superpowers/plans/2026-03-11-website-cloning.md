# Website Cloning Feature — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "clone website" feature that scrapes an existing site via Firecrawl, optionally analyzes its visual style via Claude Vision, and rebuilds it using the existing template system with fresh Unsplash images.

**Architecture:** User sends "clone example.com" → Router detects URL → Firecrawl crawls site (markdown + screenshot) → Code extracts structured content → Claude Vision analyzes screenshot (optional) → Clone generator AI produces TemplateConfig → Existing pipeline renders blocks + fetches images + creates booking tool.

**Tech Stack:** Firecrawl API (web scraping), Anthropic Claude (vision + text), existing template/block/Unsplash pipeline.

---

## File Structure

### New files
```
src/services/scraper/firecrawl.ts         # Firecrawl API client — crawl and scrape
src/services/scraper/extractor.ts         # Markdown → structured ExtractedContent
src/services/scraper/visual-analyzer.ts   # Screenshot → VisualAnalysis via Claude Vision
src/services/scraper/clone-generator.ts   # ExtractedContent + VisualAnalysis → TemplateConfig
```

### Modified files
```
src/services/agents/types.ts              # Add 'clone_site' intent + RouterResult.clone_mode
src/services/agents/prompts/router.ts     # Add clone_site routing rules
src/services/agents/orchestrator.ts       # Add clone_site case
src/services/agents/generator.ts          # Extract renderAndStoreBlocks helper
```

Each file has one clear responsibility. The scraper directory mirrors the existing `unsplash/` and `agents/` service directories.

---

## Chunk 1: Firecrawl Client + Content Extractor

### Task 1: Create Firecrawl Client

**Files:**
- Create: `src/services/scraper/firecrawl.ts`

This file wraps the Firecrawl API. Two functions: `scrapePage` (single page + screenshot) and `crawlSite` (homepage + inner pages).

- [ ] **Step 1: Create `src/services/scraper/firecrawl.ts`**

```typescript
// src/services/scraper/firecrawl.ts

const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v1'
const CRAWL_TIMEOUT_MS = 30000 // 30s max wait for crawl completion
const POLL_INTERVAL_MS = 2000  // Check every 2s

export interface ScrapeResult {
  url: string
  markdown: string
  metadata: {
    title: string
    description: string
    ogImage?: string
  }
  screenshot?: string // base64 PNG
}

export interface CrawlResult {
  pages: ScrapeResult[]
  mainPage: ScrapeResult
}

function getApiKey(): string | null {
  return process.env.FIRECRAWL_API_KEY || null
}

/**
 * Scrape a single page. Returns markdown + optional screenshot.
 * Used for the homepage (with screenshot for visual analysis).
 */
export async function scrapePage(
  url: string,
  options: { screenshot?: boolean } = {}
): Promise<ScrapeResult | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.error('FIRECRAWL_API_KEY not set')
    return null
  }

  try {
    const formats = options.screenshot
      ? ['markdown', 'screenshot']
      : ['markdown']

    const response = await fetch(`${FIRECRAWL_BASE_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ url, formats }),
    })

    if (!response.ok) {
      console.error(
        `Firecrawl scrape failed: ${response.status} ${response.statusText}`
      )
      return null
    }

    const data = await response.json()

    if (!data.success || !data.data) {
      console.error('Firecrawl scrape returned no data')
      return null
    }

    const page = data.data
    return {
      url: page.url || url,
      markdown: page.markdown || '',
      metadata: {
        title: page.metadata?.title || '',
        description: page.metadata?.description || '',
        ogImage: page.metadata?.ogImage || undefined,
      },
      screenshot: page.screenshot || undefined,
    }
  } catch (error) {
    console.error('Firecrawl scrape error:', error)
    return null
  }
}

/**
 * Crawl a site: homepage + up to 4 inner pages.
 * Uses the async crawl API with polling.
 * Falls back to single-page scrape if crawl fails.
 */
export async function crawlSite(url: string): Promise<CrawlResult | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.error('FIRECRAWL_API_KEY not set')
    return null
  }

  // First, scrape the homepage with a screenshot (for visual analysis)
  const mainPage = await scrapePage(url, { screenshot: true })
  if (!mainPage) return null

  // Then crawl for inner pages (no screenshots needed)
  try {
    const response = await fetch(`${FIRECRAWL_BASE_URL}/crawl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        limit: 5, // Homepage + up to 4 inner pages
        scrapeOptions: { formats: ['markdown'] },
      }),
    })

    if (!response.ok) {
      // Crawl failed — return homepage only
      console.error(`Firecrawl crawl failed: ${response.status}`)
      return { pages: [mainPage], mainPage }
    }

    const crawlData = await response.json()

    if (!crawlData.success || !crawlData.id) {
      return { pages: [mainPage], mainPage }
    }

    // Poll for crawl completion
    const crawlId = crawlData.id
    const startTime = Date.now()

    while (Date.now() - startTime < CRAWL_TIMEOUT_MS) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))

      const statusResponse = await fetch(
        `${FIRECRAWL_BASE_URL}/crawl/${crawlId}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      )

      if (!statusResponse.ok) break

      const statusData = await statusResponse.json()

      if (statusData.status === 'completed' && statusData.data) {
        const innerPages: ScrapeResult[] = statusData.data
          .filter(
            (page: Record<string, unknown>) =>
              (page.url || (page.metadata as Record<string, unknown>)?.sourceURL) !== url
          )
          .slice(0, 4)
          .map((page: Record<string, unknown>) => ({
            url: (page.url ||
              (page.metadata as Record<string, unknown>)?.sourceURL ||
              '') as string,
            markdown: (page.markdown || '') as string,
            metadata: {
              title: (
                (page.metadata as Record<string, unknown>)?.title || ''
              ) as string,
              description: (
                (page.metadata as Record<string, unknown>)?.description || ''
              ) as string,
            },
          }))

        return {
          pages: [mainPage, ...innerPages],
          mainPage,
        }
      }

      if (statusData.status === 'failed') break
    }

    // Timeout or failure — return homepage only
    return { pages: [mainPage], mainPage }
  } catch (error) {
    console.error('Firecrawl crawl error:', error)
    return { pages: [mainPage], mainPage }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/tarun/Desktop/Pravik_Builder && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `scraper/firecrawl.ts`

- [ ] **Step 3: Commit**

```bash
git add src/services/scraper/firecrawl.ts
git commit -m "feat: add Firecrawl API client for website scraping"
```

---

### Task 2: Create Content Extractor

**Files:**
- Create: `src/services/scraper/extractor.ts`

Parses Firecrawl markdown output into structured content fields that match the existing TemplateContent schema. Uses regex and markdown structure analysis — no AI needed for this step.

- [ ] **Step 1: Create `src/services/scraper/extractor.ts`**

```typescript
// src/services/scraper/extractor.ts

import type { CrawlResult } from './firecrawl'

export interface ExtractedContent {
  // Core
  siteName: string
  tagline?: string
  heroTitle?: string
  heroSubtitle?: string

  // Sections
  services?: { title: string; description: string }[]
  features?: { title: string; description: string }[]
  testimonials?: { quote: string; name: string; role?: string }[]
  team?: { name: string; role: string; bio?: string }[]
  faq?: { question: string; answer: string }[]
  pricing?: { plan: string; price: string; features: string[] }[]
  menuItems?: {
    category: string
    items: { name: string; price: string; description?: string }[]
  }[]

  // Contact
  email?: string
  phone?: string
  address?: string
  hours?: { day: string; hours: string }[]

  // Raw fallback for AI
  rawMarkdown: string
}

/**
 * Extract structured content from crawled pages.
 * Strategy: parse markdown headings, lists, and patterns programmatically.
 * The AI clone generator will fill gaps from rawMarkdown.
 */
export function extractContent(crawl: CrawlResult): ExtractedContent {
  const mainMarkdown = crawl.mainPage.markdown
  const allMarkdown = crawl.pages.map(p => p.markdown).join('\n\n---\n\n')

  // Truncate rawMarkdown to ~6000 chars for the AI prompt
  const rawMarkdown =
    allMarkdown.length > 6000
      ? allMarkdown.slice(0, 6000) + '\n\n[...truncated]'
      : allMarkdown

  const result: ExtractedContent = {
    siteName:
      crawl.mainPage.metadata.title || extractSiteName(mainMarkdown),
    rawMarkdown,
  }

  // Extract hero content (usually the first heading + text)
  const heroMatch = mainMarkdown.match(/^#\s+(.+)/m)
  if (heroMatch) {
    result.heroTitle = heroMatch[1].trim()
  }

  // Look for tagline/subtitle after the first heading
  const lines = mainMarkdown.split('\n')
  const firstHeadingIndex = lines.findIndex(l => /^#\s/.test(l))
  if (firstHeadingIndex >= 0 && firstHeadingIndex < lines.length - 1) {
    for (
      let i = firstHeadingIndex + 1;
      i < Math.min(firstHeadingIndex + 5, lines.length);
      i++
    ) {
      const line = lines[i].trim()
      if (
        line &&
        !line.startsWith('#') &&
        !line.startsWith('*') &&
        !line.startsWith('-')
      ) {
        result.heroSubtitle = line
        break
      }
    }
  }

  // Extract tagline from meta description
  if (crawl.mainPage.metadata.description) {
    result.tagline = crawl.mainPage.metadata.description
  }

  // Extract sections by heading patterns
  result.services = extractListSection(allMarkdown, [
    'services',
    'what we offer',
    'our services',
    'what we do',
  ])
  result.features = extractListSection(allMarkdown, [
    'features',
    'why choose',
    'benefits',
    'what makes us',
  ])
  result.testimonials = extractTestimonials(allMarkdown)
  result.faq = extractFAQ(allMarkdown)
  result.team = extractTeam(allMarkdown)
  result.pricing = extractPricing(allMarkdown)
  result.menuItems = extractMenu(allMarkdown)
  result.hours = extractHours(allMarkdown)

  // Extract contact info with regex
  result.email = extractEmail(allMarkdown)
  result.phone = extractPhone(allMarkdown)
  result.address = extractAddress(allMarkdown)

  return result
}

// --- Helper extraction functions ---

function extractSiteName(markdown: string): string {
  const h1 = markdown.match(/^#\s+(.+)/m)
  if (h1) return h1[1].trim()
  const firstLine = markdown.split('\n').find(l => l.trim())
  return firstLine?.trim() || 'My Website'
}

/**
 * Find a section by heading keywords, then extract items below it.
 * Returns array of {title, description} from bullet points or sub-headings.
 */
function extractListSection(
  markdown: string,
  headingKeywords: string[]
): { title: string; description: string }[] | undefined {
  const section = findSection(markdown, headingKeywords)
  if (!section) return undefined

  const items: { title: string; description: string }[] = []

  // Look for sub-headings (### Title)
  const subHeadingPattern = /^###\s+(.+)/gm
  let match
  while ((match = subHeadingPattern.exec(section)) !== null) {
    const title = match[1].trim()
    const afterHeading = section.slice(match.index + match[0].length)
    const nextHeading = afterHeading.search(/^#{1,3}\s/m)
    const descText =
      nextHeading > 0
        ? afterHeading.slice(0, nextHeading)
        : afterHeading.slice(0, 200)
    const description =
      descText.replace(/^[\s\n]+/, '').split('\n')[0]?.trim() || ''
    if (title) items.push({ title, description })
  }

  // If no sub-headings, try bullet points
  if (items.length === 0) {
    const bulletPattern = /^[-*]\s+\**(.+?)\**(?:\s*[-:]\s*(.+))?$/gm
    while ((match = bulletPattern.exec(section)) !== null) {
      const title = match[1].replace(/\*+/g, '').trim()
      const description = match[2]?.trim() || ''
      if (title) items.push({ title, description })
    }
  }

  return items.length > 0 ? items : undefined
}

function extractTestimonials(
  markdown: string
): { quote: string; name: string; role?: string }[] | undefined {
  const section = findSection(markdown, [
    'testimonials',
    'what people say',
    'reviews',
    'what our',
    'client stories',
  ])
  if (!section) return undefined

  const testimonials: { quote: string; name: string; role?: string }[] = []

  // Pattern: quoted text followed by attribution
  const quotePattern = /[""\u201C](.+?)[""\u201D]\s*[-\u2013\u2014]\s*(.+?)(?:\n|$)/g
  let match
  while ((match = quotePattern.exec(section)) !== null) {
    const quote = match[1].trim()
    const attribution = match[2].trim()
    const [name, ...roleParts] = attribution.split(',')
    testimonials.push({
      quote,
      name: name.trim(),
      role: roleParts.length > 0 ? roleParts.join(',').trim() : undefined,
    })
  }

  // Fallback: look for blockquotes
  if (testimonials.length === 0) {
    const blockquotePattern =
      /^>\s+(.+)\n+(?:[-\u2013\u2014*]\s*)?(.+?)(?:\n|$)/gm
    while ((match = blockquotePattern.exec(section)) !== null) {
      testimonials.push({
        quote: match[1].trim(),
        name: match[2].replace(/^[-\u2013\u2014*\s]+/, '').trim(),
      })
    }
  }

  return testimonials.length > 0 ? testimonials : undefined
}

function extractFAQ(
  markdown: string
): { question: string; answer: string }[] | undefined {
  const section = findSection(markdown, [
    'faq',
    'frequently asked',
    'questions',
  ])
  if (!section) return undefined

  const faqs: { question: string; answer: string }[] = []

  // Pattern: heading-style questions
  const questionPattern = /^###?\s+(.+\?)\s*\n+([\s\S]*?)(?=\n###?\s|\n*$)/gm
  let match
  while ((match = questionPattern.exec(section)) !== null) {
    faqs.push({
      question: match[1].trim(),
      answer: match[2].trim().split('\n')[0] || '',
    })
  }

  // Fallback: bold questions
  if (faqs.length === 0) {
    const boldPattern = /\*\*(.+?\?)\*\*\s*\n+([\s\S]*?)(?=\*\*|\n*$)/gm
    while ((match = boldPattern.exec(section)) !== null) {
      faqs.push({
        question: match[1].trim(),
        answer: match[2].trim().split('\n')[0] || '',
      })
    }
  }

  return faqs.length > 0 ? faqs : undefined
}

function extractTeam(
  markdown: string
): { name: string; role: string; bio?: string }[] | undefined {
  const section = findSection(markdown, [
    'team',
    'meet the team',
    'our team',
    'about us',
  ])
  if (!section) return undefined

  const team: { name: string; role: string; bio?: string }[] = []
  const memberPattern =
    /^###?\s+(.+)\s*\n+(?:\*(.+?)\*|(.+?))\s*\n*([\s\S]*?)(?=\n###?\s|\n*$)/gm
  let match
  while ((match = memberPattern.exec(section)) !== null) {
    team.push({
      name: match[1].trim(),
      role: (match[2] || match[3] || '').trim(),
      bio: match[4]?.trim().split('\n')[0] || undefined,
    })
  }

  return team.length > 0 ? team : undefined
}

function extractPricing(
  markdown: string
): { plan: string; price: string; features: string[] }[] | undefined {
  const section = findSection(markdown, [
    'pricing',
    'plans',
    'packages',
    'rates',
  ])
  if (!section) return undefined

  const plans: { plan: string; price: string; features: string[] }[] = []

  const planPattern =
    /^###?\s+(.+)\s*\n+([\s\S]*?)(?=\n###?\s|\n*$)/gm
  let match
  while ((match = planPattern.exec(section)) !== null) {
    const planName = match[1].trim()
    const content = match[2]

    const priceMatch = content.match(/\$[\d,.]+(?:\/\w+)?/)
    const price = priceMatch ? priceMatch[0] : ''

    const features: string[] = []
    const bulletPattern = /^[-*\u2713\u2714]\s+(.+)/gm
    let bulletMatch
    while ((bulletMatch = bulletPattern.exec(content)) !== null) {
      features.push(bulletMatch[1].trim())
    }

    if (planName && (price || features.length > 0)) {
      plans.push({ plan: planName, price, features })
    }
  }

  return plans.length > 0 ? plans : undefined
}

function extractMenu(
  markdown: string
): {
  category: string
  items: { name: string; price: string; description?: string }[]
}[] | undefined {
  const section = findSection(markdown, [
    'menu',
    'our menu',
    'food',
    'dishes',
  ])
  if (!section) return undefined

  const categories: {
    category: string
    items: { name: string; price: string; description?: string }[]
  }[] = []

  const categoryPattern =
    /^###?\s+(.+)\s*\n+([\s\S]*?)(?=\n###?\s|\n*$)/gm
  let match
  while ((match = categoryPattern.exec(section)) !== null) {
    const categoryName = match[1].trim()
    const content = match[2]

    const items: { name: string; price: string; description?: string }[] = []
    const itemPattern =
      /^[-*]?\s*\**(.+?)\**\s*[-\u2013\u2026\u00B7]?\s*\$?([\d,.]+)/gm
    let itemMatch
    while ((itemMatch = itemPattern.exec(content)) !== null) {
      items.push({
        name: itemMatch[1].trim(),
        price: `$${itemMatch[2]}`,
      })
    }

    if (items.length > 0) {
      categories.push({ category: categoryName, items })
    }
  }

  return categories.length > 0 ? categories : undefined
}

function extractHours(
  markdown: string
): { day: string; hours: string }[] | undefined {
  const section = findSection(markdown, [
    'hours',
    'opening hours',
    'business hours',
    'visit us',
    'when we',
  ])
  if (!section) return undefined

  const hours: { day: string; hours: string }[] = []
  const days = [
    'monday', 'tuesday', 'wednesday', 'thursday',
    'friday', 'saturday', 'sunday',
    'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
  ]

  const fullDayNames = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday',
    'Friday', 'Saturday', 'Sunday',
  ]

  const sectionLines = section.split('\n')
  for (const line of sectionLines) {
    const lower = line.toLowerCase()
    for (let d = 0; d < days.length; d++) {
      if (lower.includes(days[d])) {
        const timeMatch = line.match(
          /\d{1,2}[:.]\d{2}\s*(?:am|pm|AM|PM)?\s*[-\u2013to]+\s*\d{1,2}[:.]\d{2}\s*(?:am|pm|AM|PM)?/
        )
        if (timeMatch) {
          const fullDay = fullDayNames[d % 7]
          hours.push({ day: fullDay, hours: timeMatch[0].trim() })
        }
        break
      }
    }
  }

  return hours.length > 0 ? hours : undefined
}

function extractEmail(markdown: string): string | undefined {
  const match = markdown.match(/[\w.-]+@[\w.-]+\.\w{2,}/)
  return match ? match[0] : undefined
}

function extractPhone(markdown: string): string | undefined {
  const match = markdown.match(
    /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
  )
  return match ? match[0] : undefined
}

function extractAddress(markdown: string): string | undefined {
  const addressSection = findSection(markdown, [
    'address',
    'location',
    'visit us',
    'find us',
    'where to find',
  ])
  if (!addressSection) return undefined

  const sectionLines = addressSection.split('\n')
  for (const line of sectionLines) {
    const trimmed = line.replace(/^[-*#>\s]+/, '').trim()
    if (
      trimmed.match(
        /\d+\s+\w+\s+(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court)/i
      )
    ) {
      return trimmed
    }
  }

  return undefined
}

/**
 * Find a markdown section by heading keywords.
 * Returns the content between matching heading and the next same-level heading.
 */
function findSection(
  markdown: string,
  keywords: string[]
): string | null {
  const sectionLines = markdown.split('\n')

  for (let i = 0; i < sectionLines.length; i++) {
    const line = sectionLines[i]
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (!headingMatch) continue

    const headingLevel = headingMatch[1].length
    const headingText = headingMatch[2].toLowerCase()

    if (keywords.some(kw => headingText.includes(kw))) {
      const contentLines: string[] = []
      for (let j = i + 1; j < sectionLines.length; j++) {
        const nextHeading = sectionLines[j].match(/^(#{1,3})\s/)
        if (nextHeading && nextHeading[1].length <= headingLevel) break
        contentLines.push(sectionLines[j])
      }
      return contentLines.join('\n')
    }
  }

  return null
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/tarun/Desktop/Pravik_Builder && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/services/scraper/extractor.ts
git commit -m "feat: add content extractor for parsing scraped markdown"
```

---

## Chunk 2: Visual Analyzer + Clone Generator

### Task 3: Create Visual Analyzer

**Files:**
- Create: `src/services/scraper/visual-analyzer.ts`

Uses Claude Vision API to analyze a screenshot and return structured design intelligence (layout, colors, typography, template/theme recommendation).

- [ ] **Step 1: Create `src/services/scraper/visual-analyzer.ts`**

```typescript
// src/services/scraper/visual-analyzer.ts

import Anthropic from '@anthropic-ai/sdk'

export interface VisualAnalysis {
  layout: {
    heroStyle: 'center' | 'split' | 'bold'
    hasGallery: boolean
    sectionCount: number
  }
  colors: {
    background: 'light' | 'dark'
    mood: 'clean' | 'bold' | 'vibrant' | 'warm'
  }
  typography: {
    style: 'modern' | 'classic' | 'playful' | 'minimal'
    weight: 'light' | 'regular' | 'bold'
  }
  recommendedTemplate: string
  recommendedTheme: string
}

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

const VISUAL_ANALYZER_PROMPT = `You are a web design analyst. Look at this website screenshot and describe its visual design.

Return ONLY valid JSON with this structure:
{
  "layout": {
    "heroStyle": "center" | "split" | "bold",
    "hasGallery": boolean,
    "sectionCount": number
  },
  "colors": {
    "background": "light" | "dark",
    "mood": "clean" | "bold" | "vibrant" | "warm"
  },
  "typography": {
    "style": "modern" | "classic" | "playful" | "minimal",
    "weight": "light" | "regular" | "bold"
  },
  "recommendedTemplate": "template-id",
  "recommendedTheme": "theme-id"
}

Hero styles:
- "center": text centered over image/gradient, typical marketing landing page
- "split": text on one side, image on the other
- "bold": oversized dramatic typography, editorial feel

Color moods:
- "clean": white/light background, professional, muted colors
- "bold": dark background, high contrast, modern tech
- "vibrant": colorful, gradients, energetic
- "warm": earthy tones, warm backgrounds, cozy

Template IDs (pick the best match):
- "landing": SaaS, product, clean centered hero
- "landing-bold": Same but dramatic bold typography
- "services": Service business, centered hero, service cards, process, FAQ
- "services-bold": Same but high-impact, before/after
- "restaurant": Food business, split hero, menu, gallery, hours
- "restaurant-dark": Same but dark, moody, upscale
- "agency": Creative studio, split hero, portfolio gallery, team
- "agency-editorial": Same but editorial, asymmetric gallery
- "event": Conference, centered hero, schedule, speakers
- "event-dark": Same but dark, dramatic

Theme IDs: "clean", "bold", "vibrant", "warm"

Return ONLY valid JSON, no markdown fences, no explanation.`

/**
 * Analyze a website screenshot using Claude Vision.
 * Returns design intelligence: layout type, color mood, typography,
 * template/theme recommendations.
 * Returns null if analysis fails (caller falls back to content-only mode).
 */
export async function analyzeScreenshot(
  screenshotBase64: string
): Promise<VisualAnalysis | null> {
  try {
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshotBase64,
              },
            },
            {
              type: 'text',
              text: VISUAL_ANALYZER_PROMPT,
            },
          ],
        },
      ],
    })

    const text =
      response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text
      .replace(/```json?\n?/g, '')
      .replace(/```/g, '')
      .trim()
    return JSON.parse(cleaned) as VisualAnalysis
  } catch (error) {
    console.error('Visual analysis failed:', error)
    return null
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/tarun/Desktop/Pravik_Builder && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/services/scraper/visual-analyzer.ts
git commit -m "feat: add visual analyzer for screenshot-based design analysis"
```

---

### Task 4: Create Clone Generator

**Files:**
- Create: `src/services/scraper/clone-generator.ts`

Takes extracted content + optional visual analysis and produces a TemplateConfig JSON. This is the AI "brain" of the clone feature.

- [ ] **Step 1: Create `src/services/scraper/clone-generator.ts`**

```typescript
// src/services/scraper/clone-generator.ts

import Anthropic from '@anthropic-ai/sdk'
import { getGeneratorPrompt } from '@/services/agents/prompts/generator'
import { TEMPLATE_IDS, THEME_IDS, resolveTemplateId } from '@/templates/types'
import type { TemplateConfig, ThemeId } from '@/templates/types'
import type { ExtractedContent } from './extractor'
import type { VisualAnalysis } from './visual-analyzer'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

function buildClonePrompt(
  extracted: ExtractedContent,
  visualAnalysis: VisualAnalysis | null,
  projectId: string
): string {
  const bookingUrl = `/book/${projectId}`

  // Build the extracted content section
  const contentLines = [
    `Site Name: ${extracted.siteName}`,
    extracted.tagline ? `Tagline: ${extracted.tagline}` : null,
    extracted.heroTitle ? `Hero Title: ${extracted.heroTitle}` : null,
    extracted.heroSubtitle
      ? `Hero Subtitle: ${extracted.heroSubtitle}`
      : null,
    extracted.services
      ? `Services: ${JSON.stringify(extracted.services)}`
      : null,
    extracted.features
      ? `Features: ${JSON.stringify(extracted.features)}`
      : null,
    extracted.testimonials
      ? `Testimonials: ${JSON.stringify(extracted.testimonials)}`
      : null,
    extracted.team
      ? `Team: ${JSON.stringify(extracted.team)}`
      : null,
    extracted.faq
      ? `FAQ: ${JSON.stringify(extracted.faq)}`
      : null,
    extracted.pricing
      ? `Pricing: ${JSON.stringify(extracted.pricing)}`
      : null,
    extracted.menuItems
      ? `Menu Items: ${JSON.stringify(extracted.menuItems)}`
      : null,
    extracted.email ? `Email: ${extracted.email}` : null,
    extracted.phone ? `Phone: ${extracted.phone}` : null,
    extracted.address ? `Address: ${extracted.address}` : null,
    extracted.hours
      ? `Hours: ${JSON.stringify(extracted.hours)}`
      : null,
  ]
    .filter(Boolean)
    .join('\n')

  // Build visual analysis section (if available)
  let visualSection = ''
  if (visualAnalysis) {
    visualSection = `
== VISUAL ANALYSIS ==
Recommended template: ${visualAnalysis.recommendedTemplate}
Recommended theme: ${visualAnalysis.recommendedTheme}
Layout: hero=${visualAnalysis.layout.heroStyle}, gallery=${visualAnalysis.layout.hasGallery}, sections=${visualAnalysis.layout.sectionCount}
Colors: ${visualAnalysis.colors.mood} mood, ${visualAnalysis.colors.background} background
Typography: ${visualAnalysis.typography.style}, ${visualAnalysis.typography.weight}
`
  }

  // Get the base generator prompt (has template/theme/content schema)
  const basePrompt = getGeneratorPrompt(projectId)

  // Extract just the template/theme descriptions and content schema
  // from the base prompt (everything after the first line of instruction)
  const templateSection = basePrompt
    .split('Template selection rules:')
    .slice(1)
    .join('Template selection rules:')

  return `You are a website rebuilder. You have been given content extracted from an existing website. Your job is to rebuild it using our template system.

== EXTRACTED CONTENT ==
${contentLines}

== RAW MARKDOWN (for anything the extraction missed) ==
${extracted.rawMarkdown}

${visualSection}

== INSTRUCTIONS ==
1. Use the extracted content as-is. Do NOT invent fake content.
2. ${
    visualAnalysis
      ? 'Use the visual analysis template/theme recommendation as a strong guide.'
      : 'Pick the best template based on the business type.'
  }
3. Fill ALL content fields for the chosen template using extracted data.
4. For fields not found in the extraction, check the raw markdown.
5. Only generate placeholder content if a required field has no source data.
6. Set ctaUrl and bookingUrl to "${bookingUrl}"
7. Set heroImageQuery to a 1-3 word search term for the business type.
8. Set businessCategory from the 40 predefined categories.

Template selection rules:${templateSection}`
}

/**
 * Generate a TemplateConfig from extracted website content + optional
 * visual analysis. This is the core AI call that powers the clone feature.
 */
export async function generateCloneConfig(
  extracted: ExtractedContent,
  visualAnalysis: VisualAnalysis | null,
  projectId: string
): Promise<TemplateConfig> {
  const prompt = buildClonePrompt(extracted, visualAnalysis, projectId)

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: prompt,
    messages: [
      {
        role: 'user',
        content: `Generate a complete TemplateConfig JSON to rebuild this website. Use the extracted content, pick the best template and theme${
          visualAnalysis ? ' (guided by the visual analysis)' : ''
        }, and fill all content fields.`,
      },
    ],
  })

  const text =
    response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text
    .replace(/```json?\n?/g, '')
    .replace(/```/g, '')
    .trim()
  const parsed = JSON.parse(cleaned) as TemplateConfig

  // Validate and fallback
  const template = resolveTemplateId(parsed.template)
  const theme: ThemeId = THEME_IDS.includes(parsed.theme as ThemeId)
    ? (parsed.theme as ThemeId)
    : 'clean'

  return { ...parsed, template, theme }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/tarun/Desktop/Pravik_Builder && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/services/scraper/clone-generator.ts
git commit -m "feat: add clone generator AI for producing TemplateConfig from scraped content"
```

---

## Chunk 3: Integration — Router + Orchestrator

### Task 5: Add `clone_site` Intent to Types

**Files:**
- Modify: `src/services/agents/types.ts`

Add the new intent and extend RouterResult with clone-specific fields.

- [ ] **Step 1: Update AgentIntent union type**

In `src/services/agents/types.ts`, change the `AgentIntent` type to:

```typescript
export type AgentIntent =
  | 'generate_site'
  | 'edit_block'
  | 'add_block'
  | 'remove_block'
  | 'reorder_blocks'
  | 'change_theme'
  | 'change_image'
  | 'edit_tool'
  | 'add_tool'
  | 'clone_site'
  | 'clarify'
```

- [ ] **Step 2: Add clone fields to RouterResult**

In the same file, update `RouterResult`:

```typescript
export interface RouterResult {
  intent: AgentIntent
  target_blocks: string[]
  description: string
  question?: string
  position?: number
  clone_mode?: 'content' | 'content_and_style'
  clone_url?: string
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/tarun/Desktop/Pravik_Builder && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/services/agents/types.ts
git commit -m "feat: add clone_site intent to agent type system"
```

---

### Task 6: Update Router Prompt

**Files:**
- Modify: `src/services/agents/prompts/router.ts`

Add `clone_site` intent with URL detection and style mode inference.

- [ ] **Step 1: Add clone_site to available intents in the hasBlocks branch**

In `src/services/agents/prompts/router.ts`, inside the `hasBlocks` available intents string, add after the `generate_site` line:

```
- "clone_site": User provides a URL and wants to clone/recreate/copy that website
```

- [ ] **Step 2: Add clone_site to the no-blocks branch**

In the no-blocks available intents string, add after `generate_site`:

```
- "clone_site": User provides a URL and wants to clone/recreate/copy that website
```

- [ ] **Step 3: Add clone routing rules**

Add these rules to the end of the rules section (before the final backtick):

```
- User provides a URL (http/https/www) and says "clone", "copy", "recreate", "rebuild", "make me a site like", "replicate", "base it on" -> clone_site
- For clone_site: put the URL in "clone_url" field, and add "clone_mode" field:
  - "content_and_style" if user mentions style: "match the style", "same look", "similar design", "look and feel", "same vibe"
  - "content" otherwise (default)
- "clone example.com" -> clone_site with clone_url="https://example.com", clone_mode="content"
- "recreate example.com and match the style" -> clone_site with clone_url="https://example.com", clone_mode="content_and_style"
```

- [ ] **Step 4: Add clone fields to JSON schema comment**

In the JSON return format section, add:

```
  "clone_url": "URL string (only for clone_site)",
  "clone_mode": "content" | "content_and_style" (only for clone_site)
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /Users/tarun/Desktop/Pravik_Builder && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/services/agents/prompts/router.ts
git commit -m "feat: add clone_site routing rules to router prompt"
```

---

### Task 7: Extract renderAndStoreBlocks Helper from Generator

**Files:**
- Modify: `src/services/agents/generator.ts`

Extract the render + block storage logic into a reusable function so both `generateSite` and the clone flow can use it.

- [ ] **Step 1: Add the renderAndStoreBlocks export**

In `src/services/agents/generator.ts`, add this new exported function (after the `splitHtmlIntoBlocks` function, before `generateSite`):

```typescript
/**
 * Render a TemplateConfig to HTML, split into blocks, and store in DB.
 * Shared between generateSite and clone flow.
 */
export async function renderAndStoreBlocks(
  config: TemplateConfig,
  projectId: string
): Promise<{ blocks: Block[]; theme: ThemeId; config: TemplateConfig }> {
  // Fetch images from Unsplash
  try {
    const images = await fetchTemplateImages(config)

    if (images.heroImageUrl) {
      config.content.heroImageUrl = images.heroImageUrl
    }

    if (images.galleryImageUrls && config.content.galleryItems) {
      config.content.galleryItems = config.content.galleryItems.map(
        (item, i) => ({
          ...item,
          imageUrl: images.galleryImageUrls![i] || undefined,
        })
      )
    }
  } catch (err) {
    console.error('Image fetch failed, using gradient placeholders:', err)
  }

  // Render full HTML using existing template system
  const fullHtml = renderTemplate(config)

  // Extract body content
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  const bodyHtml = bodyMatch ? bodyMatch[1].trim() : fullHtml

  // Split into blocks
  const rawBlocks = splitHtmlIntoBlocks(bodyHtml)

  const supabase = getSupabaseClient()

  // Store blocks in DB
  const blockRows = rawBlocks.map((b, i) => ({
    project_id: projectId,
    block_type: b.block_type,
    html: b.html,
    position: i,
  }))

  const { data: insertedBlocks, error } = await supabase
    .from('blocks')
    .insert(blockRows)
    .select()

  if (error) {
    throw new Error(`Failed to insert blocks: ${error.message}`)
  }

  // Update project with theme and config
  await supabase
    .from('projects')
    .update({
      theme: config.theme,
      template_config: config,
      preview_url: `/site/${projectId}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)

  return {
    blocks: insertedBlocks as Block[],
    theme: config.theme,
    config,
  }
}
```

- [ ] **Step 2: Refactor generateSite to use the helper**

Replace the body of `generateSite` (from the image fetch try/catch through the end) with a call to `renderAndStoreBlocks`:

```typescript
export async function generateSite(
  message: string,
  projectId: string
): Promise<{ blocks: Block[]; theme: ThemeId; config: TemplateConfig }> {
  const systemPrompt = getGeneratorPrompt(projectId)

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
  })

  const text =
    response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text
    .replace(/```json?\n?/g, '')
    .replace(/```/g, '')
    .trim()
  const parsed = JSON.parse(cleaned) as TemplateConfig

  // Validate and fallback
  const template = resolveTemplateId(parsed.template)
  const theme: ThemeId = THEME_IDS.includes(parsed.theme as ThemeId)
    ? (parsed.theme as ThemeId)
    : 'clean'

  const config: TemplateConfig = { ...parsed, template, theme }

  return renderAndStoreBlocks(config, projectId)
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/tarun/Desktop/Pravik_Builder && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/services/agents/generator.ts
git commit -m "refactor: extract renderAndStoreBlocks helper for reuse by clone flow"
```

---

### Task 8: Add Clone Handler to Orchestrator

**Files:**
- Modify: `src/services/agents/orchestrator.ts`

Add the `clone_site` case that wires together: Firecrawl → Extractor → Visual Analyzer → Clone Generator → existing pipeline.

- [ ] **Step 1: Add imports at top of orchestrator.ts**

Add these imports after the existing ones:

```typescript
import { crawlSite } from '@/services/scraper/firecrawl'
import { extractContent } from '@/services/scraper/extractor'
import { analyzeScreenshot } from '@/services/scraper/visual-analyzer'
import { generateCloneConfig } from '@/services/scraper/clone-generator'
```

Also update the generator import to include the new helper:

```typescript
import { generateSite, renderAndStoreBlocks } from './generator'
```

- [ ] **Step 2: Add clone_site case in switch statement**

Add this case inside the `switch (route.intent)` block, after the `generate_site` case (around line 135):

```typescript
    case 'clone_site': {
      const cloneUrl = route.clone_url || route.description
      const cloneMode = route.clone_mode || 'content'

      // Validate URL
      if (!cloneUrl || !cloneUrl.match(/^https?:\/\//)) {
        // Try to fix common patterns
        const fixedUrl = cloneUrl && cloneUrl.match(/\w+\.\w+/)
          ? `https://${cloneUrl}`
          : null

        if (!fixedUrl) {
          return {
            action: 'clarify',
            message:
              "I need a valid URL to clone. Could you provide the full website address? (e.g., https://example.com)",
            question:
              "What's the URL of the website you'd like to clone?",
          }
        }

        route.clone_url = fixedUrl
      }

      const targetUrl = route.clone_url || cloneUrl

      // Step 1: Crawl the site with Firecrawl
      const crawlResult = await crawlSite(targetUrl)

      if (!crawlResult) {
        return {
          action: 'clarify',
          message:
            "I couldn't access that website. Please check the URL and make sure the site is publicly accessible, then try again.",
          question: 'Could you double-check the URL?',
        }
      }

      // Step 2: Extract structured content
      const extracted = extractContent(crawlResult)

      // Step 3: Visual analysis (only in style mode + screenshot available)
      let visualAnalysis = null
      if (
        cloneMode === 'content_and_style' &&
        crawlResult.mainPage.screenshot
      ) {
        visualAnalysis = await analyzeScreenshot(
          crawlResult.mainPage.screenshot
        )
        // If fails, continue without it (graceful degradation)
      }

      // Step 4: Generate TemplateConfig via clone generator AI
      const config = await generateCloneConfig(
        extracted,
        visualAnalysis,
        projectId
      )

      // Step 5: Delete existing blocks and tools (fresh start)
      await supabase.from('blocks').delete().eq('project_id', projectId)
      await supabase.from('tools').delete().eq('project_id', projectId)

      // Step 6: Render, fetch images, split into blocks, store
      const result = await renderAndStoreBlocks(config, projectId)
      const blockTypes = result.blocks
        .map(b => b.block_type)
        .join(', ')

      // Step 7: Auto-generate booking tool
      const templateType = result.config.template || 'landing'
      const toolConfig = await generateBookingTool(
        extracted.siteName || message,
        projectId,
        templateType
      )

      if (toolConfig) {
        const updatedContent = {
          ...result.config.content,
          bookingUrl: `/book/${projectId}`,
          bookingText: toolConfig.submitText,
        }
        const updatedConfig = {
          ...result.config,
          content: updatedContent,
        }
        await supabase
          .from('projects')
          .update({
            template_config: updatedConfig,
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId)

        await patchBlockBookingUrls(projectId, supabase)
      }

      const styleNote = visualAnalysis
        ? ` I matched the ${visualAnalysis.colors.mood} color vibe and ${visualAnalysis.layout.heroStyle} layout from the original.`
        : ''

      return {
        action: 'generated',
        message: `Your site is ready! I rebuilt it from ${extracted.siteName}'s content with fresh images. Sections: ${blockTypes}.${styleNote}${
          toolConfig
            ? ` Booking form live at /book/${projectId}`
            : ''
        }`,
      }
    }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/tarun/Desktop/Pravik_Builder && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/services/agents/orchestrator.ts
git commit -m "feat: wire clone_site intent into orchestrator with full pipeline"
```

---

## Chunk 4: Build Verification + Environment Setup

### Task 9: Environment Variable Setup

**Files:**
- Modify: `.env.local` (add FIRECRAWL_API_KEY)

- [ ] **Step 1: Add FIRECRAWL_API_KEY to .env.local**

User needs to sign up at https://firecrawl.dev and get an API key. Add to `.env.local`:

```
FIRECRAWL_API_KEY=fc-your-key-here
```

- [ ] **Step 2: Add to Vercel (when ready to deploy)**

Add `FIRECRAWL_API_KEY` to the Vercel project environment variables via the dashboard or CLI.

---

### Task 10: Full Build Verification

- [ ] **Step 1: Run TypeScript compilation check**

Run: `cd /Users/tarun/Desktop/Pravik_Builder && npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 2: Run Next.js build**

Run: `cd /Users/tarun/Desktop/Pravik_Builder && npx next build 2>&1 | tail -30`
Expected: Build succeeds, all pages compile

- [ ] **Step 3: Fix any build errors and commit**

If there are errors, fix them and re-run until build passes.

```bash
git add -A
git commit -m "fix: resolve any build errors in clone feature"
```

---

### Task 11: Manual Testing Checklist

After deploying (or running locally with `npm run dev`):

- [ ] **Test 1: Content-only clone**

Send message: `clone https://example.com`

Expected: Router detects clone_site intent -> Firecrawl scrapes -> content extracted -> AI generates config -> site rendered with sections + fresh images

- [ ] **Test 2: Content + style clone**

Send message: `clone https://example.com and match the style`

Expected: Same as above + visual analysis runs -> template/theme influenced by screenshot

- [ ] **Test 3: No Firecrawl key graceful failure**

Temporarily remove `FIRECRAWL_API_KEY` -> send clone message

Expected: Friendly error message asking to check the URL

- [ ] **Test 4: Bad URL handling**

Send message: `clone notawebsite`

Expected: Clarify response asking for valid URL

- [ ] **Test 5: Existing site re-clone**

Clone a site, then clone a different one for the same project

Expected: Old blocks deleted, new site generated from new URL

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Firecrawl API client | `src/services/scraper/firecrawl.ts` (new) |
| 2 | Content extractor | `src/services/scraper/extractor.ts` (new) |
| 3 | Visual analyzer | `src/services/scraper/visual-analyzer.ts` (new) |
| 4 | Clone generator AI | `src/services/scraper/clone-generator.ts` (new) |
| 5 | Add clone_site intent | `src/services/agents/types.ts` (modify) |
| 6 | Update router prompt | `src/services/agents/prompts/router.ts` (modify) |
| 7 | Extract render helper | `src/services/agents/generator.ts` (modify) |
| 8 | Wire into orchestrator | `src/services/agents/orchestrator.ts` (modify) |
| 9 | Env var setup | `.env.local`, Vercel |
| 10 | Build verification | N/A |
| 11 | Manual testing | N/A |

**Total new code:** ~600 lines across 4 new files
**Modified code:** ~100 lines across 4 existing files
**Dependencies:** Firecrawl API (external service), no new npm packages
