import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderCTABanner(title: string, subtitle: string, t: ThemeClasses, ctaText?: string, ctaUrl = '#contact'): string {
  const btnHtml = ctaText
    ? `<a href="${ctaUrl}" class="${t.accentBg} ${t.accentBgHover} ${t.accentText} px-8 py-4 text-base font-semibold rounded-xl shadow-lg transition-all duration-200">${escapeHtml(ctaText)}</a>`
    : ''

  return `<section id="cta" class="py-24 sm:py-32">
  <div class="max-w-4xl mx-auto px-6 lg:px-8 text-center">
    <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">${escapeHtml(title)}</h2>
    <p class="mt-4 text-lg leading-8 ${t.textMuted}">${escapeHtml(subtitle)}</p>
    ${btnHtml ? `<div class="mt-10">${btnHtml}</div>` : ''}
  </div>
</section>`
}
