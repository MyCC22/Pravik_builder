import { escapeHtml } from '../render'

export function renderHeroCenter(title: string, subtitle: string, ctaText?: string, ctaUrl = '#contact'): string {
  const ctaHtml = ctaText
    ? `<div style="margin-top:2.5rem;display:flex;justify-content:center;gap:1rem;flex-wrap:wrap">
        <a href="${ctaUrl}" style="display:inline-flex;align-items:center;padding:0.75rem 2rem;background:var(--accent);color:var(--accent-text);border-radius:0.5rem;font-weight:600;font-size:0.9375rem;box-shadow:0 1px 3px rgba(0,0,0,0.12),0 1px 2px rgba(0,0,0,0.06);transition:all 0.15s">${escapeHtml(ctaText)}</a>
        <a href="#features" style="display:inline-flex;align-items:center;padding:0.75rem 1.5rem;color:var(--text);font-weight:600;font-size:0.9375rem;gap:0.375rem">Learn more <span aria-hidden="true">&rarr;</span></a>
      </div>`
    : ''

  return `<section style="padding:6rem 1.5rem 5rem;text-align:center;max-width:800px;margin:0 auto">
    <h1 style="font-size:clamp(2.5rem,5.5vw,3.75rem);font-weight:800;line-height:1.1;letter-spacing:-0.035em;color:var(--text)">${escapeHtml(title)}</h1>
    <p style="margin-top:1.5rem;font-size:1.125rem;color:var(--muted);line-height:1.75;max-width:640px;margin-left:auto;margin-right:auto">${escapeHtml(subtitle)}</p>
    ${ctaHtml}
  </section>`
}
