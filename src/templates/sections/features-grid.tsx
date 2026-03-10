import type { Feature } from '../types'
import { escapeHtml } from '../render'

export function renderFeaturesGrid(features: Feature[]): string {
  const cards = features
    .map(
      (f) => `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px">
      <div style="font-size:28px;margin-bottom:12px">${f.icon}</div>
      <h3 style="font-size:18px;font-weight:700;margin-bottom:8px">${escapeHtml(f.title)}</h3>
      <p style="font-size:14px;color:var(--muted);line-height:1.6">${escapeHtml(f.description)}</p>
    </div>`
    )
    .join('')

  return `<section style="padding:64px 24px;max-width:960px;margin:0 auto">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:32px">${cards}</div>
  </section>`
}
