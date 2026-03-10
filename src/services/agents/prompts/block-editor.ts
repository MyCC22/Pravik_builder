export function getBlockEditorPrompt(blockType: string, currentHtml: string, allBlockTypes: string[]): string {
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
10. Use rem units for sizing (1rem = 16px). Use clamp() for responsive headings.
11. Use generous spacing (padding: 6rem 2rem for sections, 1.5rem gaps in grids)
12. Cards should have border-radius: 0.75rem, subtle borders, and optional box-shadow
13. Buttons: padding 0.75rem 2rem, border-radius 0.5rem, font-weight 600, box-shadow 0 1px 3px rgba(0,0,0,0.1)`
}

export function getAddBlockPrompt(blockType: string, allBlockTypes: string[]): string {
  return `You are a website HTML block generator. Create a new "${blockType}" block for a website that looks like a Tailwind UI component.

Existing blocks on this page: ${allBlockTypes.join(', ')}

Block type descriptions:
- navbar: Sticky navigation with logo/site name and links, backdrop-blur background
- hero: Large hero section with clamp() heading (2.5rem to 3.75rem), subtitle, paired CTA buttons (primary solid + secondary text link with arrow)
- features: Section heading + grid of feature cards with colored icon badges, titles, and descriptions
- gallery: Grid of portfolio items with colored gradient placeholders and labels
- pricing: Section heading + pricing cards with checkmark feature lists, highlighted "Most popular" card
- cta: Call-to-action section with rounded background, large heading, and button
- contact: Contact info with icon badges for email/phone/address
- footer: Clean footer with centered nav links and copyright
- testimonials: Section heading + testimonial cards with star ratings and avatar initials
- custom: Any other section type

Rules:
1. Return ONLY the HTML — no explanation, no markdown fences
2. Use CSS custom properties for colors: var(--bg), var(--text), var(--accent), var(--accent-hover), var(--accent-text), var(--surface), var(--muted), var(--border)
3. Use inline styles only (no external CSS frameworks, no <style> tags)
4. Use appropriate semantic HTML: <nav> for navbar, <footer> for footer, <section> for everything else
5. Use the Inter font family. Use rem units, clamp() for headings, generous spacing.
6. Cards: border-radius 0.75rem, 1px solid var(--border), padding 1.75-2rem
7. Buttons: border-radius 0.5rem, padding 0.75rem 2rem, font-weight 600, box-shadow
8. Max-width 1100px with margin:0 auto for content containers
9. Include realistic placeholder content appropriate to the block type
10. Match Tailwind UI quality — professional, polished, spacious`
}
