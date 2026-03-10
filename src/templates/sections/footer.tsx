import type { NavLink } from '../types'
import { escapeHtml } from '../render'

export function renderFooter(siteName: string, links: NavLink[] = [], copyright?: string): string {
  const linksHtml = links.length > 0
    ? `<div style="display:flex;justify-content:center;gap:24px;margin-bottom:16px">${links.map((l) => `<a href="${l.href}" style="color:var(--muted)">${escapeHtml(l.label)}</a>`).join('')}</div>`
    : ''
  const copyrightText = copyright || `\u00A9 ${new Date().getFullYear()} ${escapeHtml(siteName)}. All rights reserved.`
  return `<footer style="border-top:1px solid var(--border);padding:32px 24px;text-align:center;font-size:14px;color:var(--muted)">
    ${linksHtml}<p>${copyrightText}</p>
  </footer>`
}
