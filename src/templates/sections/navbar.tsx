import type { NavLink } from '../types'
import { escapeHtml } from '../render'

export function renderNavbar(siteName: string, links: NavLink[] = []): string {
  const linksHtml = links.map((l) =>
    `<a href="${l.href}" style="color:var(--muted);font-size:0.875rem;font-weight:500;transition:color 0.15s">${escapeHtml(l.label)}</a>`
  ).join('')

  return `<nav>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:1rem 2rem;max-width:1200px;margin:0 auto">
      <a href="#" style="font-weight:800;font-size:1.125rem;color:var(--text);letter-spacing:-0.025em">${escapeHtml(siteName)}</a>
      <div style="display:flex;align-items:center;gap:2rem">${linksHtml}</div>
    </div>
  </nav>`
}
