import type { TemplateConfig, TemplateId } from './types'
import { getThemeCSS } from './themes'
import { renderLandingLight } from './landing-light'
import { renderLandingDark } from './landing-dark'
import { renderPortfolioMinimal } from './portfolio-minimal'
import { renderPortfolioBold } from './portfolio-bold'

const templateMap: Record<TemplateId, (config: TemplateConfig) => string> = {
  'landing-light': renderLandingLight,
  'landing-dark': renderLandingDark,
  'portfolio-minimal': renderPortfolioMinimal,
  'portfolio-bold': renderPortfolioBold,
}

export function renderTemplate(config: TemplateConfig): string {
  const render = templateMap[config.template]
  if (!render) {
    throw new Error(`Unknown template: ${config.template}`)
  }

  const bodyHtml = render(config)
  const themeCSS = getThemeCSS(config.theme)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(config.content.siteName)}</title>
  <style>${themeCSS}</style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
