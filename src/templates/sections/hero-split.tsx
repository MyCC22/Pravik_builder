import { escapeHtml } from '../render'

export function renderHeroSplit(title: string, subtitle: string, tagline?: string): string {
  const taglineHtml = tagline
    ? `<p style="font-size:0.8125rem;color:var(--accent);font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:1rem">${escapeHtml(tagline)}</p>`
    : ''

  return `<section style="padding:6rem 2rem;max-width:1200px;margin:0 auto">
    <div style="max-width:640px">
      ${taglineHtml}
      <h1 style="font-size:clamp(2.25rem,4.5vw,3.5rem);font-weight:300;line-height:1.2;letter-spacing:-0.025em;color:var(--text)">${escapeHtml(title)}</h1>
      <p style="margin-top:1.5rem;font-size:1.125rem;color:var(--muted);line-height:1.75;max-width:520px">${escapeHtml(subtitle)}</p>
    </div>
  </section>`
}
