import { escapeHtml } from '../render'

export function renderHeroSplit(title: string, subtitle: string, tagline?: string): string {
  const taglineHtml = tagline
    ? `<p style="font-size:14px;color:var(--accent);margin-bottom:12px;text-transform:uppercase;letter-spacing:2px">${escapeHtml(tagline)}</p>`
    : ''

  return `<section style="padding:80px 24px;max-width:960px;margin:0 auto">
    ${taglineHtml}
    <h1 style="font-size:40px;font-weight:300;line-height:1.3;margin-bottom:16px">${escapeHtml(title)}</h1>
    <p style="font-size:18px;color:var(--muted);max-width:560px;line-height:1.6">${escapeHtml(subtitle)}</p>
  </section>`
}
