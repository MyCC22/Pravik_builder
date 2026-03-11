const TAILWIND_SECTION_TYPES = `
Section types (24 total):
- navbar: Sticky navigation with logo and links, frosted glass effect
- hero: Large hero section (center, split, or bold variant)
- features: Feature cards in responsive grid
- testimonials: Quote cards with avatar placeholders
- pricing: Pricing cards with highlighted plan
- cta: Call-to-action banner
- gallery: Image gallery (grid or asymmetric)
- contact: Contact information with icon cards
- footer: Footer with links and copyright
- services: Service offering cards with icons
- process: Numbered timeline steps ("How it works")
- team: Team member grid with avatar placeholders
- clients: Client logo row
- faq: FAQ accordion with details/summary
- menu: Restaurant menu with categories and prices
- hours: Hours table and location info
- booking: Prominent booking CTA with accent background
- schedule: Event schedule/agenda timeline
- speakers: Speaker bio cards
- stats: Large number statistics
- before-after: Side-by-side comparison cards
- custom: Any other section type
`

function detectStylingSystem(html: string): 'tailwind' | 'legacy' {
  // Check for Tailwind utility class patterns
  const tailwindPatterns = /class="[^"]*(?:text-|bg-|rounded-|px-|py-|flex|grid|max-w-|shadow-|ring-|border-)/
  if (tailwindPatterns.test(html)) return 'tailwind'
  return 'legacy'
}

export function getBlockEditorPrompt(blockType: string, currentHtml: string, allBlockTypes: string[]): string {
  const system = detectStylingSystem(currentHtml)

  if (system === 'tailwind') {
    return `You are a website HTML block editor. You will receive the current HTML of a "${blockType}" block and the user's requested changes. Return the updated HTML.

Current block HTML:
${currentHtml}

Other blocks on this page: ${allBlockTypes.join(', ')}

${TAILWIND_SECTION_TYPES}

Rules:
1. Return ONLY the updated HTML — no explanation, no markdown fences
2. Use Tailwind CSS utility classes for ALL styling (the page loads Tailwind CDN)
3. Preserve all existing Tailwind classes and patterns UNLESS the user explicitly asks to change them
4. Use the same ThemeClasses pattern: text-slate-900 for text, bg-blue-600 for accent buttons, etc.
5. Preserve all existing content UNLESS the user explicitly asks to change it
6. Keep the same outer HTML tag (nav, section, footer, etc.)
7. Make the requested changes as precisely as possible — don't redesign the whole block
8. Quality standards: tracking-tight on headings, leading-relaxed on body text, rounded-2xl on cards, ring-1 for borders, transition-all duration-200 on interactive elements
9. Responsive: use grid-cols-1 md:grid-cols-2 lg:grid-cols-3
10. Use Inter font (loaded in head), max-w-7xl mx-auto px-6 lg:px-8 for content width`
  }

  // Legacy inline-style system
  return `You are a website HTML block editor. You will receive the current HTML of a "${blockType}" block and the user's requested changes. Return the updated HTML.

Current block HTML:
${currentHtml}

Other blocks on this page: ${allBlockTypes.join(', ')}

Rules:
1. Return ONLY the updated HTML — no explanation, no markdown fences, no wrapping tags
2. Use CSS custom properties for all colors: var(--bg), var(--text), var(--accent), var(--accent-hover), var(--accent-text), var(--surface), var(--muted), var(--border)
3. Use inline styles only (no external CSS frameworks, no <style> tags)
4. Preserve all existing content UNLESS the user explicitly asks to change it
5. Match the existing style patterns (padding, font sizes, layout approach)
6. Keep the same outer HTML tag (nav, section, footer, etc.)
7. Make the requested changes as precisely as possible — don't redesign the whole block
8. Ensure the HTML is well-formed and complete
9. Use the Inter font family (loaded in <head>)
10. Use rem units for sizing. Use clamp() for responsive headings.
11. Use generous spacing (padding: 6rem 2rem for sections, 1.5rem gaps in grids)
12. Cards should have border-radius: 0.75rem, subtle borders, and optional box-shadow
13. Buttons: padding 0.75rem 2rem, border-radius 0.5rem, font-weight 600`
}

export function getAddBlockPrompt(blockType: string, allBlockTypes: string[]): string {
  return `You are a website HTML block generator. Create a new "${blockType}" block that uses Tailwind CSS utility classes.

Existing blocks on this page: ${allBlockTypes.join(', ')}

${TAILWIND_SECTION_TYPES}

Rules:
1. Return ONLY the HTML — no explanation, no markdown fences
2. Use Tailwind CSS utility classes for ALL styling (the page loads Tailwind CDN)
3. Use appropriate semantic HTML: <nav> for navbar, <footer> for footer, <section> for everything else
4. Quality standards: tracking-tight on headings, leading-relaxed on body text, rounded-2xl on cards
5. Use ring-1 ring-slate-200 for card borders (not solid borders)
6. shadow-sm on cards, shadow-lg on elevated elements
7. transition-all duration-200 on interactive/hoverable elements
8. Responsive grids: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
9. Content width: max-w-7xl mx-auto px-6 lg:px-8
10. Generous padding: py-24 sm:py-32 on sections
11. Include realistic placeholder content appropriate to the block type
12. Use Inter font family. Match Tailwind Plus quality — professional, polished, spacious.
13. Color classes: text-slate-900 for text, text-slate-500 for muted, bg-blue-600 for accent buttons, bg-slate-50 for surfaces`
}
