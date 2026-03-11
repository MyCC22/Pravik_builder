# Website Cloning Feature — Design Spec

**Date:** 2026-03-11
**Status:** Approved

## Overview

A chat-based feature that lets users clone an existing website by extracting its content and visual style, then rebuilding it using the existing template system with fresh Unsplash images. Users type "clone mysite.com" and get a fully rebuilt site in ~30 seconds.

## Two User Modes

1. **Content Only** — "clone example.com" — Extracts text content, AI picks the best template/theme based on business type, fresh Unsplash images.
2. **Content + Style** — "clone example.com and match the style" — Same as above, plus Claude Vision analyzes a screenshot to pick a template/theme that matches the original site's layout and color vibe.

## Chosen Approach: Firecrawl + Screenshot + AI Vision (Approach B)

Firecrawl scrapes content as markdown + takes a screenshot. Claude Vision analyzes the screenshot for layout/colors/fonts. AI combines both to generate a TemplateConfig, which feeds into the existing rendering pipeline.

**Why this approach:**
- Firecrawl returns clean markdown (ideal AI input) and handles JS rendering, anti-bot, proxies
- Screenshot lets AI "see" the original site — picks better template layout, matches color vibe
- Cost is marginal: ~$0.01/page for Firecrawl, ~$0.03 for Vision call, ~$0.05-0.10 for clone generator

## Pipeline Architecture

```
Step 1: USER        → "clone https://example-yoga.com"
Step 2: ROUTER      → Detects URL → routes to clone_site intent
Step 3: SCRAPER     → Firecrawl API: crawls homepage + inner pages
                      Returns: markdown[] + screenshot + metadata
Step 4: EXTRACTOR   → Code parses markdown → structured content
Step 5: AI VISION   → Claude Vision analyzes screenshot → layout, colors, mood
Step 6: CLONE GEN   → AI combines content + visual analysis → TemplateConfig JSON
Step 7: RENDER      → Existing: fetchTemplateImages → renderTemplate → splitHtmlIntoBlocks → store
Step 8: BOOKING     → Existing: generateBookingTool → auto-create lead capture form
```

Steps 7 & 8 are the existing pipeline. The clone feature only adds steps 3-6. Once a TemplateConfig is produced, the rest of the system works exactly as it does today.

**Parallelism:** Steps 4 (content extraction) and 5 (visual analysis) run in parallel since they're independent. Steps 3→4 and 3→5 are sequential (both need crawl data).

**Total timing:** ~28-38s for content + style mode, fitting within the 60s maxDuration.

## Component Design

### 1. Firecrawl Client — `src/services/scraper/firecrawl.ts`

```typescript
interface ScrapeResult {
  url: string
  markdown: string           // Page content as clean markdown
  metadata: {
    title: string
    description: string
    ogImage?: string         // Open Graph image URL
    favicon?: string
  }
  screenshot?: string        // Base64 PNG of rendered page
  links: string[]            // Internal links found on page
}

interface CrawlResult {
  pages: ScrapeResult[]      // Homepage + discovered inner pages
  mainPage: ScrapeResult     // Homepage (always first)
}

async function crawlSite(url: string): Promise<CrawlResult>
```

**Firecrawl API details:**
- `POST /v1/crawl` — crawl homepage + follow internal links (max 5 pages)
- `POST /v1/scrape` — single page scrape with screenshot
- Returns markdown by default — clean, no HTML tags
- Screenshot via `formats: ["markdown", "screenshot"]`
- Rate: 500 free credits/month, then $0.01/page
- Handles JS-rendered sites, anti-bot, proxies automatically

### 2. Content Extractor — `src/services/scraper/extractor.ts`

```typescript
interface ExtractedContent {
  // From homepage
  siteName: string
  tagline?: string
  heroTitle?: string
  heroSubtitle?: string

  // Sections discovered across all pages
  services?: { title: string; description: string }[]
  features?: { title: string; description: string }[]
  testimonials?: { quote: string; name: string; role?: string }[]
  team?: { name: string; role: string; bio?: string }[]
  faq?: { question: string; answer: string }[]
  pricing?: { plan: string; price: string; features: string[] }[]
  menuItems?: { category: string; items: { name: string; price: string }[] }[]

  // Contact info
  email?: string
  phone?: string
  address?: string
  hours?: { day: string; hours: string }[]

  // Raw markdown for AI to process further
  rawMarkdown: string
}

function extractContent(crawl: CrawlResult): ExtractedContent
```

**Extraction strategy (hybrid):**
- Code does first pass: Parse markdown headings, lists, quoted text → map to content fields
- AI does refinement: Takes raw markdown + code-extracted fields → fills gaps, fixes misclassifications
- Example: Code finds H2 "Our Services" followed by bullet points → maps to `services[]`
- Example: AI recognizes "$49/month" pattern in text → maps to `pricing[]`

### 3. Visual Analyzer — `src/services/scraper/visual-analyzer.ts`

```typescript
interface VisualAnalysis {
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
  recommendedTemplate: string   // Best matching template ID
  recommendedTheme: string      // Best matching theme ID
}

async function analyzeScreenshot(screenshotBase64: string): Promise<VisualAnalysis>
```

- Uses Claude Vision API (claude-sonnet with vision)
- Only runs in "content + style" mode — skipped for content-only clones
- Single API call, ~2-3s, ~$0.03 per screenshot
- Maps observations to existing template IDs and theme IDs

### 4. Clone Generator — `src/services/agents/clone-generator.ts`

A specialized version of the existing generator. Instead of generating content from a user description, it generates a TemplateConfig from extracted content + visual analysis.

