import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderContactSection(t: ThemeClasses, email?: string, phone?: string, address?: string): string {
  const items: string[] = []
  if (email) items.push(`<div class="flex items-start gap-4">
    <div class="flex-shrink-0 w-10 h-10 rounded-xl ${t.accentBg} ${t.accentText} flex items-center justify-center text-lg">@</div>
    <div><p class="text-sm font-medium ${t.textMuted}">Email</p><a href="mailto:${escapeHtml(email)}" class="${t.accent} ${t.accentHover} font-medium transition-colors">${escapeHtml(email)}</a></div>
  </div>`)
  if (phone) items.push(`<div class="flex items-start gap-4">
    <div class="flex-shrink-0 w-10 h-10 rounded-xl ${t.accentBg} ${t.accentText} flex items-center justify-center text-lg">&#9742;</div>
    <div><p class="text-sm font-medium ${t.textMuted}">Phone</p><a href="tel:${escapeHtml(phone)}" class="${t.accent} ${t.accentHover} font-medium transition-colors">${escapeHtml(phone)}</a></div>
  </div>`)
  if (address) items.push(`<div class="flex items-start gap-4">
    <div class="flex-shrink-0 w-10 h-10 rounded-xl ${t.accentBg} ${t.accentText} flex items-center justify-center text-lg">&#9906;</div>
    <div><p class="text-sm font-medium ${t.textMuted}">Address</p><p class="${t.text}">${escapeHtml(address)}</p></div>
  </div>`)

  return `<section id="contact" class="py-24 sm:py-32 ${t.sectionAlt}">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Get in touch</h2>
      <p class="mt-4 text-lg leading-8 ${t.textMuted}">We'd love to hear from you.</p>
    </div>
    <div class="max-w-lg mx-auto space-y-8">${items.join('')}</div>
  </div>
</section>`
}
