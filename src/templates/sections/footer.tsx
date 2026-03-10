import type { NavLink } from '../types'
import { escapeHtml } from '../render'

export function renderFooter(siteName: string, links: NavLink[] = [], copyright?: string): string {
  const linksHtml = links.length > 0
    ? `<div style="display:flex;justify-content:center;gap:2rem;margin-bottom:1.5rem;flex-wrap:wrap">${links.map((l) => `<a href="${l.href}" style="color:var(--muted);font-size:0.875rem;font-weight:500;transition:color 0.15s">${escapeHtml(l.label)}</a>`).join('')}</div>`
    : ''
  const copyrightText = copyright || `\u00A9 ${new Date().getFullYear()} ${escapeHtml(siteName)}. All rights reserved.`

  return `<footer>
    <div style="max-width:1200px;margin:0 auto;text-align:center">
      ${linksHtml}
      <p style="font-size:0.8125rem;color:var(--muted)">${copyrightText}</p>
    </div>
  </footer>`
}
