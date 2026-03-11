import type { Speaker } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderSpeakerBios(speakers: Speaker[], t: ThemeClasses): string {
  const cards = speakers.map((s, i) => {
    const hue = (i * 53 + 220) % 360
    return `<div class="${t.surface} ${t.border} rounded-2xl p-8 text-center">
      <div class="w-20 h-20 mx-auto rounded-full mb-4" style="background:linear-gradient(135deg, hsl(${hue},35%,80%), hsl(${(hue+30)%360},45%,70%))"></div>
      <h3 class="text-base font-semibold ${t.text}">${escapeHtml(s.name)}</h3>
      <p class="text-sm ${t.accent} font-medium mt-1">${escapeHtml(s.topic)}</p>
      <p class="mt-3 text-sm ${t.textMuted}">${escapeHtml(s.bio)}</p>
    </div>`
  }).join('')

  return `<section class="py-24 sm:py-32 ${t.sectionAlt}">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Speakers</h2>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">${cards}</div>
  </div>
</section>`
}
