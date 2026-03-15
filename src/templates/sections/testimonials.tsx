import type { Testimonial } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml, getStarRating } from '../utils'

export function renderTestimonials(testimonials: Testimonial[], t: ThemeClasses): string {
  const cards = testimonials.map(tm => {
    const initial = tm.name ? tm.name.charAt(0).toUpperCase() : '?'
    return `<div class="animate-on-scroll ${t.surface} ${t.border} rounded-3xl p-10 transition-all duration-300 ${t.cardShadow}">
      ${getStarRating()}
      <p class="mt-5 text-base leading-7 ${t.text}">${escapeHtml(tm.quote)}</p>
      <div class="mt-8 flex items-center gap-4">
        <div class="w-12 h-12 rounded-full ${t.accentBg} ${t.accentText} flex items-center justify-center font-bold text-lg flex-shrink-0">${initial}</div>
        <div>
          <p class="text-sm font-semibold ${t.text}">${escapeHtml(tm.name)}</p>
          <p class="text-sm ${t.textMuted}">${escapeHtml(tm.role)}</p>
        </div>
      </div>
    </div>`
  }).join('')

  return `<section id="testimonials" class="py-24 sm:py-32 ${t.sectionAlt}">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Loved by our customers</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">${cards}</div>
  </div>
</section>`
}
