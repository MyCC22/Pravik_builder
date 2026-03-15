import type { TemplateConfig } from './types'
import { getThemeClasses } from './theme-classes'
import { renderNavbar } from './sections/navbar'
import { renderHeroBold } from './sections/hero-bold'
import { renderClientLogos } from './sections/client-logos'
import { renderGalleryAsymmetric } from './sections/gallery-asymmetric'
import { renderProcessSteps } from './sections/process-steps'
import { renderTeamGrid } from './sections/team-grid'
import { renderTestimonials } from './sections/testimonials'
import { renderCTABanner } from './sections/cta-banner'
import { renderFooter } from './sections/footer'

export function renderAgencyEditorial(config: TemplateConfig): string {
  const { content } = config
  const t = getThemeClasses(config.theme)
  const links = content.footerLinks || [
    { label: 'Work', href: '#work' },
    { label: 'Process', href: '#process' },
    { label: 'Team', href: '#team' },
    { label: 'Contact', href: '#contact' },
  ]

  const sections: string[] = [
    renderNavbar(content.siteName, links, t, content.ctaText, content.ctaUrl),
    renderHeroBold(content.heroTitle, content.heroSubtitle, t, content.ctaText, content.ctaUrl, content.heroImageUrl, content.tagline),
  ]

  if (content.clients?.length) sections.push(renderClientLogos(content.clients, t))
  if (content.galleryItems?.length) sections.push(renderGalleryAsymmetric(content.galleryItems, t))
  if (content.process?.length) sections.push(renderProcessSteps(content.process, t))
  if (content.team?.length) sections.push(renderTeamGrid(content.team, t))
  if (content.testimonials?.length) sections.push(renderTestimonials(content.testimonials, t))

  sections.push(renderCTABanner('Ready to work together?', content.tagline, t, content.ctaText, content.ctaUrl))
  sections.push(renderFooter(content.siteName, links, t))

  return sections.join('\n')
}
