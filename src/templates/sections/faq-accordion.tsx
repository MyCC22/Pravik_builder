import type { FAQItem } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderFAQ(faq: FAQItem[], t: ThemeClasses): string {
  const items = faq.map(f =>
    `<details class="animate-on-scroll group ${t.surface} ${t.border} rounded-2xl px-8 py-6 mb-4 transition-all duration-300 ${t.cardShadow}">
      <summary class="flex justify-between items-center cursor-pointer list-none">
        <h3 class="text-lg font-semibold ${t.text} pr-4">${escapeHtml(f.question)}</h3>
        <svg class="w-6 h-6 ${t.textMuted} flex-shrink-0 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </summary>
      <p class="mt-4 text-sm leading-7 ${t.textMuted}">${escapeHtml(f.answer)}</p>
    </details>`
  ).join('')

  return `<section id="faq" class="py-24 sm:py-32">
  <div class="max-w-3xl mx-auto px-6 lg:px-8">
    <div class="text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Frequently asked questions</h2>
    </div>
    <div>${items}</div>
  </div>
</section>`
}
