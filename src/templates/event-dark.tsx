import type { TemplateConfig } from './types'
import { getThemeClasses } from './theme-classes'
import { renderNavbar } from './sections/navbar'
import { renderHeroBold } from './sections/hero-bold'
import { renderStatsCounter } from './sections/stats-counter'
import { renderSpeakerBios } from './sections/speaker-bios'
import { renderSchedule } from './sections/schedule-agenda'
import { renderPricingCards } from './sections/pricing-cards'
import { renderFAQ } from './sections/faq-accordion'
import { renderCTABanner } from './sections/cta-banner'
import { renderFooter } from './sections/footer'

export function renderEventDark(config: TemplateConfig): string {
  const { content } = config
  const t = getThemeClasses(config.theme)
  const links = content.footerLinks || [
    { label: 'Speakers', href: '#speakers' },
    { label: 'Schedule', href: '#schedule' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ]

  const sections: string[] = [
    renderNavbar(content.siteName, links, t, content.ctaText, content.ctaUrl),
    renderHeroBold(content.heroTitle, content.heroSubtitle, t, content.ctaText, content.ctaUrl, content.heroImageUrl, content.tagline),
  ]

  if (content.stats?.length) sections.push(renderStatsCounter(content.stats, t))
  if (content.speakers?.length) sections.push(renderSpeakerBios(content.speakers, t))
  if (content.schedule?.length) sections.push(renderSchedule(content.schedule, t))
  if (content.pricing?.length) sections.push(renderPricingCards(content.pricing, t))
  if (content.faq?.length) sections.push(renderFAQ(content.faq, t))

  sections.push(renderCTABanner('Secure your spot today', content.tagline, t, content.ctaText, content.ctaUrl))
  sections.push(renderFooter(content.siteName, links, t))

  return sections.join('\n')
}
