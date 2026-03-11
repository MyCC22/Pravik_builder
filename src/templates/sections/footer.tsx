import type { NavLink } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderFooter(siteName: string, links: NavLink[], t: ThemeClasses, copyright?: string): string {
  const linksHtml = links.length > 0
    ? `<div class="flex justify-center gap-8 flex-wrap mb-8">
        ${links.map(l => `<a href="${l.href}" class="${t.textMuted} ${t.accentHover} text-sm transition-colors">${escapeHtml(l.label)}</a>`).join('')}
      </div>`
    : ''
  const year = new Date().getFullYear()
  const copyrightText = copyright || `&copy; ${year} ${escapeHtml(siteName)}. All rights reserved.`

  return `<footer class="border-t ${t.borderColor} py-12">
  <div class="max-w-7xl mx-auto px-6 lg:px-8 text-center">
    ${linksHtml}
    <p class="text-sm ${t.textMuted}">${copyrightText}</p>
  </div>
</footer>`
}
