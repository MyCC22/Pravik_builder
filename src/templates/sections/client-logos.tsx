import type { ClientLogo } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderClientLogos(clients: ClientLogo[], t: ThemeClasses): string {
  const logos = clients.map(c =>
    `<div class="flex items-center justify-center px-8 py-5 ${t.surface} rounded-2xl ${t.border} ${t.cardShadow} transition-all duration-300">
      <span class="text-sm font-semibold ${t.textMuted} tracking-wide uppercase">${escapeHtml(c.name)}</span>
    </div>`
  ).join('')

  return `<section id="clients" class="py-16 sm:py-20">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <p class="text-center text-sm font-medium ${t.textMuted} uppercase tracking-wider mb-10">Trusted by leading companies</p>
    <div class="flex flex-wrap items-center justify-center gap-4">${logos}</div>
  </div>
</section>`
}
