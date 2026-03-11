import type { StatItem } from '../types'
import type { ThemeClasses } from '../theme-classes'

export function renderStatsCounter(stats: StatItem[], t: ThemeClasses): string {
  const items = stats.map(s =>
    `<div class="text-center">
      <p class="text-4xl font-extrabold tracking-tight ${t.accent} sm:text-5xl">${s.value}</p>
      <p class="mt-2 text-sm font-medium ${t.textMuted}">${s.label}</p>
    </div>`
  ).join('')

  const gridCols = stats.length > 3 ? 'md:grid-cols-4' : stats.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'

  return `<section id="stats" class="py-20 sm:py-24 ${t.sectionAlt}">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="grid grid-cols-2 ${gridCols} gap-8">${items}</div>
  </div>
</section>`
}
