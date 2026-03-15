import type { Feature } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml, getSvgIcon } from '../utils'

export function renderFeaturesGrid(features: Feature[], t: ThemeClasses, heading = 'Everything you need', subheading = 'Built with the tools and features your business needs to succeed.'): string {
  const cards = features.map(f =>
    `<div class="animate-on-scroll ${t.surface} ${t.border} rounded-3xl p-10 transition-all duration-300 ${t.cardShadow}">
      <div class="w-14 h-14 rounded-2xl ${t.accentBgLight} ${t.accent} flex items-center justify-center mb-6">${getSvgIcon(f.icon)}</div>
      <h3 class="text-xl font-semibold ${t.text}">${escapeHtml(f.title)}</h3>
      <p class="mt-3 text-sm leading-7 ${t.textMuted}">${escapeHtml(f.description)}</p>
    </div>`
  ).join('')

  return `<section id="features" class="py-24 sm:py-32">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">${escapeHtml(heading)}</h2>
      <p class="mt-4 text-lg leading-8 ${t.textMuted}">${escapeHtml(subheading)}</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">${cards}</div>
  </div>
</section>`
}
