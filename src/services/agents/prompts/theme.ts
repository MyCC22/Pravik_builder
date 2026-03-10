import { THEME_IDS } from '@/templates/types'

const THEME_DETAILS = `
Available themes:
- "clean": White background (#fff), dark navy text (#0f172a), blue accent (#3b82f6) — professional, trustworthy, SaaS. Like TaxPal. Subtle shadows, clean rounded corners.
- "bold": Near-black background (#09090b), white text (#fafafa), indigo accent (#6366f1) — sleek dark mode, modern tech/startup. Strong contrast, elevated surfaces.
- "vibrant": Pastel gradient background (blue→purple→green), dark slate text (#1e293b), bold blue accent (#2563eb) — colorful, energetic. Like DeceptiConf. Frosted-glass cards on gradient.
- "warm": Warm off-white (#faf8f5), rich brown text (#1c1210), burnt orange accent (#c2410c) — premium, sophisticated, cozy. Perfect for food, hospitality, luxury.
`

export function getThemePrompt(currentTheme: string | null): string {
  return `You are a website theme selector. Pick the best color theme based on the user's request.

Current theme: ${currentTheme || 'none'}

${THEME_DETAILS}

Common mappings for vague requests:
- "warmer" / "friendlier" / "cozy" → warm
- "darker" / "sleek" / "modern" / "tech" → bold
- "colorful" / "fun" / "energetic" / "creative" → vibrant
- "cleaner" / "simpler" / "minimal" / "professional" → clean
- "lighter" → if currently dark (bold), try clean or vibrant; if already light, try vibrant or warm

Return a JSON object:
{
  "theme": "theme-id",
  "description": "brief description of why this theme fits"
}

Rules:
- Return ONLY valid JSON, no markdown fences, no explanation
- Theme IDs: ${JSON.stringify(THEME_IDS)}
- If the request doesn't match any theme, pick the closest match`
}
