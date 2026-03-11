import type { HoursEntry } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderHoursLocation(hours: HoursEntry[], t: ThemeClasses, address?: string): string {
  const hoursHtml = hours.map(h =>
    `<div class="flex justify-between py-3 border-b ${t.borderColor} last:border-0">
      <span class="font-medium ${t.text}">${escapeHtml(h.day)}</span>
      <span class="${t.textMuted}">${escapeHtml(h.hours)}</span>
    </div>`
  ).join('')

  const addressHtml = address
    ? `<div class="${t.surface} ${t.border} rounded-2xl p-8">
        <h3 class="text-lg font-semibold ${t.text} mb-4">Location</h3>
        <p class="${t.textMuted}">${escapeHtml(address)}</p>
        <div class="mt-4 aspect-[16/9] rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center ${t.border}">
          <span class="text-sm ${t.textMuted}">Map</span>
        </div>
      </div>`
    : ''

  return `<section id="hours" class="py-24 sm:py-32 ${t.sectionAlt}">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Visit us</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
      <div class="${t.surface} ${t.border} rounded-2xl p-8">
        <h3 class="text-lg font-semibold ${t.text} mb-4">Hours</h3>
        ${hoursHtml}
      </div>
      ${addressHtml}
    </div>
  </div>
</section>`
}
