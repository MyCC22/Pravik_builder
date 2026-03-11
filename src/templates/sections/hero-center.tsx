import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderHeroCenter(title: string, subtitle: string, t: ThemeClasses, ctaText?: string, ctaUrl = '#contact', heroImageUrl?: string): string {
  const hasImage = !!heroImageUrl

  const ctaHtml = ctaText
    ? `<div class="mt-10 flex items-center justify-center gap-x-6">
        <a href="${ctaUrl}" class="${hasImage ? 'bg-white text-slate-900 hover:bg-slate-100' : `${t.accentBg} ${t.accentBgHover} ${t.accentText}`} px-6 py-3.5 text-sm font-semibold rounded-xl shadow-sm transition-all duration-200">${escapeHtml(ctaText)}</a>
        <a href="#features" class="${hasImage ? 'text-white/80 hover:text-white' : `${t.textMuted} ${t.accentHover}`} text-sm font-semibold transition-colors">Learn more <span aria-hidden="true">&rarr;</span></a>
      </div>`
    : ''

  if (hasImage) {
    return `<section class="relative py-24 sm:py-32 overflow-hidden" style="background-image:url('${heroImageUrl}');background-size:cover;background-position:center">
  <div class="absolute inset-0 bg-black/50"></div>
  <div class="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center">
    <h1 class="text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">${escapeHtml(title)}</h1>
    <p class="mt-6 text-lg leading-8 text-white/80 sm:text-xl">${escapeHtml(subtitle)}</p>
    ${ctaHtml}
  </div>
</section>`
  }

  return `<section class="py-24 sm:py-32">
  <div class="max-w-4xl mx-auto px-6 lg:px-8 text-center">
    <h1 class="text-4xl font-extrabold tracking-tight ${t.text} sm:text-6xl lg:text-7xl">${escapeHtml(title)}</h1>
    <p class="mt-6 text-lg leading-8 ${t.textMuted} sm:text-xl">${escapeHtml(subtitle)}</p>
    ${ctaHtml}
  </div>
</section>`
}
