import type { GalleryItem } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderGalleryGrid(items: GalleryItem[], t: ThemeClasses): string {
  const cards = items.map((item, i) => {
    const hue = (i * 47 + 200) % 360
    return `<div class="group relative overflow-hidden rounded-2xl ${t.border}">
      <div class="aspect-[4/3]" style="background:linear-gradient(135deg, hsl(${hue},40%,85%), hsl(${(hue+40)%360},50%,75%))"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <div class="absolute bottom-0 left-0 right-0 p-6 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
        <p class="text-white font-semibold">${escapeHtml(item.title)}</p>
        <p class="text-white/70 text-sm">${escapeHtml(item.category)}</p>
      </div>
    </div>`
  }).join('')

  return `<section id="gallery" class="py-24 sm:py-32">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Our work</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${cards}</div>
  </div>
</section>`
}
