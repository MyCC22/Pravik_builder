import type { HoursEntry } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml, getSvgIcon } from '../utils'

export function renderHoursLocation(hours: HoursEntry[], t: ThemeClasses, address?: string): string {
  const hoursHtml = hours.map(h =>
    `<div class="flex justify-between py-3 border-b ${t.borderColor} last:border-0">
      <span class="font-medium ${t.text}">${escapeHtml(h.day)}</span>
      <span class="${t.textMuted}">${escapeHtml(h.hours)}</span>
    </div>`
  ).join('')

  const addressHtml = address
    ? `<div class="animate-on-scroll ${t.surface} ${t.border} rounded-3xl p-10 ${t.cardShadow}">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 rounded-xl ${t.accentBgLight} ${t.accent} flex items-center justify-center">${getSvgIcon('map-pin')}</div>
          <h3 class="text-lg font-semibold ${t.text}">Location</h3>
        </div>
        <p class="${t.textMuted}">${escapeHtml(address)}</p>
      </div>`
    : ''

  return `<section id="hours" class="py-24 sm:py-32 ${t.sectionAlt}">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Visit us</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
      <div class="animate-on-scroll ${t.surface} ${t.border} rounded-3xl p-10 ${t.cardShadow}">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 rounded-xl ${t.accentBgLight} ${t.accent} flex items-center justify-center">${getSvgIcon('clock')}</div>
          <h3 class="text-lg font-semibold ${t.text}">Hours</h3>
        </div>
        ${hoursHtml}
      </div>
      ${addressHtml}
    </div>
  </div>
</section>`
}
