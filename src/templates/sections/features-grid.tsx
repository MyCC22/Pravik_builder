import type { Feature } from '../types'
import { escapeHtml } from '../render'

export function renderFeaturesGrid(features: Feature[]): string {
  const cards = features
    .map(
      (f) => `<div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:2rem;transition:box-shadow 0.2s">
      <div style="width:2.5rem;height:2.5rem;display:flex;align-items:center;justify-content:center;border-radius:0.5rem;background:var(--accent);color:var(--accent-text);font-size:1.25rem;margin-bottom:1rem">${f.icon}</div>
      <h3 style="font-size:1.0625rem;font-weight:600;color:var(--text);margin-bottom:0.5rem">${escapeHtml(f.title)}</h3>
      <p style="font-size:0.875rem;color:var(--muted);line-height:1.7">${escapeHtml(f.description)}</p>
    </div>`
    )
    .join('')

  return `<section id="features" style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:3rem">
      <h2 style="font-size:clamp(1.75rem,3vw,2.25rem);font-weight:700;color:var(--text);letter-spacing:-0.025em">Everything you need</h2>
      <p style="margin-top:0.75rem;font-size:1.0625rem;color:var(--muted);max-width:560px;margin-left:auto;margin-right:auto">Built with the tools and features your business needs to succeed.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem">${cards}</div>
  </section>`
}
