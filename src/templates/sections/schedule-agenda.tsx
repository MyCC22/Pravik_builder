import type { ScheduleItem } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderSchedule(schedule: ScheduleItem[], t: ThemeClasses): string {
  const items = schedule.map(s =>
    `<div class="flex gap-6 py-6 border-b ${t.borderColor} last:border-0">
      <div class="flex-shrink-0 w-20 text-right">
        <span class="text-sm font-semibold ${t.accent}">${escapeHtml(s.time)}</span>
      </div>
      <div>
        <h3 class="text-base font-semibold ${t.text}">${escapeHtml(s.title)}</h3>
        ${s.speaker ? `<p class="text-sm ${t.accent} font-medium mt-1">${escapeHtml(s.speaker)}</p>` : ''}
        ${s.description ? `<p class="mt-1 text-sm ${t.textMuted}">${escapeHtml(s.description)}</p>` : ''}
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