- **Input:** ExtractedContent + VisualAnalysis (optional) + user message
- **Output:** TemplateConfig JSON (same format as existing generator)
- **Template selection:** Based on visual analysis (if available) or business type detection
- **Content population:** Uses extracted content directly, AI fills gaps and polishes
- **After output:** Feeds into existing pipeline → fetchTemplateImages → renderTemplate → splitHtmlIntoBlocks

## Integration Design

### Router Changes (`src/services/agents/types.ts`)

New intent: `clone_site`

```typescript
type AgentIntent =
  | 'generate_site'
  | 'edit_site'
  | 'change_template'
  | 'change_theme'
  | 'change_image'
  | 'clone_site'         // NEW
  | 'general_chat'
```

### Router Prompt Changes (`src/services/agents/prompts/router.ts`)

- Detect URLs in user messages
- "clone", "copy", "recreate", "rebuild" + URL → `clone_site`
- Route includes `mode: 'content' | 'content_and_style'`
- "match the style", "same look", "similar design" → `content_and_style` mode

### Orchestrator Changes (`src/services/agents/orchestrator.ts`)

New `clone_site` case:
1. Extract URL from user message
2. Call `crawlSite(url)` — get markdown + screenshot
3. Call `extractContent(crawlResult)` — structured content
4. If style mode: call `analyzeScreenshot(screenshot)` in parallel with step 3
5. Call clone generator with extracted content + visual analysis
6. Feed resulting TemplateConfig into existing pipeline (images → render → blocks → booking)
7. Return success response with the rebuilt site

### Environment Variables

- `FIRECRAWL_API_KEY` — Required for clone feature
- `UNSPLASH_ACCESS_KEY` — Already configured (for image fetching)
- `ANTHROPIC_API_KEY` — Already configured (for AI calls)

## AI Prompt Design

### Prompt 1: Visual Analyzer (Claude Vision)

Only runs in "content + style" mode. Single Claude Vision call with the homepage screenshot.

**Model:** claude-sonnet with vision | **Max tokens:** 512 | **Cost:** ~$0.03/call | **Speed:** ~2-3s

```
You are a web design analyst. Look at this website screenshot and describe its visual design.

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
  "recommendedTheme": "clean" | "bold" | "vibrant" | "warm"
}
```

Template IDs available: landing, landing-bold, services, services-bold, restaurant, restaurant-dark, agency, agency-editorial, event, event-dark.

### Prompt 2: Clone Generator (Main Intelligence)

Takes extracted content + visual analysis → produces complete TemplateConfig. Reuses the existing content schema.

**Model:** claude-sonnet | **Max tokens:** 4096 | **Cost:** ~$0.05-0.10/call | **Speed:** ~8-12s

```
You are a website rebuilder. You've been given content extracted from
an existing website. Your job is to rebuild it using our template system.

== EXTRACTED CONTENT ==
Site Name: {siteName}
Tagline: {tagline}
Hero Title: {heroTitle}
Hero Subtitle: {heroSubtitle}
Services: {JSON services array}
Testimonials: {JSON testimonials array}
FAQ: {JSON faq array}
Contact: {email, phone, address}
Hours: {JSON hours array}
... (all extracted fields)

== RAW MARKDOWN (for anything extraction missed) ==
{raw markdown from Firecrawl — truncated to ~4000 chars}

== VISUAL ANALYSIS (if style mode) ==
Recommended template: {recommendedTemplate}
Recommended theme: {recommendedTheme}
Layout: hero={heroStyle}, gallery={hasGallery}
Colors: {mood} mood, {background} background
Typography: {style}, {weight}

== INSTRUCTIONS ==
1. Use the extracted content as-is. Do NOT invent content.
2. If visual analysis is provided, use its template/theme recommendation.
   Otherwise, pick the best template based on the business type.
3. Fill ALL content fields for the chosen template.
4. For fields not found in the extraction, use the raw markdown
   to find relevant content. Only generate content if truly missing.
5. Set ctaUrl and bookingUrl to "{bookingUrl}"
6. Set heroImageQuery to a 1-3 word search for the business type.
7. Set businessCategory from the 40 predefined categories.

{existing TEMPLATE_DESCRIPTIONS}
{existing THEME_DESCRIPTIONS}
{existing CONTENT_SCHEMA}

Return format: { "template": "...", "theme": "...", "content": {...} }
```

## Design Principles

**What we DO:**
- Use real extracted content
- Reuse existing template/theme/schema system
- Provide raw markdown as fallback for missed content
- Let vision guide template selection
- Generate only what's truly missing

**What we DON'T:**
- Invent fake content
- Copy original images/HTML
- Try to exactly replicate CSS
- Create new template types
- Bypass the existing rendering pipeline

## Timing Estimate

| Step | Duration |
|------|----------|
| Firecrawl crawl (homepage + 3-4 pages) | ~8-12s |
| Content extraction (code parsing) | ~0.1s |
| Visual analysis (Claude Vision) — style mode only | ~2-3s |
| Clone generator (Claude Sonnet) | ~8-12s |
| Image fetching (stock images, instant) | ~0.1s |
| Template render + block storage | ~0.5s |
| Booking tool generation | ~8-10s |
| **Total (content + style mode)** | **~28-38s** |

Fits within the 60s maxDuration. Vision analysis runs in parallel with content extraction.

## Error Handling

- **Firecrawl fails:** Return user-friendly error "I couldn't access that website. Please check the URL and try again."
- **No content extracted:** Fall back to raw markdown + AI extraction
- **Vision fails:** Skip visual analysis, fall back to content-only mode (AI picks template from business type)
- **Clone generator fails:** Return error with suggestion to try a different URL
- **No Firecrawl key:** Feature disabled, inform user the clone feature requires configuration
