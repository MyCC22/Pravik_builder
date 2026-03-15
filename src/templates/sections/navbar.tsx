import type { NavLink } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderNavbar(siteName: string, links: NavLink[], t: ThemeClasses, ctaText?: string, ctaUrl?: string): string {
  const linksHtml = links.map(l =>
    `<a href="${escapeHtml(l.href)}" class="${t.textMuted} ${t.accentHover} text-sm font-medium transition-colors duration-200">${escapeHtml(l.label)}</a>`
  ).join('')

  const ctaHtml = ctaText && ctaUrl
    ? `<a href="${escapeHtml(ctaUrl)}" class="${t.accentBg} ${t.accentBgHover} ${t.accentText} px-5 py-2.5 rounded-full text-sm font-semibold shadow-sm transition-all duration-200">${escapeHtml(ctaText)}</a>`
    : ''

  const mobileLinksHtml = links.map(l =>
    `<a href="${escapeHtml(l.href)}" class="block px-3 py-2 ${t.text} text-base font-medium rounded-lg ${t.accentHover} transition-colors">${escapeHtml(l.label)}</a>`
  ).join('')

  const mobileCta = ctaText && ctaUrl
    ? `<a href="${escapeHtml(ctaUrl)}" class="block mt-2 text-center ${t.accentBg} ${t.accentText} px-5 py-3 rounded-full text-sm font-semibold">${escapeHtml(ctaText)}</a>`
    : ''

  return `<nav class="sticky top-0 z-50 ${t.navBg} border-b ${t.borderColor}">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="flex items-center justify-between h-20">
      <a href="#" class="text-xl font-extrabold tracking-tight ${t.text}">${escapeHtml(siteName)}</a>
      <div class="hidden md:flex items-center gap-8">
        ${linksHtml}
        ${ctaHtml}
      </div>
      <button onclick="document.getElementById('mobile-menu').classList.toggle('hidden')" class="md:hidden p-2 ${t.textMuted} rounded-lg">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
    </div>
  </div>
  <div id="mobile-menu" class="hidden md:hidden px-6 pb-4 space-y-1">
    ${mobileLinksHtml}
    ${mobileCta}
  </div>
</nav>`
}
