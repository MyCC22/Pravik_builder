import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderBookingCTA(t: ThemeClasses, bookingText = 'Book Now', bookingUrl = '#contact'): string {
  return `<section id="booking" class="py-20 sm:py-24">
  <div class="max-w-4xl mx-auto px-6 lg:px-8">
    <div class="${t.accentBg} rounded-3xl px-8 py-16 sm:px-16 text-center">
      <h2 class="text-3xl font-bold tracking-tight ${t.accentText} sm:text-4xl">Ready to get started?</h2>
      <p class="mt-4 text-lg ${t.accentText} opacity-90">Book your appointment today and let us take care of the rest.</p>
      <div class="mt-8">
        <a href="${escapeHtml(bookingUrl)}" class="inline-block bg-white text-slate-900 hover:bg-slate-100 px-8 py-4 text-base font-semibold rounded-xl shadow-lg transition-all duration-200">${escapeHtml(bookingText)}</a>
      </div>
    </div>
  </div>
</section>`
}
