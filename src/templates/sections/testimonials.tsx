import type { Testimonial } from '../types'
import { escapeHtml } from '../render'

export function renderTestimonials(testimonials: Testimonial[]): string {
  const cards = testimonials.map((t) => `<div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.75rem">
    <div style="display:flex;gap:0.25rem;margin-bottom:1rem;color:var(--accent);font-size:1rem">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
    <p style="font-size:0.9375rem;color:var(--text);line-height:1.7;margin-bottom:1.25rem">&ldquo;${escapeHtml(t.quote)}&rdquo;</p>
    <div style="display:flex;align-items:center;gap:0.75rem">
      <div style="width:2.25rem;height:2.25rem;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:var(--accent-text);font-weight:700;font-size:0.8125rem">${escapeHtml(t.name.charAt(0))}</div>
      <div>
        <p style="font-weight:600;font-size:0.875rem;color:var(--text)">${escapeHtml(t.name)}</p>
        <p style="font-size:0.8125rem;color:var(--muted)">${escapeHtml(t.role)}</p>
      </div>
    </div>
  </div>`).join('')

  return `<section style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:3rem">
      <h2 style="font-size:clamp(1.75rem,3vw,2.25rem);font-weight:700;color:var(--text);letter-spacing:-0.025em">Loved by our customers</h2>
      <p style="margin-top:0.75rem;font-size:1.0625rem;color:var(--muted)">See what people are saying about us.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1.5rem">${cards}</div>
  </section>`
}
