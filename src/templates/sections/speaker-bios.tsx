import type { Speaker } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderSpeakerBios(speakers: Speaker[], t: ThemeClasses): string {
  const cards = speakers.map(s => {
    const initial = s.name ? s.name.charAt(0).toUpperCase() : '?'
    return `<div class="animate-on-scroll ${t.surface} ${t.border} rounded-3xl p-10 text-center ${t.cardShadow}">
      <div class="w-20 h-20 mx-auto rounded-full mb-5 ${t.accentBg} ${t.accentText} flex items-center justify-center text-2xl font-bold">${initial}</div>
      <h3 class="text-base font-semibold ${t.text}">${escapeHtml(s.name)}</h3>
      <p class="text-sm ${t.accent} font-medium mt-1">${escapeHtml(s.topic)}</p>
      <p class="mt-3 text-sm ${t.textMuted}">${escapeHtml(s.bio)}</p>
    </div>`
  }).join('')

  return `<section id="speakers" class="py-24 sm:py-32 ${t.sectionAlt}">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Speakers</h2>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">${cards}</div>
  </div>
</section>`
}
