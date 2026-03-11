import type { TemplateConfig, TemplateId } from './types'
import { resolveTemplateId } from './types'
import { getThemeClasses } from './theme-classes'
import { renderLanding } from './landing'
import { renderLandingBold } from './landing-bold'
import { renderServices } from './services'
import { renderServicesBold } from './services-bold'
import { renderRestaurant } from './restaurant'
import { renderRestaurantDark } from './restaurant-dark'
import { renderAgency } from './agency'
import { renderAgencyEditorial } from './agency-editorial'
import { renderEvent } from './event'
import { renderEventDark } from './event-dark'

export { escapeHtml } from './utils'

const templateMap: Record<TemplateId, (config: TemplateConfig) => string> = {
  'landing': renderLanding,
  'landing-bold': renderLandingBold,
  'services': renderServices,
  'services-bold': renderServicesBold,
  'restaurant': renderRestaurant,
  'restaurant-dark': renderRestaurantDark,
  'agency': renderAgency,
  'agency-editorial': renderAgencyEditorial,
  'event': renderEvent,
  'event-dark': renderEventDark,
}

export function renderTemplate(config: TemplateConfig): string {
  const templateId = resolveTemplateId(config.template)
  const render = templateMap[templateId]
  if (!render) {
    throw new Error(`Unknown template: ${templateId}`)
  }

  const bodyHtml = render({ ...config, template: templateId })
  const t = getThemeClasses(config.theme)

  return renderTailwindShell(config.content.siteName, t.bg, bodyHtml)
}

export function renderTailwindShell(title: string, bgClass: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, sans-serif; }
    html { scroll-behavior: smooth; }
  </style>
</head>
<body class="${bgClass} antialiased">
${bodyHtml}
</body>
</html>`
}
