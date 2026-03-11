import type { MenuCategory } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderMenuDisplay(categories: MenuCategory[], t: ThemeClasses): string {
  const sections = categories.map(cat => {
    const items = cat.items.map(item =>
      `<div class="flex justify-between items-start py-4 border-b ${t.borderColor} last:border-0">
        <div class="pr-4">
          <h4 class="text-base font-semibold ${t.text}">${escapeHtml(item.name)}</h4>
          <p class="mt-1 text-sm ${t.textMuted}">${escapeHtml(item.description)}</p>
        </div>
        <span class="text-base font-semibold ${t.accent} whitespace-nowrap">${escapeHtml(item.price)}</span>
      </div>`
    ).join('')

    return `<div class="mb-12 last:mb-0">
      <h3 class="text-xl font-bold ${t.text} mb-6 pb-2 border-b-2 ${t.borderColor}">${escapeHtml(cat.category)}</h3>
      ${items}
    </div>`
  }).join('')

  return `<section class="py-24 sm:py-32">
  <div class="max-w-3xl mx-auto px-6 lg:px-8">
    <div class="text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Our menu</h2>
    </div>
    ${sections}
  </div>
</section>`
}
