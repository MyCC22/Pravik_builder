import { escapeHtml } from '../render'

export function renderCTABanner(title: string, subtitle?: string, ctaText = 'Get Started', ctaUrl = '#contact'): string {
  const subtitleHtml = subtitle
    ? `<p style="margin-top:1rem;font-size:1.0625rem;color:var(--muted);max-width:480px;margin-left:auto;margin-right:auto">${escapeHtml(subtitle)}</p>`
    : ''

  return `<section style="text-align:center;background:var(--surface);border-radius:1rem;max-width:1000px;margin:0 auto;padding:4rem 2rem">
    <h2 style="font-size:clamp(1.75rem,3vw,2.5rem);font-weight:800;color:var(--text);letter-spacing:-0.025em">${escapeHtml(title)}</h2>
    ${subtitleHtml}
    <div style="margin-top:2rem">
      <a href="${ctaUrl}" style="display:inline-flex;align-items:center;padding:0.75rem 2rem;background:var(--accent);color:var(--accent-text);border-radius:0.5rem;font-weight:600;font-size:0.9375rem;box-shadow:0 1px 3px rgba(0,0,0,0.12);transition:all 0.15s">${escapeHtml(ctaText)}</a>
    </div>
  </section>`
}
