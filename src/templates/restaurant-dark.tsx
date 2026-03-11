import type { TemplateConfig } from './types'
import { getThemeClasses } from './theme-classes'
import { renderNavbar } from './sections/navbar'
import { renderHeroBold } from './sections/hero-bold'
import { renderMenuDisplay } from './sections/menu-display'
import { renderGalleryAsymmetric } from './sections/gallery-asymmetric'
import { renderTestimonials } from './sections/testimonials'
import { renderHoursLocation } from './sections/hours-location'
import { renderBookingCTA } from './sections/booking-cta'
import { renderFooter } from './sections/footer'

export function renderRestaurantDark(config: TemplateConfig): string {
  const { content } = config
  const t = getThemeClasses(config.theme)
  const links = content.footerLinks || [
    { label: 'Menu', href: '#menu' },
    { label: 'Hours', href: '#hours' },
    { label: 'Contact', href: '#contact' },
  ]

  const sections: string[] = [
    renderNavbar(content.siteName, links, t),
    renderHeroBold(content.heroTitle, content.heroSubtitle, t, content.ctaText, content.ctaUrl),
  ]

  if (content.menuItems?.length) sections.push(renderMenuDisplay(content.menuItems, t))
  if (content.galleryItems?.length) sections.push(renderGalleryAsymmetric(content.galleryItems, t))
  if (content.testimonials?.length) sections.push(renderTestimonials(content.testimonials, t))
  if (content.hours?.length) sections.push(renderHoursLocation(content.hours, t, content.address))

  sections.push(renderBookingCTA(t, content.bookingText, content.bookingUrl))
  sections.push(renderFooter(content.siteName, links, t))

  return sections.join('\n')
}
