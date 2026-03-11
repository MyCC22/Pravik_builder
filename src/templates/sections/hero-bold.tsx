import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderHeroBold(title: string, subtitle: string, t: ThemeClasses, ctaText?: string, ctaUrl = '#contact'): string {
  const ctaHtml = ctaText
    ? `<div class="mt-10 flex items-center justify-center gap-x-6">
        <a href="${ctaUrl}" class="${t.accentBg} ${t.accentBgHover} ${t.accentText} px-8 py-4 text-base font-semibold rounded-xl shadow-lg transition-all duration-200">${escapeHtml(ctaText)}</a>
      </div>`
    : ''

  return `<section class="py-32 sm:py-40">
  <div class="max-w-5xl mx-auto px-6 lg:px-8 text-center">
    <h1 class="text-5xl font-black tracking-tight ${t.text} sm:text-7xl lg:text-8xl leading-[0.9]">${escapeHtml(title)}</h1>
    <p class="mt-8 text-xl leading-8 ${t.textMuted} max-w-2xl mx-auto">${escapeHtml(subtitle)}</p>
    ${ctaHtml}
  </div>
</section>`
}
