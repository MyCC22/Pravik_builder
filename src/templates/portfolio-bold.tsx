import type { TemplateConfig } from './types'
import { renderNavbar } from './sections/navbar'
import { renderHeroBold } from './sections/hero-bold'
import { renderGalleryAsymmetric } from './sections/gallery-asymmetric'
import { renderContactSection } from './sections/contact-section'
import { renderFooter } from './sections/footer'

export function renderPortfolioBold(config: TemplateConfig): string {
  const { content } = config
  const navLinks = content.footerLinks || [
    { label: 'Projects', href: '#work' },
    { label: 'About', href: '#about' },
    { label: 'Contact', href: '#contact' },
  ]

  let html = renderNavbar(content.siteName, navLinks)
  html += renderHeroBold(content.heroTitle, content.heroSubtitle)

  if (content.galleryItems && content.galleryItems.length > 0) {
    html += `<div id="work">${renderGalleryAsymmetric(content.galleryItems)}</div>`
  }

  html += renderContactSection(content.contactEmail || 'hello@example.com', content.contactPhone)
  html += renderFooter(content.siteName, navLinks)

  return html
}
