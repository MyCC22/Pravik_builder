import type { PricingPlan } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderPricingCards(plans: PricingPlan[], t: ThemeClasses): string {
  const cards = plans.map(p => {
    const highlighted = p.highlighted
    const cardBg = highlighted ? `${t.accentBg} ${t.accentText}` : `${t.surface} ${t.border}`
    const titleColor = highlighted ? t.accentText : t.text
    const priceColor = highlighted ? t.accentText : t.text
    const featureColor = highlighted ? `${t.accentText} opacity-90` : t.textMuted
    const checkColor = highlighted ? t.accentText : t.accent
    const btnClass = highlighted
      ? `bg-white text-slate-900 hover:bg-slate-100`
      : `${t.accentBg} ${t.accentBgHover} ${t.accentText}`

    const featuresHtml = p.features.map(f =>
      `<li class="flex items-start gap-3">
        <svg class="w-5 h-5 ${checkColor} mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        <span class="${featureColor} text-sm">${escapeHtml(f)}</span>
      </li>`
    ).join('')

    return `<div class="animate-on-scroll ${cardBg} rounded-3xl p-10 ${highlighted ? 'shadow-2xl scale-105 relative z-10' : t.cardShadow}">
      ${highlighted ? '<div class="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-white text-slate-900 text-xs font-bold rounded-full shadow-lg">Most Popular</div>' : ''}
      <h3 class="text-lg font-semibold ${titleColor}">${escapeHtml(p.plan)}</h3>
      <p class="mt-4 flex items-baseline gap-1">
        <span class="text-5xl font-extrabold tracking-tight ${priceColor}">${escapeHtml(p.price)}</span>
      </p>
      <ul class="mt-8 space-y-4">${featuresHtml}</ul>
      <a href="#contact" class="mt-8 block text-center ${btnClass} px-6 py-3.5 text-sm font-semibold rounded-full transition-all duration-200">Get started</a>
    </div>`
  }).join('')

  const gridCols = plans.length > 2 ? 'md:grid-cols-3' : 'md:grid-cols-2'

  return `<section id="pricing" class="py-24 sm:py-32">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Simple, transparent pricing</h2>
      <p class="mt-4 text-lg leading-8 ${t.textMuted}">Choose the plan that works best for you.</p>
    </div>
    <div class="grid grid-cols-1 ${gridCols} gap-8 max-w-5xl mx-auto items-center">${cards}</div>
  </div>
</section>`
}
