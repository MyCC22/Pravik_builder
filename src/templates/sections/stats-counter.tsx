import type { StatItem } from '../types'
import type { ThemeClasses } from '../theme-classes'

export function renderStatsCounter(stats: StatItem[], t: ThemeClasses): string {
  const items = stats.map(s =>
    `<div class="text-center border-t-4 ${t.statDivider} pt-6">
      <p class="text-5xl font-extrabold tracking-tight ${t.accent} sm:text-6xl">${s.value}</p>
      <p class="mt-3 text-sm font-medium ${t.textMuted} uppercase tracking-wider">${s.label}</p>
    </div>`
  ).join('')

  const gridCols = stats.length > 3 ? 'md:grid-cols-4' : stats.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'

  return `<section id="stats" class="py-20 sm:py-24">
  <div class="max-w-6xl mx-auto px-6 lg:px-8">
    <div class="animate-on-scroll ${t.surface} ${t.border} rounded-3xl p-12 sm:p-16">
      <div class="grid grid-cols-2 ${gridCols} gap-10">${items}</div>
    </div>
  </div>
</section>`
}
