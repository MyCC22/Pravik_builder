import type { ProcessStep } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderProcessSteps(steps: ProcessStep[], t: ThemeClasses): string {
  const items = steps.map((s, i) =>
    `<div class="relative flex gap-6 pb-12 ${i < steps.length - 1 ? '' : ''}">
      ${i < steps.length - 1 ? `<div class="absolute left-5 top-12 w-px h-full ${t.borderColor} border-l border-dashed"></div>` : ''}
      <div class="flex-shrink-0 w-10 h-10 rounded-full ${t.accentBg} ${t.accentText} flex items-center justify-center text-sm font-bold relative z-10">${escapeHtml(s.step)}</div>
      <div class="pt-1">
        <h3 class="text-lg font-semibold ${t.text}">${escapeHtml(s.title)}</h3>
        <p class="mt-1 text-sm leading-6 ${t.textMuted}">${escapeHtml(s.description)}</p>
      </div>
    </div>`
  ).join('')

  return `<section class="py-24 sm:py-32 ${t.sectionAlt}">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">How it works</h2>
    </div>
    <div class="max-w-2xl mx-auto">${items}</div>
  </div>
</section>`
}
