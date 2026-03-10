import type { GalleryItem } from '../types'
import { escapeHtml } from '../render'

export function renderGalleryGrid(items: GalleryItem[]): string {
  const cards = items.map((item) => `<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden">
    <div style="height:200px;background:linear-gradient(135deg,var(--surface),var(--border))"></div>
    <div style="padding:16px">
      <h3 style="font-size:16px;font-weight:600;margin-bottom:4px">${escapeHtml(item.title)}</h3>
      <p style="font-size:13px;color:var(--muted)">${escapeHtml(item.category)}</p>
    </div>
  </div>`).join('')
  return `<section style="padding:64px 24px;max-width:960px;margin:0 auto">
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px">${cards}</div>
  </section>`
}
