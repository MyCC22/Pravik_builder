import type { TemplateConfig } from './types'
import { getThemeClasses } from './theme-classes'
import { renderNavbar } from './sections/navbar'
import { renderHeroSplit } from './sections/hero-split'
import { renderMenuDisplay } from './sections/menu-display'
import { renderGalleryGrid } from './sections/gallery-grid'
import { renderTestimonials } from './sections/testimonials'
import { renderHoursLocation } from './sections/hours-location'
import { renderBookingCTA } from './sections/booking-cta'
import { renderFooter } from './sections/footer'

export function renderRestaurant(config: TemplateConfig): string {
  const { content } = config
  const t = getThemeClasses(config.theme)
  const links = content.footerLinks || [
    { label: 'Menu', href: '#menu' },
    { label: 'Gallery', href: '#gallery' },
    { label: 'Hours', href: '#hours' },
    { label: 'Contact', href: '#contact' },
  ]

  const sections: string[] = [
    renderNavbar(content.siteName, links, t, content.ctaText, content.ctaUrl),
    renderHeroSplit(content.heroTitle, content.heroSubtitle, t, content.tagline, content.ctaText, content.ctaUrl, content.heroImageUrl),
  ]

  if (content.menuItems?.length) sections.push(renderMenuDisplay(content.menuItems, t))
  if (content.galleryItems?.length) sections.push(renderGalleryGrid(content.galleryItems, t))
  if (content.testimonials?.length) sections.push(renderTestimonials(content.testimonials, t))
  if (content.hours?.length) sections.push(renderHoursLocation(content.hours, t, content.address))

  sections.push(renderBookingCTA(t, content.bookingText, content.bookingUrl, content.bookingHeading, content.bookingSubheading))
  sections.push(renderFooter(content.siteName, links, t))

  return sections.join('\n')
}
