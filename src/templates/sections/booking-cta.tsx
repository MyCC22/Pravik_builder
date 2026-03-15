import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderBookingCTA(t: ThemeClasses, bookingText = 'Book Now', bookingUrl = '#contact', heading = 'Ready to get started?', subheading = 'Book your appointment today and let us take care of the rest.'): string {
  return `<section id="booking" class="py-20 sm:py-24">
  <div class="max-w-4xl mx-auto px-6 lg:px-8">
    <div class="animate-on-scroll ${t.accentBg} rounded-3xl px-8 py-16 sm:px-16 text-center relative overflow-hidden">
      <div class="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <div class="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
      <div class="relative z-10">
        <h2 class="text-3xl font-bold tracking-tight ${t.accentText} sm:text-4xl">${escapeHtml(heading)}</h2>
        <p class="mt-4 text-lg ${t.accentText} opacity-90">${escapeHtml(subheading)}</p>
        <div class="mt-8">
          <a href="${escapeHtml(bookingUrl)}" class="inline-block bg-white text-slate-900 hover:bg-slate-100 px-10 py-4 text-lg font-semibold rounded-full shadow-lg transition-all duration-200">${escapeHtml(bookingText)}</a>
        </div>
      </div>
    </div>
  </div>
</section>`
}
