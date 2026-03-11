import type { TemplateConfig } from './types'
import { getThemeClasses } from './theme-classes'
import { renderNavbar } from './sections/navbar'
import { renderHeroBold } from './sections/hero-bold'
import { renderServiceCards } from './sections/service-cards'
import { renderBeforeAfter } from './sections/before-after'
import { renderStatsCounter } from './sections/stats-counter'
import { renderTestimonials } from './sections/testimonials'
import { renderFAQ } from './sections/faq-accordion'
import { renderBookingCTA } from './sections/booking-cta'
import { renderContactSection } from './sections/contact-section'
import { renderFooter } from './sections/footer'

export function renderServicesBold(config: TemplateConfig): string {
  const { content } = config
  const t = getThemeClasses(config.theme)
  const links = content.footerLinks || [
    { label: 'Services', href: '#services' },
    { label: 'Process', href: '#process' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ]

  const sections: string[] = [
    renderNavbar(content.siteName, links, t),
    renderHeroBold(content.heroTitle, content.heroSubtitle, t, content.ctaText, content.ctaUrl),
  ]

  if (content.services?.length) sections.push(renderServiceCards(content.services, t))
  if (content.beforeAfter?.length) sections.push(renderBeforeAfter(content.beforeAfter, t))
  if (content.stats?.length) sections.push(renderStatsCounter(content.stats, t))
  if (content.testimonials?.length) sections.push(renderTestimonials(content.testimonials, t))
  if (content.faq?.length) sections.push(renderFAQ(content.faq, t))

  sections.push(renderBookingCTA(t, content.bookingText, content.bookingUrl))
  sections.push(renderContactSection(t, content.contactEmail, content.contactPhone, content.address))
  sections.push(renderFooter(content.siteName, links, t))

  return sections.join('\n')
}
