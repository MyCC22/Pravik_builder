import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderHeroSplit(title: string, subtitle: string, t: ThemeClasses, tagline?: string, ctaText?: string, ctaUrl = '#contact', heroImageUrl?: string): string {
  const taglineHtml = tagline
    ? `<p class="text-sm font-semibold ${t.accent} tracking-wide uppercase">${escapeHtml(tagline)}</p>`
    : ''
  const ctaHtml = ctaText
    ? `<div class="mt-10">
        <a href="${ctaUrl}" class="${t.accentBg} ${t.accentBgHover} ${t.accentText} px-6 py-3.5 text-sm font-semibold rounded-xl shadow-sm transition-all duration-200">${escapeHtml(ctaText)}</a>
      </div>`
    : ''

  const imageHtml = heroImageUrl
    ? `<img src="${heroImageUrl}" alt="${escapeHtml(title)}" class="w-full h-full object-cover" loading="eager" />`
    : `<svg class="w-16 h-16 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"/></svg>`

  const imageBgClass = heroImageUrl
    ? ''
    : `${t.heroGradient} flex items-center justify-center`

  return `<section class="py-24 sm:py-32">
  <div class="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
    <div>
      ${taglineHtml}
      <h1 class="mt-4 text-4xl font-extrabold tracking-tight ${t.text} sm:text-5xl lg:text-6xl">${escapeHtml(title)}</h1>
      <p class="mt-6 text-lg leading-8 ${t.textMuted}">${escapeHtml(subtitle)}</p>
      ${ctaHtml}
    </div>
    <div class="relative">
      <div class="aspect-[4/3] rounded-2xl ${imageBgClass} ${t.border} overflow-hidden">
        ${imageHtml}
      </div>
    </div>
  </div>
</section>`
}
