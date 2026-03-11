const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v1'
const CRAWL_TIMEOUT_MS = 30000
const POLL_INTERVAL_MS = 2000

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
 * Scrape a single page using the Firecrawl API.
 * Optionally captures a screenshot (base64 PNG).
 * Returns null if API key is missing or request fails (graceful fallback).
 */
export async function scrapePage(
  url: string,
  options?: { screenshot?: boolean }
): Promise<ScrapeResult | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.error('Firecrawl: FIRECRAWL_API_KEY is not set')
    return null
  }

  const formats = options?.screenshot ? ['markdown', 'screenshot'] : ['markdown']

  try {
    const response = await fetch(`${FIRECRAWL_BASE_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ url, formats }),
    })

    if (!response.ok) {
      console.error(`Firecrawl scrape failed: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()

    return {
      url,
      markdown: data.data?.markdown ?? '',
      metadata: {
        title: data.data?.metadata?.title ?? '',
        description: data.data?.metadata?.description ?? '',
        ogImage: data.data?.metadata?.ogImage,
      },
      screenshot: data.data?.screenshot,
    }
  } catch (error) {
    console.error('Firecrawl scrape error:', error)
    return null
  }
}

/**
 * Crawl a site using the Firecrawl API.
 * First scrapes the homepage (with screenshot), then crawls up to 4 inner pages.
 * Polls until completed or 30s timeout.
 * Falls back to homepage-only if crawl fails.
 */
export async function crawlSite(url: string): Promise<CrawlResult | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.error('Firecrawl: FIRECRAWL_API_KEY is not set')
    return null
  }

  // Step 1: Scrape the homepage with a screenshot
  const mainPage = await scrapePage(url, { screenshot: true })
  if (!mainPage) {
    console.error('Firecrawl: failed to scrape homepage')
    return null
  }

  // Step 2: Start a crawl job for inner pages
  let crawlId: string | null = null
  try {
    const crawlResponse = await fetch(`${FIRECRAWL_BASE_URL}/crawl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        limit: 5,
        scrapeOptions: { formats: ['markdown'] },
      }),
    })

    if (!crawlResponse.ok) {
      console.error(`Firecrawl crawl start failed: ${crawlResponse.status} ${crawlResponse.statusText}`)
      return { pages: [mainPage], mainPage }
    }

    const crawlData = await crawlResponse.json()
    crawlId = crawlData.id ?? null
  } catch (error) {
    console.error('Firecrawl crawl start error:', error)
    return { pages: [mainPage], mainPage }
  }

  if (!crawlId) {
    console.error('Firecrawl: crawl job returned no ID')
    return { pages: [mainPage], mainPage }
  }

  // Step 3: Poll for crawl completion
  const deadline = Date.now() + CRAWL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))

    try {
      const statusResponse = await fetch(`${FIRECRAWL_BASE_URL}/crawl/${crawlId}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })

      if (!statusResponse.ok) {
        console.error(`Firecrawl crawl poll failed: ${statusResponse.status} ${statusResponse.statusText}`)
        return { pages: [mainPage], mainPage }
      }

      const statusData = await statusResponse.json()

      if (statusData.status === 'completed') {
        // Collect up to 4 inner pages (excluding homepage)
        const rawPages: ScrapeResult[] = (statusData.data ?? [])
          .filter((p: { metadata?: { sourceURL?: string } }) => {
            const pageUrl: string = p.metadata?.sourceURL ?? ''
            return pageUrl !== url
          })
          .slice(0, 4)
          .map((p: {
            metadata?: { sourceURL?: string; title?: string; description?: string; ogImage?: string }
            markdown?: string
          }) => ({
            url: p.metadata?.sourceURL ?? '',
            markdown: p.markdown ?? '',
            metadata: {
              title: p.metadata?.title ?? '',
              description: p.metadata?.description ?? '',
              ogImage: p.metadata?.ogImage,
            },
          }))

        return {
          pages: [mainPage, ...rawPages],
          mainPage,
        }
      }

      if (statusData.status === 'failed' || statusData.status === 'cancelled') {
        console.error(`Firecrawl crawl ended with status: ${statusData.status}`)
        return { pages: [mainPage], mainPage }
      }

      // Still in progress — keep polling
    } catch (error) {
      console.error('Firecrawl crawl poll error:', error)
      return { pages: [mainPage], mainPage }
    }
  }

  // Timeout reached
  console.error(`Firecrawl crawl timed out after ${CRAWL_TIMEOUT_MS}ms for: ${url}`)
  return { pages: [mainPage], mainPage }
}
