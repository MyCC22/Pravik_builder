import { escapeHtml } from '../render'

export function renderHeroCenter(title: string, subtitle: string, ctaText?: string, ctaUrl = '#contact'): string {
  const ctaHtml = ctaText
    ? `<a href="${ctaUrl}" style="display:inline-block;background:var(--accent);color:var(--accent-text);padding:12px 32px;border-radius:8px;font-weight:600;font-size:16px">${escapeHtml(ctaText)}</a>`
    : ''

  return `<section style="padding:80px 24px;text-align:center;max-width:720px;margin:0 auto">
    <h1 style="font-size:48px;font-weight:800;line-height:1.1;margin-bottom:16px;letter-spacing:-1px">${escapeHtml(title)}</h1>
    <p style="font-size:18px;color:var(--muted);margin-bottom:32px;line-height:1.6">${escapeHtml(subtitle)}</p>
    ${ctaHtml}
  </section>`
}
