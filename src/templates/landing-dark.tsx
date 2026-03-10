import type { TemplateConfig } from './types'
import { renderNavbar } from './sections/navbar'
import { renderHeroCenter } from './sections/hero-center'
import { renderFeaturesGrid } from './sections/features-grid'
import { renderTestimonials } from './sections/testimonials'
import { renderPricingCards } from './sections/pricing-cards'
import { renderCTABanner } from './sections/cta-banner'
import { renderFooter } from './sections/footer'

export function renderLandingDark(config: TemplateConfig): string {
  const { content } = config
  const navLinks = content.footerLinks || [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Contact', href: '#contact' },
  ]

  let html = renderNavbar(content.siteName, navLinks)
  html += renderHeroCenter(content.heroTitle, content.heroSubtitle, content.ctaText, content.ctaUrl)

  if (content.features && content.features.length > 0) {
    html += `<div id="features">${renderFeaturesGrid(content.features)}</div>`
  }
  if (content.testimonials && content.testimonials.length > 0) {
    html += renderTestimonials(content.testimonials)
  }
  if (content.pricing && content.pricing.length > 0) {
    html += `<div id="pricing">${renderPricingCards(content.pricing)}</div>`
  }

  html += renderCTABanner('Ready to get started?', content.tagline, content.ctaText || 'Get Started')
  html += renderFooter(content.siteName, navLinks)

  return html
}
