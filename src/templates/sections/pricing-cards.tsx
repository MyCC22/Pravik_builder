import type { PricingPlan } from '../types'
import { escapeHtml } from '../render'

export function renderPricingCards(plans: PricingPlan[]): string {
  const cards = plans.map((p) => {
    const bg = p.highlighted ? 'var(--accent)' : 'var(--surface)'
    const color = p.highlighted ? 'var(--accent-text)' : 'var(--text)'
    const border = p.highlighted ? 'none' : '1px solid var(--border)'
    const btnBg = p.highlighted ? 'var(--accent-text)' : 'var(--accent)'
    const btnColor = p.highlighted ? 'var(--accent)' : 'var(--accent-text)'
    const featuresHtml = p.features.map((f) => `<li>${escapeHtml(f)}</li>`).join('')
    return `<div style="background:${bg};color:${color};border:${border};border-radius:12px;padding:32px 24px;text-align:center">
      <h3 style="font-size:18px;font-weight:700;margin-bottom:8px">${escapeHtml(p.plan)}</h3>
      <div style="font-size:36px;font-weight:800;margin-bottom:24px">${escapeHtml(p.price)}</div>
      <ul style="list-style:none;padding:0;margin-bottom:24px;font-size:14px;line-height:2">${featuresHtml}</ul>
      <a href="#contact" style="display:inline-block;padding:10px 24px;border-radius:8px;font-weight:600;font-size:14px;background:${btnBg};color:${btnColor}">Get Started</a>
    </div>`
  }).join('')
  return `<section style="padding:64px 24px;max-width:960px;margin:0 auto">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px;align-items:start">${cards}</div>
  </section>`
}
