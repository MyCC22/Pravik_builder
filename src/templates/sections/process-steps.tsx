import type { ProcessStep } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderProcessSteps(steps: ProcessStep[], t: ThemeClasses): string {
  const gridCols = steps.length >= 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'

  const arrowSvg = `<div class="hidden md:flex items-center justify-center">
    <svg class="w-8 h-8 ${t.textMuted} opacity-40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
  </div>`

  const items = steps.map((s, i) => {
    const card = `<div class="animate-on-scroll ${t.surface} ${t.border} rounded-3xl p-8 text-center relative">
      <div class="text-6xl font-black ${t.accent} opacity-15 mb-4">${escapeHtml(s.step)}</div>
      <h3 class="text-lg font-semibold ${t.text}">${escapeHtml(s.title)}</h3>
      <p class="mt-2 text-sm leading-6 ${t.textMuted}">${escapeHtml(s.description)}</p>
    </div>`
    return i < steps.length - 1 ? card + arrowSvg : card
  }).join('')

  return `<section id="process" class="py-24 sm:py-32 ${t.sectionAlt}">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">How it works</h2>
    </div>
    <div class="grid grid-cols-1 ${gridCols} gap-6 items-center">${items}</div>
  </div>
</section>`
}
