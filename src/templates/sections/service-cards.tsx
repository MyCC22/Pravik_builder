import type { ServiceItem } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderServiceCards(services: ServiceItem[], t: ThemeClasses): string {
  const cards = services.map(s =>
    `<div class="${t.surface} ${t.border} rounded-2xl p-8 transition-all duration-200 hover:shadow-lg hover:-translate-y-1">
      <div class="text-3xl mb-4">${s.icon}</div>
      <h3 class="text-lg font-semibold ${t.text}">${escapeHtml(s.title)}</h3>
      <p class="mt-2 text-sm leading-6 ${t.textMuted}">${escapeHtml(s.description)}</p>
    </div>`
  ).join('')

  return `<section id="services" class="py-24 sm:py-32">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">What we offer</h2>
      <p class="mt-4 text-lg leading-8 ${t.textMuted}">Professional services tailored to your needs.</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">${cards}</div>
  </div>
</section>`
}
