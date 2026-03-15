import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderHeroBold(title: string, subtitle: string, t: ThemeClasses, ctaText?: string, ctaUrl = '#contact', heroImageUrl?: string, tagline?: string, heroFormHtml?: string): string {
  const hasImage = !!heroImageUrl

  const taglineHtml = tagline
    ? `<span class="inline-block bg-white/15 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-semibold mb-6">${escapeHtml(tagline)}</span>`
    : ''

  // Both image and gradient heroes use light-on-dark styling
  const ctaHtml = ctaText && !heroFormHtml
    ? `<div class="mt-10 flex items-center justify-center gap-x-6">
        <a href="${escapeHtml(ctaUrl)}" class="bg-white text-slate-900 hover:bg-slate-100 px-8 py-4 text-base font-semibold rounded-full shadow-lg transition-all duration-200">${escapeHtml(ctaText)}</a>
      </div>`
    : ''

  // Decorative gradient orbs for visual depth
  const orbsHtml = `<div class="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
    <div class="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>`

  if (hasImage) {
    return `<section class="relative py-36 sm:py-48 overflow-hidden" style="background-image:url('${heroImageUrl}');background-size:cover;background-position:center">
  <div class="absolute inset-0 bg-black/50"></div>
  <div class="relative z-10 max-w-5xl mx-auto px-6 lg:px-8 text-center">
    ${taglineHtml}
    <h1 class="text-5xl font-black tracking-tight text-white sm:text-7xl lg:text-8xl leading-[0.9]">${escapeHtml(title)}</h1>
    <p class="mt-8 text-xl leading-8 text-white/80 max-w-2xl mx-auto">${escapeHtml(subtitle)}</p>
    ${ctaHtml}
  </div>
  ${heroFormHtml || ''}
</section>`
  }

  // No image available — use a modern gradient background with decorative orbs
  const gradientTaglineHtml = tagline
    ? `<span class="inline-block ${t.taglineBg} px-3 py-1 rounded-full text-xs font-semibold mb-6">${escapeHtml(tagline)}</span>`
    : ''

  return `<section class="relative py-36 sm:py-48 overflow-hidden ${t.heroGradient}">
  ${orbsHtml}
  <div class="relative z-10 max-w-5xl mx-auto px-6 lg:px-8 text-center">
    ${gradientTaglineHtml}
    <h1 class="text-5xl font-black tracking-tight ${t.heroGradientText} sm:text-7xl lg:text-8xl leading-[0.9]">${escapeHtml(title)}</h1>
    <p class="mt-8 text-xl leading-8 ${t.heroGradientTextMuted} max-w-2xl mx-auto">${escapeHtml(subtitle)}</p>
    ${ctaHtml}
  </div>
  ${heroFormHtml || ''}
</section>`
}
