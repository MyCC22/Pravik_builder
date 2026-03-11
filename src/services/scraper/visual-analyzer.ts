import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

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

const SYSTEM_PROMPT = `You are a visual design analyst. Analyze the provided website screenshot and return structured design intelligence as valid JSON only — no markdown fences, no extra text.

Definitions:
- heroStyle: "center" = text centered over image; "split" = text and image side by side; "bold" = oversized dramatic typography dominating the hero
- colors.background: "light" = white or light-colored background; "dark" = dark or black background
- colors.mood: "clean" = white/light minimal feel; "bold" = dark/high-contrast; "vibrant" = colorful/saturated; "warm" = earthy/warm tones
- typography.style: "modern" = sans-serif geometric; "classic" = serif/traditional; "playful" = varied/expressive; "minimal" = sparse/understated
- typography.weight: "light" = thin/light fonts; "regular" = normal weight; "bold" = heavy/black weight fonts

Available template IDs: landing, landing-bold, services, services-bold, restaurant, restaurant-dark, agency, agency-editorial, event, event-dark
Available theme IDs: clean, bold, vibrant, warm

Return ONLY valid JSON matching this exact structure:
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
  "recommendedTemplate": string,
  "recommendedTheme": string
}`

export async function analyzeScreenshot(
  screenshotBase64: string
): Promise<VisualAnalysis | null> {
  try {
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
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
              text: 'Analyze this website screenshot and return the visual design intelligence as JSON.',
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
    console.error('Visual analyzer error:', error)
    return null
  }
}
