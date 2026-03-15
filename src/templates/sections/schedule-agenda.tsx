import type { ScheduleItem } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderSchedule(schedule: ScheduleItem[], t: ThemeClasses): string {
  const items = schedule.map(s =>
    `<div class="animate-on-scroll ${t.surface} ${t.border} rounded-2xl p-6 mb-4 ${t.cardShadow}">
      <div class="flex gap-6">
        <div class="flex-shrink-0">
          <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold ${t.taglineBg}">${escapeHtml(s.time)}</span>
        </div>
        <div>
          <h3 class="text-base font-semibold ${t.text}">${escapeHtml(s.title)}</h3>
          ${s.speaker ? `<p class="text-sm ${t.accent} font-medium mt-1">${escapeHtml(s.speaker)}</p>` : ''}
          ${s.description ? `<p class="mt-1 text-sm ${t.textMuted}">${escapeHtml(s.description)}</p>` : ''}
        </div>
      </div>
    </div>`
  ).join('')

  return `<section id="schedule" class="py-24 sm:py-32">
  <div class="max-w-3xl mx-auto px-6 lg:px-8">
    <div class="text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Schedule</h2>
    </div>
    <div>${items}</div>
  </div>
</section>`
}
