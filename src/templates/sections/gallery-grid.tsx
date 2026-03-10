import type { GalleryItem } from '../types'
import { escapeHtml } from '../render'

export function renderGalleryGrid(items: GalleryItem[]): string {
  const cards = items.map((item, i) => {
    const hues = [210, 260, 180, 330, 40, 150, 290, 20]
    const hue = hues[i % hues.length]
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;overflow:hidden;transition:box-shadow 0.2s">
      <div style="height:12rem;background:linear-gradient(135deg,hsl(${hue},40%,85%),hsl(${hue + 30},35%,75%))"></div>
      <div style="padding:1.25rem">
        <h3 style="font-size:1rem;font-weight:600;color:var(--text);margin-bottom:0.25rem">${escapeHtml(item.title)}</h3>
        <p style="font-size:0.8125rem;color:var(--muted)">${escapeHtml(item.category)}</p>
      </div>
    </div>`
  }).join('')

  return `<section style="max-width:1100px;margin:0 auto">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.5rem">${cards}</div>
  </section>`
}
