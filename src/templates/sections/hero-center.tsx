import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderHeroCenter(title: string, subtitle: string, t: ThemeClasses, ctaText?: string, ctaUrl = '#contact'): string {
  const ctaHtml = ctaText
    ? `<div class="mt-10 flex items-center justify-center gap-x-6">
        <a href="${ctaUrl}" class="${t.accentBg} ${t.accentBgHover} ${t.accentText} px-6 py-3.5 text-sm font-semibold rounded-xl shadow-sm transition-all duration-200">${escapeHtml(ctaText)}</a>
        <a href="#features" class="${t.textMuted} ${t.accentHover} text-sm font-semibold transition-colors">Learn more <span aria-hidden="true">&rarr;</span></a>
      </div>`
    : ''

  return `<section class="py-24 sm:py-32">
  <div class="max-w-4xl mx-auto px-6 lg:px-8 text-center">
    <h1 class="text-4xl font-extrabold tracking-tight ${t.text} sm:text-6xl lg:text-7xl">${escapeHtml(title)}</h1>
    <p class="mt-6 text-lg leading-8 ${t.textMuted} sm:text-xl">${escapeHtml(subtitle)}</p>
    ${ctaHtml}
  </div>
</section>`
}
