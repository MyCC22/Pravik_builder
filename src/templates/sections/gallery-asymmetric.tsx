import type { GalleryItem } from '../types'
import { escapeHtml } from '../render'

function card(item: GalleryItem, height: string, hue: number): string {
  return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;overflow:hidden;transition:box-shadow 0.2s">
    <div style="height:${height};background:linear-gradient(135deg,hsl(${hue},40%,85%),hsl(${hue + 30},35%,75%))"></div>
    <div style="padding:1.25rem">
      <h3 style="font-size:1rem;font-weight:700;color:var(--text);margin-bottom:0.25rem">${escapeHtml(item.title)}</h3>
      <p style="font-size:0.8125rem;color:var(--muted)">${escapeHtml(item.category)}</p>
    </div>
  </div>`
}

export function renderGalleryAsymmetric(items: GalleryItem[]): string {
  const hues = [210, 260, 180, 330, 40, 150, 290, 20]
  const row1 = items.slice(0, 2).map((item, i) => card(item, '16rem', hues[i])).join('')
  const row2 = items.slice(2, 4).map((item, i) => card(item, '13rem', hues[i + 2])).join('')
  const extra = items.slice(4).map((item, i) => card(item, '11rem', hues[i + 4])).join('')

  return `<section style="max-width:1100px;margin:0 auto;padding-top:2rem;padding-bottom:2rem">
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:1.25rem;margin-bottom:1.25rem">${row1}</div>
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:1.25rem">${row2}</div>
    ${extra ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1.25rem;margin-top:1.25rem">${extra}</div>` : ''}
  </section>`
}
