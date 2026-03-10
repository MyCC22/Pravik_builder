import { escapeHtml } from '../render'

export function renderContactSection(email: string, phone?: string, address?: string): string {
  const items: string[] = []
  items.push(`<div style="display:flex;align-items:center;gap:0.75rem">
    <div style="width:2.5rem;height:2.5rem;display:flex;align-items:center;justify-content:center;border-radius:0.5rem;background:var(--surface);border:1px solid var(--border);font-size:1rem">&#9993;</div>
    <a href="mailto:${escapeHtml(email)}" style="color:var(--accent);font-weight:500">${escapeHtml(email)}</a>
  </div>`)
  if (phone) {
    items.push(`<div style="display:flex;align-items:center;gap:0.75rem">
      <div style="width:2.5rem;height:2.5rem;display:flex;align-items:center;justify-content:center;border-radius:0.5rem;background:var(--surface);border:1px solid var(--border);font-size:1rem">&#9742;</div>
      <span style="color:var(--muted)">${escapeHtml(phone)}</span>
    </div>`)
  }
  if (address) {
    items.push(`<div style="display:flex;align-items:center;gap:0.75rem">
      <div style="width:2.5rem;height:2.5rem;display:flex;align-items:center;justify-content:center;border-radius:0.5rem;background:var(--surface);border:1px solid var(--border);font-size:1rem">&#9906;</div>
      <span style="color:var(--muted)">${escapeHtml(address)}</span>
    </div>`)
  }

  return `<section id="contact" style="max-width:600px;margin:0 auto;text-align:center">
    <h2 style="font-size:clamp(1.75rem,3vw,2.25rem);font-weight:700;color:var(--text);letter-spacing:-0.025em;margin-bottom:0.75rem">Get in touch</h2>
    <p style="font-size:1.0625rem;color:var(--muted);margin-bottom:2rem">We'd love to hear from you.</p>
    <div style="display:flex;flex-direction:column;gap:1rem;align-items:center">${items.join('')}</div>
  </section>`
}
