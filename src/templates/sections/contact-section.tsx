import { escapeHtml } from '../render'

export function renderContactSection(email: string, phone?: string, address?: string): string {
  let contactHtml = `<p><a href="mailto:${escapeHtml(email)}" style="color:var(--accent)">${escapeHtml(email)}</a></p>`
  if (phone) contactHtml += `<p>${escapeHtml(phone)}</p>`
  if (address) contactHtml += `<p>${escapeHtml(address)}</p>`
  return `<section id="contact" style="padding:64px 24px;max-width:600px;margin:0 auto;text-align:center">
    <h2 style="font-size:28px;font-weight:700;margin-bottom:24px">Get in Touch</h2>
    <div style="font-size:16px;line-height:2;color:var(--muted)">${contactHtml}</div>
  </section>`
}
