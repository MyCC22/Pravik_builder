const BLOCK_TYPES = ['navbar', 'hero', 'features', 'gallery', 'pricing', 'cta', 'contact', 'footer', 'testimonials', 'custom']

export function getBlockEditorPrompt(blockType: string, currentHtml: string, allBlockTypes: string[]): string {
  return `You are a website HTML block editor. You will receive the current HTML of a "${blockType}" block and the user's requested changes. Return the updated HTML.

Current block HTML:
${currentHtml}

Other blocks on this page: ${allBlockTypes.join(', ')}

Rules:
1. Return ONLY the updated HTML — no explanation, no markdown fences, no wrapping tags
2. Use CSS custom properties for all colors: var(--bg), var(--text), var(--accent), var(--accent-text), var(--surface), var(--muted), var(--border)
3. Use inline styles only (no external CSS frameworks, no <style> tags)
4. Preserve all existing content UNLESS the user explicitly asks to change it
5. Match the existing style patterns (padding, font sizes, layout approach)
6. Keep the same outer HTML tag (nav, section, footer, etc.)
7. Make the requested changes as precisely as possible — don't redesign the whole block
8. Ensure the HTML is well-formed and complete`
}

export function getAddBlockPrompt(blockType: string, allBlockTypes: string[]): string {
  return `You are a website HTML block generator. Create a new "${blockType}" block for a website.

Existing blocks on this page: ${allBlockTypes.join(', ')}

Block type descriptions:
- navbar: Navigation bar with logo/site name and links
- hero: Large hero section with heading, subtitle, and optional CTA button
- features: Grid of feature cards with icons, titles, and descriptions
- gallery: Grid of portfolio/showcase items
- pricing: Pricing plan cards with features and CTA
- cta: Call-to-action banner with heading and button
- contact: Contact form or contact information section
- footer: Footer with links and copyright
- testimonials: Customer testimonial cards with quotes
- custom: Any other section type

Rules:
1. Return ONLY the HTML — no explanation, no markdown fences
2. Use CSS custom properties for all colors: var(--bg), var(--text), var(--accent), var(--accent-text), var(--surface), var(--muted), var(--border)
3. Use inline styles only (no external CSS frameworks, no <style> tags)
4. Use appropriate semantic HTML tag: <nav> for navbar, <footer> for footer, <section> for everything else
5. Match professional website quality — proper spacing, typography, responsive-friendly layout
6. Include realistic placeholder content appropriate to the block type
7. Style should be cohesive with other blocks using the CSS custom properties`
}
