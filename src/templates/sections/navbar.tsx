import type { NavLink } from '../types'
import { escapeHtml } from '../render'

export function renderNavbar(siteName: string, links: NavLink[] = []): string {
  const linksHtml = links.map((l) => `<a href="${l.href}" style="color:var(--muted)">${escapeHtml(l.label)}</a>`).join('')
  return `<nav style="display:flex;justify-content:space-between;align-items:center;padding:16px 24px;border-bottom:1px solid var(--border)">
    <span style="font-weight:700;font-size:18px">${escapeHtml(siteName)}</span>
    <div style="display:flex;gap:24px;font-size:14px;color:var(--muted)">${linksHtml}</div>
  </nav>`
}
