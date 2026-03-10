import type { Testimonial } from '../types'
import { escapeHtml } from '../render'

export function renderTestimonials(testimonials: Testimonial[]): string {
  const cards = testimonials.map((t) => `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px">
    <p style="font-size:15px;line-height:1.6;margin-bottom:16px;font-style:italic">&ldquo;${escapeHtml(t.quote)}&rdquo;</p>
    <div>
      <p style="font-weight:600;font-size:14px">${escapeHtml(t.name)}</p>
      <p style="font-size:13px;color:var(--muted)">${escapeHtml(t.role)}</p>
    </div>
  </div>`).join('')
  return `<section style="padding:64px 24px;max-width:960px;margin:0 auto">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px">${cards}</div>
  </section>`
}
