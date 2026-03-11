import type { NavLink } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderNavbar(siteName: string, links: NavLink[], t: ThemeClasses): string {
  const linksHtml = links.map(l =>
    `<a href="${l.href}" class="${t.textMuted} ${t.accentHover} text-sm font-medium transition-colors duration-200">${escapeHtml(l.label)}</a>`
  ).join('')

  const mobileLinksHtml = links.map(l =>
    `<a href="${l.href}" class="block px-3 py-2 ${t.text} text-base font-medium rounded-lg ${t.accentHover} transition-colors">${escapeHtml(l.label)}</a>`
  ).join('')

  return `<nav class="sticky top-0 z-50 ${t.navBg} border-b ${t.borderColor}">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
      <a href="#" class="text-lg font-extrabold tracking-tight ${t.text}">${escapeHtml(siteName)}</a>
      <div class="hidden md:flex items-center gap-8">${linksHtml}</div>
      <button onclick="document.getElementById('mobile-menu').classList.toggle('hidden')" class="md:hidden p-2 ${t.textMuted} rounded-lg">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
    </div>
  </div>
  <div id="mobile-menu" class="hidden md:hidden px-6 pb-4 space-y-1">${mobileLinksHtml}</div>
</nav>`
}
