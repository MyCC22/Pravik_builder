import { escapeHtml } from '../render'

export function renderHeroBold(title: string, subtitle: string): string {
  return `<section style="padding:7rem 2rem 4rem;max-width:1200px;margin:0 auto">
    <h1 style="font-size:clamp(3rem,7vw,5.5rem);font-weight:900;line-height:1.0;letter-spacing:-0.04em;text-transform:uppercase;color:var(--text)">${escapeHtml(title)}</h1>
    <p style="margin-top:1.5rem;font-size:1.125rem;color:var(--muted);max-width:480px;line-height:1.75">${escapeHtml(subtitle)}</p>
  </section>`
}
