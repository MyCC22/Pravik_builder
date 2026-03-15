import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderHeroCenter(title: string, subtitle: string, t: ThemeClasses, ctaText?: string, ctaUrl = '#contact', heroImageUrl?: string, tagline?: string): string {
  const hasImage = !!heroImageUrl

  const taglineHtml = tagline
    ? `<span class="inline-block ${t.taglineBg} px-4 py-1.5 rounded-full text-sm font-semibold mb-6">${escapeHtml(tagline)}</span>`
    : ''

  // Both image and gradient heroes use light-on-dark styling
  const ctaHtml = ctaText
    ? `<div class="mt-10 flex items-center justify-center gap-x-6">
        <a href="${escapeHtml(ctaUrl)}" class="bg-white text-slate-900 hover:bg-slate-100 px-8 py-4 text-base font-semibold rounded-full shadow-lg transition-all duration-200">${escapeHtml(ctaText)}</a>
        <a href="#features" class="text-white/80 hover:text-white text-sm font-semibold transition-colors">Learn more <span aria-hidden="true">&rarr;</span></a>
      </div>`
    : ''

  if (hasImage) {
    return `<section class="relative py-32 sm:py-44 overflow-hidden" style="background-image:url('${heroImageUrl}');background-size:cover;background-position:center">
  <div class="absolute inset-0 bg-black/50"></div>
  <div class="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center">
    ${taglineHtml}
    <h1 class="text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">${escapeHtml(title)}</h1>
    <p class="mt-6 text-lg leading-8 text-white/80 sm:text-xl">${escapeHtml(subtitle)}</p>
    ${ctaHtml}
  </div>
</section>`
  }

  // No image available — use a modern gradient background for visual impact
  return `<section class="relative py-32 sm:py-44 overflow-hidden ${t.heroGradient}">
  <div class="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center">
    ${taglineHtml}
    <h1 class="text-4xl font-extrabold tracking-tight ${t.heroGradientText} sm:text-6xl lg:text-7xl">${escapeHtml(title)}</h1>
    <p class="mt-6 text-lg leading-8 ${t.heroGradientTextMuted} sm:text-xl">${escapeHtml(subtitle)}</p>
    ${ctaHtml}
  </div>
</section>`
}
