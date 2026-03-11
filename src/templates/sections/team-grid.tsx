import type { TeamMember } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderTeamGrid(team: TeamMember[], t: ThemeClasses): string {
  const cards = team.map((m, i) => {
    const hue = (i * 67 + 180) % 360
    return `<div class="text-center">
      <div class="w-24 h-24 mx-auto rounded-full mb-4 ${t.border}" style="background:linear-gradient(135deg, hsl(${hue},35%,80%), hsl(${(hue+30)%360},45%,70%))"></div>
      <h3 class="text-base font-semibold ${t.text}">${escapeHtml(m.name)}</h3>
      <p class="text-sm ${t.accent} font-medium">${escapeHtml(m.role)}</p>
      <p class="mt-2 text-sm ${t.textMuted}">${escapeHtml(m.bio)}</p>
    </div>`
  }).join('')

  return `<section id="team" class="py-24 sm:py-32">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Meet the team</h2>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">${cards}</div>
  </div>
</section>`
}
