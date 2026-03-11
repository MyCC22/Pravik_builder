import type { TemplateConfig } from './types'
import { getThemeClasses } from './theme-classes'
import { renderNavbar } from './sections/navbar'
import { renderHeroCenter } from './sections/hero-center'
import { renderFeaturesGrid } from './sections/features-grid'
import { renderStatsCounter } from './sections/stats-counter'
import { renderTestimonials } from './sections/testimonials'
import { renderPricingCards } from './sections/pricing-cards'
import { renderCTABanner } from './sections/cta-banner'
import { renderFooter } from './sections/footer'

export function renderLanding(config: TemplateConfig): string {
  const { content } = config
  const t = getThemeClasses(config.theme)
  const links = content.footerLinks || [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Contact', href: '#contact' },
  ]

  const sections: string[] = [
    renderNavbar(content.siteName, links, t),
    renderHeroCenter(content.heroTitle, content.heroSubtitle, t, content.ctaText, content.ctaUrl, content.heroImageUrl),
  ]

  if (content.features?.length) sections.push(renderFeaturesGrid(content.features, t))
  if (content.stats?.length) sections.push(renderStatsCounter(content.stats, t))
  if (content.testimonials?.length) sections.push(renderTestimonials(content.testimonials, t))
  if (content.pricing?.length) sections.push(renderPricingCards(content.pricing, t))

  sections.push(renderCTABanner('Ready to get started?', content.tagline, t, content.ctaText, content.ctaUrl))
  sections.push(renderFooter(content.siteName, links, t))

  return sections.join('\n')
}
