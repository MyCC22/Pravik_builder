import { escapeHtml } from '../render'

export function renderHeroBold(title: string, subtitle: string): string {
  return `<section style="padding:100px 24px 60px;max-width:960px;margin:0 auto">
    <h1 style="font-size:64px;font-weight:900;line-height:1.0;letter-spacing:-2px;text-transform:uppercase;margin-bottom:20px">${escapeHtml(title)}</h1>
    <p style="font-size:18px;color:var(--muted);max-width:480px">${escapeHtml(subtitle)}</p>
  </section>`
}
