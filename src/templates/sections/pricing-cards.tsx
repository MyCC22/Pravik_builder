import type { PricingPlan } from '../types'
import { escapeHtml } from '../render'

export function renderPricingCards(plans: PricingPlan[]): string {
  const cards = plans.map((p) => {
    const isHighlighted = !!p.highlighted
    const cardBg = isHighlighted ? 'var(--accent)' : 'var(--surface)'
    const cardColor = isHighlighted ? 'var(--accent-text)' : 'var(--text)'
    const mutedColor = isHighlighted ? 'rgba(255,255,255,0.7)' : 'var(--muted)'
    const border = isHighlighted ? '2px solid var(--accent)' : '1px solid var(--border)'
    const btnBg = isHighlighted ? 'var(--accent-text)' : 'var(--accent)'
    const btnColor = isHighlighted ? 'var(--accent)' : 'var(--accent-text)'
    const shadow = isHighlighted ? 'box-shadow:0 8px 30px rgba(0,0,0,0.12);transform:scale(1.02);' : ''
    const badge = isHighlighted ? `<span style="display:inline-block;background:var(--accent-text);color:var(--accent);font-size:0.75rem;font-weight:600;padding:0.25rem 0.75rem;border-radius:1rem;margin-bottom:1rem">Most popular</span>` : ''

    const featuresHtml = p.features.map((f) =>
      `<li style="display:flex;align-items:center;gap:0.5rem"><span style="color:${isHighlighted ? 'var(--accent-text)' : 'var(--accent)'};font-weight:700">&#10003;</span> ${escapeHtml(f)}</li>`
    ).join('')

    return `<div style="background:${cardBg};color:${cardColor};border:${border};border-radius:1rem;padding:2rem;display:flex;flex-direction:column;${shadow}">
      ${badge}
      <h3 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;color:${cardColor}">${escapeHtml(p.plan)}</h3>
      <div style="margin-bottom:1.5rem"><span style="font-size:2.5rem;font-weight:800;letter-spacing:-0.025em">${escapeHtml(p.price)}</span></div>
      <ul style="list-style:none;padding:0;margin-bottom:2rem;font-size:0.875rem;line-height:2.25;color:${mutedColor};flex-grow:1">${featuresHtml}</ul>
      <a href="#contact" style="display:block;text-align:center;padding:0.75rem 1.5rem;border-radius:0.5rem;font-weight:600;font-size:0.875rem;background:${btnBg};color:${btnColor};box-shadow:0 1px 3px rgba(0,0,0,0.1);transition:all 0.15s">Get started</a>
    </div>`
  }).join('')

  return `<section id="pricing" style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:3rem">
      <h2 style="font-size:clamp(1.75rem,3vw,2.25rem);font-weight:700;color:var(--text);letter-spacing:-0.025em">Simple, transparent pricing</h2>
      <p style="margin-top:0.75rem;font-size:1.0625rem;color:var(--muted)">Choose the plan that works best for you.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.5rem;align-items:start">${cards}</div>
  </section>`
}
