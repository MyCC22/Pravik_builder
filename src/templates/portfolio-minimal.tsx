import type { TemplateConfig } from './types'
import { renderNavbar } from './sections/navbar'
import { renderHeroSplit } from './sections/hero-split'
import { renderGalleryGrid } from './sections/gallery-grid'
import { renderContactSection } from './sections/contact-section'
import { renderFooter } from './sections/footer'

export function renderPortfolioMinimal(config: TemplateConfig): string {
  const { content } = config
  const navLinks = content.footerLinks || [
    { label: 'Work', href: '#work' },
    { label: 'About', href: '#about' },
    { label: 'Contact', href: '#contact' },
  ]

  let html = renderNavbar(content.siteName, navLinks)
  html += renderHeroSplit(content.heroTitle, content.heroSubtitle, content.tagline)

  if (content.galleryItems && content.galleryItems.length > 0) {
    html += `<div id="work">${renderGalleryGrid(content.galleryItems)}</div>`
  }

  html += renderContactSection(content.contactEmail || 'hello@example.com', content.contactPhone)
  html += renderFooter(content.siteName, navLinks)

  return html
}
