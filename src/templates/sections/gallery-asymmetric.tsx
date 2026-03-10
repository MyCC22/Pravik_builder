import type { GalleryItem } from '../types'
import { escapeHtml } from '../render'

function card(item: GalleryItem, height: number): string {
  return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden">
    <div style="height:${height}px;background:linear-gradient(135deg,var(--surface),var(--border))"></div>
    <div style="padding:16px">
      <h3 style="font-size:16px;font-weight:700;margin-bottom:4px">${escapeHtml(item.title)}</h3>
      <p style="font-size:13px;color:var(--muted)">${escapeHtml(item.category)}</p>
    </div>
  </div>`
}

export function renderGalleryAsymmetric(items: GalleryItem[]): string {
  const row1 = items.slice(0, 2).map((i) => card(i, 240)).join('')
  const row2 = items.slice(2, 4).map((i) => card(i, 200)).join('')
  const extra = items.slice(4).map((i) => card(i, 160)).join('')
  return `<section style="padding:40px 24px;max-width:960px;margin:0 auto">
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-bottom:12px">${row1}</div>
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:12px">${row2}</div>
    ${extra ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:12px">${extra}</div>` : ''}
  </section>`
}
