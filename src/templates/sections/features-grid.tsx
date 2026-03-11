import type { Feature } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderFeaturesGrid(features: Feature[], t: ThemeClasses): string {
  const cards = features.map(f =>
    `<div class="${t.surface} ${t.border} rounded-2xl p-8 transition-all duration-200 hover:shadow-lg">
      <div class="flex items-center justify-center w-12 h-12 ${t.accentBg} ${t.accentText} rounded-xl text-xl mb-5">${f.icon}</div>
      <h3 class="text-lg font-semibold ${t.text}">${escapeHtml(f.title)}</h3>
      <p class="mt-2 text-sm leading-6 ${t.textMuted}">${escapeHtml(f.description)}</p>
    </div>`
  ).join('')

  return `<section id="features" class="py-24 sm:py-32">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Everything you need</h2>
      <p class="mt-4 text-lg leading-8 ${t.textMuted}">Built with the tools and features your business needs to succeed.</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${cards}</div>
  </div>
</section>`
}
