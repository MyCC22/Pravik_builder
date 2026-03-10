import { escapeHtml } from '../render'

export function renderCTABanner(title: string, subtitle?: string, ctaText = 'Get Started', ctaUrl = '#contact'): string {
  const subtitleHtml = subtitle ? `<p style="font-size:16px;color:var(--muted);margin-bottom:24px">${escapeHtml(subtitle)}</p>` : ''
  return `<section style="padding:64px 24px;text-align:center;background:var(--surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border)">
    <h2 style="font-size:32px;font-weight:700;margin-bottom:12px">${escapeHtml(title)}</h2>
    ${subtitleHtml}
    <a href="${ctaUrl}" style="display:inline-block;background:var(--accent);color:var(--accent-text);padding:12px 32px;border-radius:8px;font-weight:600;font-size:16px">${escapeHtml(ctaText)}</a>
  </section>`
}
