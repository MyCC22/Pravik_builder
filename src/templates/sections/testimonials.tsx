import type { Testimonial } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderTestimonials(testimonials: Testimonial[], t: ThemeClasses): string {
  const cards = testimonials.map(tm =>
    `<div class="${t.surface} ${t.border} rounded-2xl p-8">
      <div class="${t.accent} text-3xl mb-4">&ldquo;</div>
      <p class="text-base leading-7 ${t.text}">${escapeHtml(tm.quote)}</p>
      <div class="mt-6 flex items-center gap-4">
        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex-shrink-0"></div>
        <div>
          <p class="text-sm font-semibold ${t.text}">${escapeHtml(tm.name)}</p>
          <p class="text-sm ${t.textMuted}">${escapeHtml(tm.role)}</p>
        </div>
      </div>
    </div>`
  ).join('')

  return `<section class="py-24 sm:py-32 ${t.sectionAlt}">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Loved by our customers</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">${cards}</div>
  </div>
</section>`
}
