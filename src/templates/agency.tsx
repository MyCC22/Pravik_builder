import type { TemplateConfig } from './types'
import { getThemeClasses } from './theme-classes'
import { renderNavbar } from './sections/navbar'
import { renderHeroSplit } from './sections/hero-split'
import { renderClientLogos } from './sections/client-logos'
import { renderFeaturesGrid } from './sections/features-grid'
import { renderGalleryGrid } from './sections/gallery-grid'
import { renderProcessSteps } from './sections/process-steps'
import { renderTeamGrid } from './sections/team-grid'
import { renderTestimonials } from './sections/testimonials'
import { renderCTABanner } from './sections/cta-banner'
import { renderFooter } from './sections/footer'
import { renderHeroForm } from './sections/hero-form'

export function renderAgency(config: TemplateConfig): string {
  const { content } = config
  const t = getThemeClasses(config.theme)
  const heroFormHtml = config.heroToolId && config.heroFormFields
    ? renderHeroForm(config.heroToolId, config.heroFormFields, t,
        content.heroFormSubmitText, content.heroFormSuccessMessage, content.heroFormTitle)
    : undefined
  const links = content.footerLinks || [
    { label: 'Work', href: '#work' },
    { label: 'Process', href: '#process' },
    { label: 'Team', href: '#team' },
    { label: 'Contact', href: '#contact' },
  ]

  const sections: string[] = [
    renderNavbar(content.siteName, links, t, content.ctaText, content.ctaUrl),
    renderHeroSplit(content.heroTitle, content.heroSubtitle, t, content.tagline, content.ctaText, content.ctaUrl, content.heroImageUrl, heroFormHtml),
  ]

  if (content.clients?.length) sections.push(renderClientLogos(content.clients, t))
  if (content.features?.length) sections.push(renderFeaturesGrid(content.features, t, content.featuresHeading, content.featuresSubheading))
  if (content.galleryItems?.length) sections.push(renderGalleryGrid(content.galleryItems, t))
  if (content.process?.length) sections.push(renderProcessSteps(content.process, t))
  if (content.team?.length) sections.push(renderTeamGrid(content.team, t))
  if (content.testimonials?.length) sections.push(renderTestimonials(content.testimonials, t))

  sections.push(renderCTABanner('Ready to work together?', content.tagline, t, content.ctaText, content.ctaUrl))
  sections.push(renderFooter(content.siteName, links, t))

  return sections.join('\n')
}
