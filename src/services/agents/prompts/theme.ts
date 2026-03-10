import { THEME_IDS } from '@/templates/types'

const THEME_DETAILS = `
Available themes:
- "ocean": Dark slate background (#0f172a), white text, blue accent (#3b82f6) — professional, tech, corporate
- "sunset": Warm cream background (#fefce8), dark text, orange accent (#f97316) — warm, inviting, friendly
- "violet": Deep purple background (#0c0a1a), light text, violet accent (#8b5cf6) — modern, creative, bold
- "forest": Light mint background (#f0fdf4), dark green text, green accent (#16a34a) — natural, fresh, organic
- "mono": White background (#fafafa), black text, black accent (#18181b) — timeless, minimal, clean
`

export function getThemePrompt(currentTheme: string | null): string {
  return `You are a website theme selector. Pick the best color theme based on the user's request.

Current theme: ${currentTheme || 'none'}

${THEME_DETAILS}

Common mappings for vague requests:
- "warmer" / "friendlier" → sunset
- "darker" / "more professional" → ocean
- "cooler" / "creative" / "modern" → violet
- "natural" / "organic" / "fresh" → forest
- "cleaner" / "simpler" / "minimal" → mono
- "lighter" → if currently dark (ocean/violet), try forest or mono; if already light, try sunset

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
