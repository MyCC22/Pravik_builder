import type { BeforeAfterItem } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderBeforeAfter(items: BeforeAfterItem[], t: ThemeClasses): string {
  const cards = items.map(item =>
    `<div class="${t.surface} ${t.border} rounded-2xl p-8">
      <h3 class="text-lg font-semibold ${t.text} mb-6">${escapeHtml(item.label)}</h3>
      <div class="grid grid-cols-2 gap-4">
        <div class="rounded-xl bg-red-50 border border-red-200 p-4">
          <p class="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Before</p>
          <p class="text-sm ${t.text}">${escapeHtml(item.before)}</p>
        </div>
        <div class="rounded-xl bg-green-50 border border-green-200 p-4">
          <p class="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">After</p>
          <p class="text-sm ${t.text}">${escapeHtml(item.after)}</p>
        </div>
      </div>
    </div>`
  ).join('')

  return `<section class="py-24 sm:py-32">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Real results</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">${cards}</div>
  </div>
</section>`
}
