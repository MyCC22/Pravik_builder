import type { NavLink } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderFooter(siteName: string, links: NavLink[], t: ThemeClasses, copyright?: string): string {
  const linksHtml = links.length > 0
    ? links.map(l => `<a href="${l.href}" class="${t.footerTextMuted} hover:${t.footerText} text-sm transition-colors">${escapeHtml(l.label)}</a>`).join('')
    : ''
  const year = new Date().getFullYear()
  const copyrightText = copyright || `&copy; ${year} ${escapeHtml(siteName)}. All rights reserved.`

  return `<footer class="${t.footerBg} py-16">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="flex flex-col md:flex-row items-center justify-between gap-8 mb-10">
      <a href="#" class="text-xl font-extrabold tracking-tight ${t.footerText}">${escapeHtml(siteName)}</a>
      <div class="flex items-center gap-8 flex-wrap justify-center">${linksHtml}</div>
    </div>
    <div class="border-t border-white/10 pt-8 text-center">
      <p class="text-sm ${t.footerTextMuted}">${copyrightText}</p>
    </div>
  </div>
</footer>`
}
