import type { ThemeClasses } from '../theme-classes'
import { escapeHtml, getSvgIcon } from '../utils'

export function renderContactSection(t: ThemeClasses, email?: string, phone?: string, address?: string, heading = 'Get in touch', subheading = "We'd love to hear from you."): string {
  const items: string[] = []
  if (email) items.push(`<div class="animate-on-scroll flex items-start gap-4">
    <div class="flex-shrink-0 w-14 h-14 rounded-2xl ${t.accentBgLight} ${t.accent} flex items-center justify-center">${getSvgIcon('mail')}</div>
    <div><p class="text-sm font-medium ${t.textMuted}">Email</p><a href="mailto:${escapeHtml(email)}" class="${t.accent} ${t.accentHover} font-medium transition-colors">${escapeHtml(email)}</a></div>
  </div>`)
  if (phone) items.push(`<div class="animate-on-scroll flex items-start gap-4">
    <div class="flex-shrink-0 w-14 h-14 rounded-2xl ${t.accentBgLight} ${t.accent} flex items-center justify-center">${getSvgIcon('phone')}</div>
    <div><p class="text-sm font-medium ${t.textMuted}">Phone</p><a href="tel:${escapeHtml(phone)}" class="${t.accent} ${t.accentHover} font-medium transition-colors">${escapeHtml(phone)}</a></div>
  </div>`)
  if (address) items.push(`<div class="animate-on-scroll flex items-start gap-4">
    <div class="flex-shrink-0 w-14 h-14 rounded-2xl ${t.accentBgLight} ${t.accent} flex items-center justify-center">${getSvgIcon('map-pin')}</div>
    <div><p class="text-sm font-medium ${t.textMuted}">Address</p><p class="${t.text}">${escapeHtml(address)}</p></div>
  </div>`)

  return `<section id="contact" class="py-24 sm:py-32 ${t.sectionAlt}">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">${escapeHtml(heading)}</h2>
      <p class="mt-4 text-lg leading-8 ${t.textMuted}">${escapeHtml(subheading)}</p>
    </div>
    <div class="max-w-lg mx-auto space-y-8">${items.join('')}</div>
  </div>
</section>`
}
