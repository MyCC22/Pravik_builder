# Enriched Template Library Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the template library from 4 to 10 templates across 5 business categories, add 12 new section components, and migrate all HTML to Tailwind CSS CDN for premium quality.

**Architecture:** TemplateConfig JSON pipeline stays the same — AI returns structured JSON, we render via pre-built section components. Sections are pure functions returning Tailwind-styled HTML strings. Themes are mapped to Tailwind utility classes via a ThemeClasses object. Backward compatibility preserves old inline-style projects.

**Tech Stack:** TypeScript, Tailwind CSS CDN, Inter font via Google Fonts, Supabase (existing), Anthropic Claude API (existing)

**Spec:** `docs/superpowers/specs/2026-03-10-enriched-template-library-design.md`

**Note:** This project has no test framework. Verification is via TypeScript compilation (`npm run build`) and visual preview inspection.

---

## File Structure

### New files:
- `src/templates/theme-classes.ts` — ThemeClasses type + 4 theme mappings to Tailwind classes
- `src/templates/utils.ts` — escapeHtml utility (extracted from render.ts for clean imports)
- `src/templates/sections/service-cards.tsx` — Service cards section
- `src/templates/sections/process-steps.tsx` — How-it-works timeline
- `src/templates/sections/team-grid.tsx` — Team member grid
- `src/templates/sections/client-logos.tsx` — Client logo row
- `src/templates/sections/faq-accordion.tsx` — FAQ with toggle
- `src/templates/sections/menu-display.tsx` — Restaurant menu
- `src/templates/sections/hours-location.tsx` — Hours table + address
- `src/templates/sections/booking-cta.tsx` — Booking call-to-action
- `src/templates/sections/schedule-agenda.tsx` — Event schedule
- `src/templates/sections/speaker-bios.tsx` — Speaker grid
- `src/templates/sections/stats-counter.tsx` — Stats numbers
- `src/templates/sections/before-after.tsx` — Before/after comparison
- `src/templates/landing.tsx` — Landing template
- `src/templates/landing-bold.tsx` — Landing bold variant
- `src/templates/services.tsx` — Services template
- `src/templates/services-bold.tsx` — Services bold variant
- `src/templates/restaurant.tsx` — Restaurant template
- `src/templates/restaurant-dark.tsx` — Restaurant dark variant
- `src/templates/agency.tsx` — Agency template
- `src/templates/agency-editorial.tsx` — Agency editorial variant
- `src/templates/event.tsx` — Event template
- `src/templates/event-dark.tsx` — Event dark variant

### Modified files:
- `src/templates/types.ts` — New template IDs, content interfaces, resolveTemplateId()
- `src/templates/render.ts` — New template map, Tailwind CDN shell, import utils
- `src/templates/render-blocks.ts` — Old vs new block detection, dual shell
- `src/services/agents/generator.ts` — max_tokens 2048->4096, fallback landing-light->landing
- `src/services/agents/prompts/generator.ts` — All 10 templates + all content fields
- `src/services/agents/prompts/block-editor.ts` — All 24 section types, Tailwind awareness

### Deleted files (after new templates are working):
- `src/templates/landing-light.tsx`
- `src/templates/landing-dark.tsx`
- `src/templates/portfolio-minimal.tsx`
- `src/templates/portfolio-bold.tsx`
- `src/templates/themes.ts` (kept for backward compat in render-blocks.ts, but no longer used by new path)

### Kept for backward compat (NOT deleted despite spec's deletion list):
- `src/templates/themes.ts` — Still needed by render-blocks.ts for legacy inline-style projects. The spec lists this as deleted but its own backward compatibility section requires `getThemeCSS()` which lives here. This is an intentional deviation.

---

## Chunk 1: Foundation

### Task 1: Extract escapeHtml utility

**Files:**
- Create: `src/templates/utils.ts`
- Modify: `src/templates/render.ts`

- [ ] **Step 1: Create utils.ts with escapeHtml**

```typescript
// src/templates/utils.ts
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
```

- [ ] **Step 2: Update render.ts to re-export from utils**

In `src/templates/render.ts`, replace the `escapeHtml` function definition with:
```typescript
export { escapeHtml } from './utils'
```
This preserves all existing section imports (`import { escapeHtml } from '../render'`).

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Compiles successfully. All existing section imports still work.

- [ ] **Step 4: Commit**

```bash
git add src/templates/utils.ts src/templates/render.ts
git commit -m "refactor: extract escapeHtml to utils.ts"
```

---

### Task 2: Update types.ts with new template IDs and content interfaces

**Files:**
- Modify: `src/templates/types.ts`

- [ ] **Step 1: Replace TEMPLATE_IDS and add resolveTemplateId**

Replace the entire `TEMPLATE_IDS` constant and `TemplateId` type with:

```typescript
export const TEMPLATE_IDS = [
  'landing', 'landing-bold',
  'services', 'services-bold',
  'restaurant', 'restaurant-dark',
  'agency', 'agency-editorial',
  'event', 'event-dark',
] as const

export type TemplateId = (typeof TEMPLATE_IDS)[number]

const LEGACY_TEMPLATE_MAP: Record<string, TemplateId> = {
  'landing-light': 'landing',
  'landing-dark': 'landing',
  'portfolio-minimal': 'agency',
  'portfolio-bold': 'agency-editorial',
}

export function resolveTemplateId(id: string): TemplateId {
  if (TEMPLATE_IDS.includes(id as TemplateId)) return id as TemplateId
  if (id in LEGACY_TEMPLATE_MAP) return LEGACY_TEMPLATE_MAP[id]
  return 'landing'
}
```

- [ ] **Step 2: Add new content interfaces after existing ones**

Add after the existing `NavLink` interface:

```typescript
export interface ServiceItem {
  icon: string
  title: string
  description: string
}

export interface ProcessStep {
  step: string
  title: string
  description: string
}

export interface TeamMember {
  name: string
  role: string
  bio: string
}

export interface ClientLogo {
  name: string
}

export interface FAQItem {
  question: string
  answer: string
}

export interface MenuCategory {
  category: string
  items: MenuItem[]
}

export interface MenuItem {
  name: string
  description: string
  price: string
}

export interface HoursEntry {
  day: string
  hours: string
}

export interface ScheduleItem {
  time: string
  title: string
  speaker?: string
  description?: string
}

export interface Speaker {
  name: string
  topic: string
  bio: string
}

export interface StatItem {
  value: string
  label: string
}

export interface BeforeAfterItem {
  label: string
  before: string
  after: string
}
```

- [ ] **Step 3: Expand TemplateContent with new fields**

**IMPORTANT:** Preserve existing interfaces (`Feature`, `GalleryItem`, `Testimonial`, `PricingPlan`, `NavLink`). Only replace the `TemplateContent` interface itself. Replace it with:

```typescript
export interface TemplateContent {
  // Universal
  siteName: string
  tagline: string
  heroTitle: string
  heroSubtitle: string
  ctaText?: string
  ctaUrl?: string
  footerLinks?: NavLink[]

  // Landing
  features?: Feature[]
  testimonials?: Testimonial[]
  pricing?: PricingPlan[]

  // Services
  services?: ServiceItem[]
  process?: ProcessStep[]
  faq?: FAQItem[]
  beforeAfter?: BeforeAfterItem[]
  bookingUrl?: string
  bookingText?: string

  // Restaurant
  menuItems?: MenuCategory[]
  hours?: HoursEntry[]
  address?: string

  // Agency
  team?: TeamMember[]
  clients?: ClientLogo[]
  galleryItems?: GalleryItem[]

  // Event
  schedule?: ScheduleItem[]
  speakers?: Speaker[]

  // Shared
  stats?: StatItem[]
  contactEmail?: string
  contactPhone?: string
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Compiles. Existing code that uses old template IDs (`landing-light`, etc.) will fail type checks — that's expected and will be fixed in later tasks.

- [ ] **Step 5: Commit**

```bash
git add src/templates/types.ts
git commit -m "feat: add 10 template IDs, new content interfaces, resolveTemplateId()"
```

---

### Task 3: Create theme-classes.ts

**Files:**
- Create: `src/templates/theme-classes.ts`

- [ ] **Step 1: Create the ThemeClasses type and 4 theme mappings**

```typescript
// src/templates/theme-classes.ts
import type { ThemeId } from './types'

export interface ThemeClasses {
  // Background
  bg: string
  // Text
  text: string
  textMuted: string
  // Accent (buttons, links, highlights)
  accent: string
  accentHover: string
  accentBg: string
  accentBgHover: string
  accentText: string
  // Surfaces (cards, panels)
  surface: string
  // Borders
  border: string
  borderColor: string
  // Nav
  navBg: string
  // Special
  sectionAlt: string
}

const themeClassMap: Record<ThemeId, ThemeClasses> = {
  clean: {
    bg: 'bg-white',
    text: 'text-slate-900',
    textMuted: 'text-slate-500',
    accent: 'text-blue-600',
    accentHover: 'hover:text-blue-700',
    accentBg: 'bg-blue-600',
    accentBgHover: 'hover:bg-blue-700',
    accentText: 'text-white',
    surface: 'bg-slate-50',
    border: 'ring-1 ring-slate-200',
    borderColor: 'border-slate-200',
    navBg: 'bg-white/80 backdrop-blur-xl',
    sectionAlt: 'bg-slate-50',
  },
  bold: {
    bg: 'bg-zinc-950',
    text: 'text-white',
    textMuted: 'text-zinc-400',
    accent: 'text-indigo-400',
    accentHover: 'hover:text-indigo-300',
    accentBg: 'bg-indigo-500',
    accentBgHover: 'hover:bg-indigo-400',
    accentText: 'text-white',
    surface: 'bg-zinc-900',
    border: 'ring-1 ring-zinc-800',
    borderColor: 'border-zinc-800',
    navBg: 'bg-zinc-950/80 backdrop-blur-xl',
    sectionAlt: 'bg-zinc-900',
  },
  vibrant: {
    bg: 'bg-gradient-to-br from-blue-50 via-purple-50 to-emerald-50',
    text: 'text-slate-900',
    textMuted: 'text-slate-600',
    accent: 'text-blue-600',
    accentHover: 'hover:text-blue-700',
    accentBg: 'bg-blue-600',
    accentBgHover: 'hover:bg-blue-700',
    accentText: 'text-white',
    surface: 'bg-white/70 backdrop-blur-sm',
    border: 'ring-1 ring-slate-200/60',
    borderColor: 'border-slate-200/60',
    navBg: 'bg-white/60 backdrop-blur-xl',
    sectionAlt: 'bg-white/40',
  },
  warm: {
    bg: 'bg-stone-50',
    text: 'text-stone-900',
    textMuted: 'text-stone-500',
    accent: 'text-orange-700',
    accentHover: 'hover:text-orange-800',
    accentBg: 'bg-orange-700',
    accentBgHover: 'hover:bg-orange-800',
    accentText: 'text-white',
    surface: 'bg-white',
    border: 'ring-1 ring-stone-200',
    borderColor: 'border-stone-200',
    navBg: 'bg-stone-50/80 backdrop-blur-xl',
    sectionAlt: 'bg-stone-100/50',
  },
}

export function getThemeClasses(themeId: ThemeId): ThemeClasses {
  return themeClassMap[themeId] || themeClassMap.clean
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 3: Commit**

```bash
git add src/templates/theme-classes.ts
git commit -m "feat: add Tailwind theme class mappings for all 4 themes"
```

---

### Task 4: Update render.ts with Tailwind CDN shell

**Files:**
- Modify: `src/templates/render.ts`

- [ ] **Step 1: Rewrite render.ts**

Replace the entire file. Keep the old template imports commented out temporarily (they'll be replaced in Chunk 4). For now, only the `renderTailwindShell` and `escapeHtml` re-export matter:

```typescript
import type { TemplateConfig, TemplateId } from './types'
import { resolveTemplateId } from './types'
import { getThemeClasses } from './theme-classes'

export { escapeHtml } from './utils'

// Template render functions will be added in Chunk 4
// For now, stub the map — the old templates are deleted in Chunk 5
const templateMap: Record<TemplateId, (config: TemplateConfig) => string> = {} as any

export function renderTemplate(config: TemplateConfig): string {
  const templateId = resolveTemplateId(config.template)
  const render = templateMap[templateId]
  if (!render) {
    throw new Error(`Unknown template: ${templateId}`)
  }

  const bodyHtml = render({ ...config, template: templateId })
  const t = getThemeClasses(config.theme)

  return renderTailwindShell(config.content.siteName, t.bg, bodyHtml)
}

export function renderTailwindShell(title: string, bgClass: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, sans-serif; }
    html { scroll-behavior: smooth; }
  </style>
</head>
<body class="${bgClass} antialiased">
${bodyHtml}
</body>
</html>`
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: May have type errors from old template imports being removed. That's expected — the old template files still reference old IDs. We'll fix this fully in Chunk 4.

- [ ] **Step 3: Commit**

```bash
git add src/templates/render.ts
git commit -m "feat: add Tailwind CDN render shell, stub template map"
```

---

## Chunk 2: Refactored Sections (Universal)

All sections follow the same pattern: pure function taking content data + ThemeClasses, returning an HTML string with Tailwind utility classes. Import `escapeHtml` from `../utils` and `ThemeClasses` from `../theme-classes`.

**Quality standards for EVERY section:**
- `max-w-7xl mx-auto px-6 lg:px-8` for content width
- `tracking-tight` on headings
- `leading-relaxed` or `leading-7` on body text
- `rounded-2xl` on cards with `ring-1` borders (not solid borders)
- `shadow-sm` on cards, `shadow-lg` on elevated elements
- `transition-all duration-200` on interactive/hoverable elements
- Responsive grids: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Generous vertical padding: `py-24 sm:py-32` on sections
- Section headings: `text-3xl font-bold tracking-tight sm:text-4xl`
- Subheadings: `mt-6 text-lg leading-8 {theme.textMuted}`

### Task 5: Rewrite navbar.tsx

**Files:**
- Modify: `src/templates/sections/navbar.tsx`

- [ ] **Step 1: Rewrite with Tailwind classes**

Replace entire file with a sticky frosted-glass navbar with mobile hamburger menu:

```typescript
import type { NavLink } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderNavbar(siteName: string, links: NavLink[], t: ThemeClasses): string {
  const linksHtml = links.map(l =>
    `<a href="${l.href}" class="${t.textMuted} ${t.accentHover} text-sm font-medium transition-colors duration-200">${escapeHtml(l.label)}</a>`
  ).join('')

  const mobileLinksHtml = links.map(l =>
    `<a href="${l.href}" class="block px-3 py-2 ${t.text} text-base font-medium rounded-lg ${t.accentHover} transition-colors">${escapeHtml(l.label)}</a>`
  ).join('')

  return `<nav class="sticky top-0 z-50 ${t.navBg} border-b ${t.borderColor}">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
      <a href="#" class="text-lg font-extrabold tracking-tight ${t.text}">${escapeHtml(siteName)}</a>
      <div class="hidden md:flex items-center gap-8">${linksHtml}</div>
      <button onclick="document.getElementById('mobile-menu').classList.toggle('hidden')" class="md:hidden p-2 ${t.textMuted} rounded-lg">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
    </div>
  </div>
  <div id="mobile-menu" class="hidden md:hidden px-6 pb-4 space-y-1">${mobileLinksHtml}</div>
</nav>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/navbar.tsx
git commit -m "feat: rewrite navbar with Tailwind — sticky, frosted glass, mobile menu"
```

---

### Task 6: Rewrite hero-center.tsx

**Files:**
- Modify: `src/templates/sections/hero-center.tsx`

- [ ] **Step 1: Rewrite with Tailwind classes**

```typescript
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderHeroCenter(title: string, subtitle: string, t: ThemeClasses, ctaText?: string, ctaUrl = '#contact'): string {
  const ctaHtml = ctaText
    ? `<div class="mt-10 flex items-center justify-center gap-x-6">
        <a href="${ctaUrl}" class="${t.accentBg} ${t.accentBgHover} ${t.accentText} px-6 py-3.5 text-sm font-semibold rounded-xl shadow-sm transition-all duration-200">${escapeHtml(ctaText)}</a>
        <a href="#features" class="${t.textMuted} ${t.accentHover} text-sm font-semibold transition-colors">Learn more <span aria-hidden="true">&rarr;</span></a>
      </div>`
    : ''

  return `<section class="py-24 sm:py-32">
  <div class="max-w-4xl mx-auto px-6 lg:px-8 text-center">
    <h1 class="text-4xl font-extrabold tracking-tight ${t.text} sm:text-6xl lg:text-7xl">${escapeHtml(title)}</h1>
    <p class="mt-6 text-lg leading-8 ${t.textMuted} sm:text-xl">${escapeHtml(subtitle)}</p>
    ${ctaHtml}
  </div>
</section>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/hero-center.tsx
git commit -m "feat: rewrite hero-center with Tailwind"
```

---

### Task 7: Rewrite hero-split.tsx

**Files:**
- Modify: `src/templates/sections/hero-split.tsx`

- [ ] **Step 1: Rewrite — two-column hero with gradient placeholder on right**

```typescript
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderHeroSplit(title: string, subtitle: string, t: ThemeClasses, tagline?: string, ctaText?: string, ctaUrl = '#contact'): string {
  const taglineHtml = tagline
    ? `<p class="text-sm font-semibold ${t.accent} tracking-wide uppercase">${escapeHtml(tagline)}</p>`
    : ''
  const ctaHtml = ctaText
    ? `<div class="mt-10">
        <a href="${ctaUrl}" class="${t.accentBg} ${t.accentBgHover} ${t.accentText} px-6 py-3.5 text-sm font-semibold rounded-xl shadow-sm transition-all duration-200">${escapeHtml(ctaText)}</a>
      </div>`
    : ''

  return `<section class="py-24 sm:py-32">
  <div class="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
    <div>
      ${taglineHtml}
      <h1 class="mt-4 text-4xl font-extrabold tracking-tight ${t.text} sm:text-5xl lg:text-6xl">${escapeHtml(title)}</h1>
      <p class="mt-6 text-lg leading-8 ${t.textMuted}">${escapeHtml(subtitle)}</p>
      ${ctaHtml}
    </div>
    <div class="relative">
      <div class="aspect-[4/3] rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 ${t.border} overflow-hidden flex items-center justify-center">
        <svg class="w-16 h-16 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"/></svg>
      </div>
    </div>
  </div>
</section>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/hero-split.tsx
git commit -m "feat: rewrite hero-split with Tailwind — two-column layout"
```

---

### Task 8: Rewrite hero-bold.tsx

**Files:**
- Modify: `src/templates/sections/hero-bold.tsx`

- [ ] **Step 1: Rewrite — full-width dramatic hero with oversized typography**

```typescript
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderHeroBold(title: string, subtitle: string, t: ThemeClasses, ctaText?: string, ctaUrl = '#contact'): string {
  const ctaHtml = ctaText
    ? `<div class="mt-10 flex items-center justify-center gap-x-6">
        <a href="${ctaUrl}" class="${t.accentBg} ${t.accentBgHover} ${t.accentText} px-8 py-4 text-base font-semibold rounded-xl shadow-lg transition-all duration-200">${escapeHtml(ctaText)}</a>
      </div>`
    : ''

  return `<section class="py-32 sm:py-40">
  <div class="max-w-5xl mx-auto px-6 lg:px-8 text-center">
    <h1 class="text-5xl font-black tracking-tight ${t.text} sm:text-7xl lg:text-8xl leading-[0.9]">${escapeHtml(title)}</h1>
    <p class="mt-8 text-xl leading-8 ${t.textMuted} max-w-2xl mx-auto">${escapeHtml(subtitle)}</p>
    ${ctaHtml}
  </div>
</section>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/hero-bold.tsx
git commit -m "feat: rewrite hero-bold with Tailwind — dramatic oversized type"
```

---

### Task 9: Rewrite features-grid.tsx

**Files:**
- Modify: `src/templates/sections/features-grid.tsx`

- [ ] **Step 1: Rewrite with premium card design**

```typescript
import type { Feature } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderFeaturesGrid(features: Feature[], t: ThemeClasses): string {
  const cards = features.map(f =>
    `<div class="${t.surface} ${t.border} rounded-2xl p-8 transition-all duration-200 hover:shadow-lg">
      <div class="flex items-center justify-center w-12 h-12 ${t.accentBg} ${t.accentText} rounded-xl text-xl mb-5">${f.icon}</div>
      <h3 class="text-lg font-semibold ${t.text}">${escapeHtml(f.title)}</h3>
      <p class="mt-2 text-sm leading-6 ${t.textMuted}">${escapeHtml(f.description)}</p>
    </div>`
  ).join('')

  return `<section id="features" class="py-24 sm:py-32">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Everything you need</h2>
      <p class="mt-4 text-lg leading-8 ${t.textMuted}">Built with the tools and features your business needs to succeed.</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${cards}</div>
  </div>
</section>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/features-grid.tsx
git commit -m "feat: rewrite features-grid with Tailwind — premium card design"
```

---

### Task 10: Rewrite testimonials.tsx

**Files:**
- Modify: `src/templates/sections/testimonials.tsx`

- [ ] **Step 1: Rewrite with elegant quote cards**

```typescript
import type { Testimonial } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderTestimonials(testimonials: Testimonial[], t: ThemeClasses): string {
  const cards = testimonials.map(tm =>
    `<div class="${t.surface} ${t.border} rounded-2xl p-8">
      <div class="${t.accent} text-3xl mb-4">&ldquo;</div>
      <p class="text-base leading-7 ${t.text}">${escapeHtml(tm.quote)}</p>
      <div class="mt-6 flex items-center gap-4">
        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex-shrink-0"></div>
        <div>
          <p class="text-sm font-semibold ${t.text}">${escapeHtml(tm.name)}</p>
          <p class="text-sm ${t.textMuted}">${escapeHtml(tm.role)}</p>
        </div>
      </div>
    </div>`
  ).join('')

  return `<section class="py-24 sm:py-32 ${t.sectionAlt}">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Loved by our customers</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">${cards}</div>
  </div>
</section>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/testimonials.tsx
git commit -m "feat: rewrite testimonials with Tailwind — elegant quote cards"
```

---

### Task 11: Rewrite pricing-cards.tsx

**Files:**
- Modify: `src/templates/sections/pricing-cards.tsx`

- [ ] **Step 1: Rewrite with highlighted plan and check icons**

```typescript
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

    return `<div class="${cardBg} rounded-2xl p-8 ${highlighted ? 'shadow-xl scale-105 relative z-10' : 'shadow-sm'}">
      ${highlighted ? '<div class="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-white text-slate-900 text-xs font-bold rounded-full shadow">Most Popular</div>' : ''}
      <h3 class="text-lg font-semibold ${titleColor}">${escapeHtml(p.plan)}</h3>
      <p class="mt-4 flex items-baseline gap-1">
        <span class="text-4xl font-extrabold tracking-tight ${priceColor}">${escapeHtml(p.price)}</span>
      </p>
      <ul class="mt-8 space-y-3">${featuresHtml}</ul>
      <a href="#contact" class="mt-8 block text-center ${btnClass} px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200">Get started</a>
    </div>`
  }).join('')

  return `<section id="pricing" class="py-24 sm:py-32">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Simple, transparent pricing</h2>
      <p class="mt-4 text-lg leading-8 ${t.textMuted}">Choose the plan that works best for you.</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-${plans.length > 2 ? '3' : '2'} gap-8 max-w-5xl mx-auto items-center">${cards}</div>
  </div>
</section>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/pricing-cards.tsx
git commit -m "feat: rewrite pricing-cards with Tailwind — highlighted plans, check icons"
```

---

### Task 12: Rewrite cta-banner.tsx

**Files:**
- Modify: `src/templates/sections/cta-banner.tsx`

- [ ] **Step 1: Rewrite with bold centered CTA section**

```typescript
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderCTABanner(title: string, subtitle: string, t: ThemeClasses, ctaText?: string, ctaUrl = '#contact'): string {
  const btnHtml = ctaText
    ? `<a href="${ctaUrl}" class="${t.accentBg} ${t.accentBgHover} ${t.accentText} px-8 py-4 text-base font-semibold rounded-xl shadow-lg transition-all duration-200">${escapeHtml(ctaText)}</a>`
    : ''

  return `<section class="py-24 sm:py-32">
  <div class="max-w-4xl mx-auto px-6 lg:px-8 text-center">
    <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">${escapeHtml(title)}</h2>
    <p class="mt-4 text-lg leading-8 ${t.textMuted}">${escapeHtml(subtitle)}</p>
    ${btnHtml ? `<div class="mt-10">${btnHtml}</div>` : ''}
  </div>
</section>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/cta-banner.tsx
git commit -m "feat: rewrite cta-banner with Tailwind"
```

---

### Task 13: Rewrite gallery-grid.tsx

**Files:**
- Modify: `src/templates/sections/gallery-grid.tsx`

- [ ] **Step 1: Rewrite with uniform grid and gradient placeholders**

```typescript
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

  return `<section class="py-24 sm:py-32">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Our work</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${cards}</div>
  </div>
</section>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/gallery-grid.tsx
git commit -m "feat: rewrite gallery-grid with Tailwind — hover overlays"
```

---

### Task 14: Rewrite gallery-asymmetric.tsx

**Files:**
- Modify: `src/templates/sections/gallery-asymmetric.tsx`

- [ ] **Step 1: Rewrite with masonry-style layout**

```typescript
import type { GalleryItem } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderGalleryAsymmetric(items: GalleryItem[], t: ThemeClasses): string {
  const cards = items.map((item, i) => {
    const hue = (i * 47 + 200) % 360
    const tall = i % 3 === 0
    return `<div class="group relative overflow-hidden rounded-2xl ${t.border} ${tall ? 'md:row-span-2' : ''}">
      <div class="${tall ? 'aspect-[3/4]' : 'aspect-[4/3]'}" style="background:linear-gradient(135deg, hsl(${hue},40%,85%), hsl(${(hue+40)%360},50%,75%))"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <div class="absolute bottom-0 left-0 right-0 p-6 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
        <p class="text-white font-semibold">${escapeHtml(item.title)}</p>
        <p class="text-white/70 text-sm">${escapeHtml(item.category)}</p>
      </div>
    </div>`
  }).join('')

  return `<section class="py-24 sm:py-32">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Selected work</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-auto">${cards}</div>
  </div>
</section>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/gallery-asymmetric.tsx
git commit -m "feat: rewrite gallery-asymmetric with Tailwind — masonry layout"
```

---

### Task 15: Rewrite contact-section.tsx

**Files:**
- Modify: `src/templates/sections/contact-section.tsx`

- [ ] **Step 1: Rewrite with clean contact card**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/contact-section.tsx
git commit -m "feat: rewrite contact-section with Tailwind — icon cards"
```

---

### Task 16: Rewrite footer.tsx

**Files:**
- Modify: `src/templates/sections/footer.tsx`

- [ ] **Step 1: Rewrite with refined footer**

```typescript
import type { NavLink } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderFooter(siteName: string, links: NavLink[], t: ThemeClasses, copyright?: string): string {
  const linksHtml = links.length > 0
    ? `<div class="flex justify-center gap-8 flex-wrap mb-8">
        ${links.map(l => `<a href="${l.href}" class="${t.textMuted} ${t.accentHover} text-sm transition-colors">${escapeHtml(l.label)}</a>`).join('')}
      </div>`
    : ''
  const year = new Date().getFullYear()
  const copyrightText = copyright || `&copy; ${year} ${escapeHtml(siteName)}. All rights reserved.`

  return `<footer class="border-t ${t.borderColor} py-12">
  <div class="max-w-7xl mx-auto px-6 lg:px-8 text-center">
    ${linksHtml}
    <p class="text-sm ${t.textMuted}">${copyrightText}</p>
  </div>
</footer>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/footer.tsx
git commit -m "feat: rewrite footer with Tailwind"
```

---

### Task 17: Build verification for Chunk 2

- [ ] **Step 1: Run build**

Run: `npm run build`
Expected: **The build WILL have type errors** from old template files (`landing-light.tsx`, `landing-dark.tsx`, `portfolio-minimal.tsx`, `portfolio-bold.tsx`) because section function signatures changed (e.g., `renderNavbar` now takes 3 args instead of 2). **Do NOT fix these errors.** The old template files are deleted and replaced in Chunk 4, which resolves all signature mismatches. New section files themselves should compile cleanly.

---

## Chunk 3: New Section Components

All new sections follow the same pattern as Chunk 2. Each takes content data + ThemeClasses, returns Tailwind HTML.

### Task 18: Create stats-counter.tsx

**Files:**
- Create: `src/templates/sections/stats-counter.tsx`

- [ ] **Step 1: Create large-number stats section**

```typescript
import type { StatItem } from '../types'
import type { ThemeClasses } from '../theme-classes'

export function renderStatsCounter(stats: StatItem[], t: ThemeClasses): string {
  const items = stats.map(s =>
    `<div class="text-center">
      <p class="text-4xl font-extrabold tracking-tight ${t.accent} sm:text-5xl">${s.value}</p>
      <p class="mt-2 text-sm font-medium ${t.textMuted}">${s.label}</p>
    </div>`
  ).join('')

  return `<section class="py-20 sm:py-24 ${t.sectionAlt}">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="grid grid-cols-2 md:grid-cols-${stats.length > 3 ? '4' : stats.length} gap-8">${items}</div>
  </div>
</section>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/stats-counter.tsx
git commit -m "feat: add stats-counter section"
```

---

### Task 19: Create service-cards.tsx

**Files:**
- Create: `src/templates/sections/service-cards.tsx`

- [ ] **Step 1: Create service cards with hover lift**

```typescript
import type { ServiceItem } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderServiceCards(services: ServiceItem[], t: ThemeClasses): string {
  const cards = services.map(s =>
    `<div class="${t.surface} ${t.border} rounded-2xl p-8 transition-all duration-200 hover:shadow-lg hover:-translate-y-1">
      <div class="text-3xl mb-4">${s.icon}</div>
      <h3 class="text-lg font-semibold ${t.text}">${escapeHtml(s.title)}</h3>
      <p class="mt-2 text-sm leading-6 ${t.textMuted}">${escapeHtml(s.description)}</p>
    </div>`
  ).join('')

  return `<section class="py-24 sm:py-32">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">What we offer</h2>
      <p class="mt-4 text-lg leading-8 ${t.textMuted}">Professional services tailored to your needs.</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">${cards}</div>
  </div>
</section>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/service-cards.tsx
git commit -m "feat: add service-cards section"
```

---

### Task 20: Create process-steps.tsx

**Files:**
- Create: `src/templates/sections/process-steps.tsx`

- [ ] **Step 1: Create numbered timeline section**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/process-steps.tsx
git commit -m "feat: add process-steps section — numbered timeline"
```

---

### Task 21: Create team-grid.tsx

**Files:**
- Create: `src/templates/sections/team-grid.tsx`

- [ ] **Step 1: Create team member grid**

```typescript
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

  return `<section class="py-24 sm:py-32">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Meet the team</h2>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">${cards}</div>
  </div>
</section>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/team-grid.tsx
git commit -m "feat: add team-grid section"
```

---

### Task 22: Create client-logos.tsx

**Files:**
- Create: `src/templates/sections/client-logos.tsx`

- [ ] **Step 1: Create logo row with grayscale placeholders**

```typescript
import type { ClientLogo } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderClientLogos(clients: ClientLogo[], t: ThemeClasses): string {
  const logos = clients.map(c =>
    `<div class="flex items-center justify-center px-8 py-4 ${t.surface} rounded-xl ${t.border}">
      <span class="text-sm font-semibold ${t.textMuted} tracking-wide uppercase">${escapeHtml(c.name)}</span>
    </div>`
  ).join('')

  return `<section class="py-16 sm:py-20">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <p class="text-center text-sm font-medium ${t.textMuted} mb-8">Trusted by leading companies</p>
    <div class="flex flex-wrap items-center justify-center gap-4">${logos}</div>
  </div>
</section>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/client-logos.tsx
git commit -m "feat: add client-logos section"
```

---

### Task 23: Create faq-accordion.tsx

**Files:**
- Create: `src/templates/sections/faq-accordion.tsx`

- [ ] **Step 1: Create FAQ with details/summary toggle (no JS needed)**

```typescript
import type { FAQItem } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderFAQ(faq: FAQItem[], t: ThemeClasses): string {
  const items = faq.map(f =>
    `<details class="group border-b ${t.borderColor} py-6">
      <summary class="flex justify-between items-center cursor-pointer list-none">
        <h3 class="text-base font-semibold ${t.text} pr-4">${escapeHtml(f.question)}</h3>
        <svg class="w-5 h-5 ${t.textMuted} flex-shrink-0 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </summary>
      <p class="mt-4 text-sm leading-6 ${t.textMuted}">${escapeHtml(f.answer)}</p>
    </details>`
  ).join('')

  return `<section class="py-24 sm:py-32">
  <div class="max-w-3xl mx-auto px-6 lg:px-8">
    <div class="text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Frequently asked questions</h2>
    </div>
    <div>${items}</div>
  </div>
</section>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/faq-accordion.tsx
git commit -m "feat: add faq-accordion section — details/summary toggle"
```

---

### Task 24: Create menu-display.tsx

**Files:**
- Create: `src/templates/sections/menu-display.tsx`

- [ ] **Step 1: Create restaurant menu with categories**

```typescript
import type { MenuCategory } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderMenuDisplay(categories: MenuCategory[], t: ThemeClasses): string {
  const sections = categories.map(cat => {
    const items = cat.items.map(item =>
      `<div class="flex justify-between items-start py-4 border-b ${t.borderColor} last:border-0">
        <div class="pr-4">
          <h4 class="text-base font-semibold ${t.text}">${escapeHtml(item.name)}</h4>
          <p class="mt-1 text-sm ${t.textMuted}">${escapeHtml(item.description)}</p>
        </div>
        <span class="text-base font-semibold ${t.accent} whitespace-nowrap">${escapeHtml(item.price)}</span>
      </div>`
    ).join('')

    return `<div class="mb-12 last:mb-0">
      <h3 class="text-xl font-bold ${t.text} mb-6 pb-2 border-b-2 ${t.borderColor}">${escapeHtml(cat.category)}</h3>
      ${items}
    </div>`
  }).join('')

  return `<section class="py-24 sm:py-32">
  <div class="max-w-3xl mx-auto px-6 lg:px-8">
    <div class="text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Our menu</h2>
    </div>
    ${sections}
  </div>
</section>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/menu-display.tsx
git commit -m "feat: add menu-display section — categorized restaurant menu"
```

---

### Task 25: Create hours-location.tsx

**Files:**
- Create: `src/templates/sections/hours-location.tsx`

- [ ] **Step 1: Create hours table + address section**

```typescript
import type { HoursEntry } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderHoursLocation(hours: HoursEntry[], t: ThemeClasses, address?: string): string {
  const hoursHtml = hours.map(h =>
    `<div class="flex justify-between py-3 border-b ${t.borderColor} last:border-0">
      <span class="font-medium ${t.text}">${escapeHtml(h.day)}</span>
      <span class="${t.textMuted}">${escapeHtml(h.hours)}</span>
    </div>`
  ).join('')

  const addressHtml = address
    ? `<div class="${t.surface} ${t.border} rounded-2xl p-8">
        <h3 class="text-lg font-semibold ${t.text} mb-4">Location</h3>
        <p class="${t.textMuted}">${escapeHtml(address)}</p>
        <div class="mt-4 aspect-[16/9] rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center ${t.border}">
          <span class="text-sm ${t.textMuted}">Map</span>
        </div>
      </div>`
    : ''

  return `<section class="py-24 sm:py-32 ${t.sectionAlt}">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Visit us</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
      <div class="${t.surface} ${t.border} rounded-2xl p-8">
        <h3 class="text-lg font-semibold ${t.text} mb-4">Hours</h3>
        ${hoursHtml}
      </div>
      ${addressHtml}
    </div>
  </div>
</section>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/hours-location.tsx
git commit -m "feat: add hours-location section — hours table + address"
```

---

### Task 26: Create booking-cta.tsx

**Files:**
- Create: `src/templates/sections/booking-cta.tsx`

- [ ] **Step 1: Create prominent booking call-to-action**

```typescript
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderBookingCTA(t: ThemeClasses, bookingText = 'Book Now', bookingUrl = '#contact'): string {
  return `<section class="py-20 sm:py-24">
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
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/booking-cta.tsx
git commit -m "feat: add booking-cta section — accent-colored banner"
```

---

### Task 27: Create schedule-agenda.tsx

**Files:**
- Create: `src/templates/sections/schedule-agenda.tsx`

- [ ] **Step 1: Create event schedule section**

```typescript
import type { ScheduleItem } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderSchedule(schedule: ScheduleItem[], t: ThemeClasses): string {
  const items = schedule.map(s =>
    `<div class="flex gap-6 py-6 border-b ${t.borderColor} last:border-0">
      <div class="flex-shrink-0 w-20 text-right">
        <span class="text-sm font-semibold ${t.accent}">${escapeHtml(s.time)}</span>
      </div>
      <div>
        <h3 class="text-base font-semibold ${t.text}">${escapeHtml(s.title)}</h3>
        ${s.speaker ? `<p class="text-sm ${t.accent} font-medium mt-1">${escapeHtml(s.speaker)}</p>` : ''}
        ${s.description ? `<p class="mt-1 text-sm ${t.textMuted}">${escapeHtml(s.description)}</p>` : ''}
      </div>
    </div>`
  ).join('')

  return `<section class="py-24 sm:py-32">
  <div class="max-w-3xl mx-auto px-6 lg:px-8">
    <div class="text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Schedule</h2>
    </div>
    <div>${items}</div>
  </div>
</section>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/schedule-agenda.tsx
git commit -m "feat: add schedule-agenda section — time-blocked event list"
```

---

### Task 28: Create speaker-bios.tsx

**Files:**
- Create: `src/templates/sections/speaker-bios.tsx`

- [ ] **Step 1: Create speaker grid**

```typescript
import type { Speaker } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderSpeakerBios(speakers: Speaker[], t: ThemeClasses): string {
  const cards = speakers.map((s, i) => {
    const hue = (i * 53 + 220) % 360
    return `<div class="${t.surface} ${t.border} rounded-2xl p-8 text-center">
      <div class="w-20 h-20 mx-auto rounded-full mb-4" style="background:linear-gradient(135deg, hsl(${hue},35%,80%), hsl(${(hue+30)%360},45%,70%))"></div>
      <h3 class="text-base font-semibold ${t.text}">${escapeHtml(s.name)}</h3>
      <p class="text-sm ${t.accent} font-medium mt-1">${escapeHtml(s.topic)}</p>
      <p class="mt-3 text-sm ${t.textMuted}">${escapeHtml(s.bio)}</p>
    </div>`
  }).join('')

  return `<section class="py-24 sm:py-32 ${t.sectionAlt}">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Speakers</h2>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">${cards}</div>
  </div>
</section>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/speaker-bios.tsx
git commit -m "feat: add speaker-bios section"
```

---

### Task 29: Create before-after.tsx

**Files:**
- Create: `src/templates/sections/before-after.tsx`

- [ ] **Step 1: Create side-by-side comparison cards**

```typescript
import type { BeforeAfterItem } from '../types'
import type { ThemeClasses } from '../theme-classes'
import { escapeHtml } from '../utils'

export function renderBeforeAfter(items: BeforeAfterItem[], t: ThemeClasses): string {
  const cards = items.map(item =>
    `<div class="${t.surface} ${t.border} rounded-2xl p-8">
      <h3 class="text-lg font-semibold ${t.text} mb-6">${escapeHtml(item.label)}</h3>
      <div class="grid grid-cols-2 gap-4">
        <div class="rounded-xl bg-red-50 border border-red-200 p-4">
          <p class="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Before</p>
          <p class="text-sm ${t.text}">${escapeHtml(item.before)}</p>
        </div>
        <div class="rounded-xl bg-green-50 border border-green-200 p-4">
          <p class="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">After</p>
          <p class="text-sm ${t.text}">${escapeHtml(item.after)}</p>
        </div>
      </div>
    </div>`
  ).join('')

  return `<section class="py-24 sm:py-32">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="max-w-2xl mx-auto text-center mb-16">
      <h2 class="text-3xl font-bold tracking-tight ${t.text} sm:text-4xl">Real results</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">${cards}</div>
  </div>
</section>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/sections/before-after.tsx
git commit -m "feat: add before-after section — side-by-side comparison"
```

---

### Task 30: Build verification for Chunk 3

- [ ] **Step 1: Run build**

Run: `npm run build`
Expected: New section files should compile. Old template files will have errors due to changed section signatures — this is expected and will be resolved in Chunk 4 when old template files are deleted and replaced.

- [ ] **Step 2: Commit any fixes**

If any new section files have TypeScript issues, fix them and commit.

---

## Chunk 4: Template Compositions + Render Integration

### Task 31-40: Create all 10 template files

Each template file follows the same pattern: import section renderers + ThemeClasses, compose sections in order, return combined HTML. Create all 10 files.

**Files to create:**
- `src/templates/landing.tsx` — hero-center
- `src/templates/landing-bold.tsx` — hero-bold
- `src/templates/services.tsx` — hero-center
- `src/templates/services-bold.tsx` — hero-bold
- `src/templates/restaurant.tsx` — hero-split
- `src/templates/restaurant-dark.tsx` — hero-bold
- `src/templates/agency.tsx` — hero-split
- `src/templates/agency-editorial.tsx` — hero-bold
- `src/templates/event.tsx` — hero-center
- `src/templates/event-dark.tsx` — hero-bold

**Hero variant rule:** Standard variants use `renderHeroCenter` or `renderHeroSplit`. Bold/dark/editorial variants always use `renderHeroBold`. Gallery sections: standard variants use `renderGalleryGrid`, editorial/dark use `renderGalleryAsymmetric`.

**Pattern for each template (example: `landing.tsx`):**

```typescript
import type { TemplateConfig } from './types'
import { getThemeClasses } from './theme-classes'
import { renderNavbar } from './sections/navbar'
import { renderHeroCenter } from './sections/hero-center'
import { renderFeaturesGrid } from './sections/features-grid'
import { renderStatsCounter } from './sections/stats-counter'
import { renderTestimonials } from './sections/testimonials'
import { renderPricingCards } from './sections/pricing-cards'
import { renderCTABanner } from './sections/cta-banner'
import { renderFooter } from './sections/footer'

export function renderLanding(config: TemplateConfig): string {
  const { content } = config
  const t = getThemeClasses(config.theme)
  const links = content.footerLinks || [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Contact', href: '#contact' },
  ]

  const sections: string[] = [
    renderNavbar(content.siteName, links, t),
    renderHeroCenter(content.heroTitle, content.heroSubtitle, t, content.ctaText, content.ctaUrl),
  ]

  if (content.features?.length) sections.push(renderFeaturesGrid(content.features, t))
  if (content.stats?.length) sections.push(renderStatsCounter(content.stats, t))
  if (content.testimonials?.length) sections.push(renderTestimonials(content.testimonials, t))
  if (content.pricing?.length) sections.push(renderPricingCards(content.pricing, t))

  sections.push(renderCTABanner('Ready to get started?', content.tagline, t, content.ctaText, content.ctaUrl))
  sections.push(renderFooter(content.siteName, links, t))

  return sections.join('\n')
}
```

- [ ] **Step 1: Create all 10 template files following the compositions from the spec**

Use the composition order defined in the spec for each template. Each bold/dark/editorial variant swaps hero-center for hero-bold and gallery-grid for gallery-asymmetric.

- [ ] **Step 2: Wire template map in render.ts**

Update `src/templates/render.ts` to import all 10 templates and populate the `templateMap`:

```typescript
import { renderLanding } from './landing'
import { renderLandingBold } from './landing-bold'
import { renderServices } from './services'
import { renderServicesBold } from './services-bold'
import { renderRestaurant } from './restaurant'
import { renderRestaurantDark } from './restaurant-dark'
import { renderAgency } from './agency'
import { renderAgencyEditorial } from './agency-editorial'
import { renderEvent } from './event'
import { renderEventDark } from './event-dark'

const templateMap: Record<TemplateId, (config: TemplateConfig) => string> = {
  'landing': renderLanding,
  'landing-bold': renderLandingBold,
  'services': renderServices,
  'services-bold': renderServicesBold,
  'restaurant': renderRestaurant,
  'restaurant-dark': renderRestaurantDark,
  'agency': renderAgency,
  'agency-editorial': renderAgencyEditorial,
  'event': renderEvent,
  'event-dark': renderEventDark,
}
```

- [ ] **Step 3: Delete old template files**

```bash
rm src/templates/landing-light.tsx src/templates/landing-dark.tsx src/templates/portfolio-minimal.tsx src/templates/portfolio-bold.tsx
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Compiles successfully with all new templates.

- [ ] **Step 5: Commit**

```bash
git add -A src/templates/
git commit -m "feat: add 10 template compositions, wire render map, delete old templates"
```

---

## Chunk 5: Backward Compat + Agent Prompts

### Task 41: Update render-blocks.ts for old vs new detection

**Files:**
- Modify: `src/templates/render-blocks.ts`

- [ ] **Step 1: Add dual-shell rendering**

```typescript
import { getSupabaseClient } from '@/services/supabase/client'
import { getThemeCSS } from './themes'  // Keep for legacy
import { renderTailwindShell } from './render'
import { getThemeClasses } from './theme-classes'

function isLegacyBlock(html: string): boolean {
  return html.includes('var(--') || (html.includes('style="') && !html.includes('class="'))
}

export async function renderFromBlocks(projectId: string): Promise<string | null> {
  const supabase = getSupabaseClient()

  const { data: blocks, error: blocksError } = await supabase
    .from('blocks')
    .select('html, position')
    .eq('project_id', projectId)
    .order('position', { ascending: true })

  if (blocksError || !blocks || blocks.length === 0) return null

  const { data: project } = await supabase
    .from('projects')
    .select('theme, name')
    .eq('id', projectId)
    .single()

  const themeId = project?.theme || 'clean'
  const siteName = project?.name || 'Website'
  const bodyHtml = blocks.map(b => b.html).join('\n')

  // Detect old inline-style blocks vs new Tailwind blocks
  const firstContentBlock = blocks.find(b => !b.html.trim().startsWith('<nav'))
  const legacy = firstContentBlock ? isLegacyBlock(firstContentBlock.html) : false

  if (legacy) {
    const themeCSS = getThemeCSS(themeId)
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${siteName}</title>
  <style>${themeCSS}</style>
</head>
<body>${bodyHtml}</body>
</html>`
  }

  const t = getThemeClasses(themeId as any)
  return renderTailwindShell(siteName, t.bg, bodyHtml)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/render-blocks.ts
git commit -m "feat: dual-shell render — detect legacy inline vs Tailwind blocks"
```

---

### Task 42: Update generator.ts

**Files:**
- Modify: `src/services/agents/generator.ts`

- [ ] **Step 1: Update max_tokens and fallback**

Change `max_tokens: 2048` to `max_tokens: 4096`.

Replace the existing import line:
```typescript
// OLD:
import { TEMPLATE_IDS, THEME_IDS } from '@/templates/types'
// NEW:
import { TEMPLATE_IDS, THEME_IDS, resolveTemplateId } from '@/templates/types'
```

Replace the manual template validation (lines 90-93) with `resolveTemplateId`:
```typescript
// OLD:
const template: TemplateId = TEMPLATE_IDS.includes(parsed.template as TemplateId)
  ? (parsed.template as TemplateId)
  : 'landing-light'
// NEW:
const template = resolveTemplateId(parsed.template)
```

This handles both new template IDs and legacy ID remapping (`landing-light` -> `landing`, etc.).

- [ ] **Step 2: Commit**

```bash
git add src/services/agents/generator.ts
git commit -m "fix: update generator — 4096 tokens, resolve template IDs"
```

---

### Task 43: Rewrite generator prompt

**Files:**
- Modify: `src/services/agents/prompts/generator.ts`

- [ ] **Step 1: Replace entire generator prompt**

Rewrite `getGeneratorPrompt()` to describe all 10 templates, all content fields, and template selection rules. Include:
- All 10 template IDs with when to use each
- All 4 themes with personality descriptions
- Full TemplateContent schema with field descriptions
- Decision rules: food business -> restaurant, event/course -> event, creative studio -> agency, service provider -> services, default -> landing
- Content requirements per template (e.g., services template needs services array, process array, etc.)

- [ ] **Step 2: Commit**

```bash
git add src/services/agents/prompts/generator.ts
git commit -m "feat: rewrite generator prompt for 10 templates + all content types"
```

---

### Task 44: Update block-editor prompt

**Files:**
- Modify: `src/services/agents/prompts/block-editor.ts`

- [ ] **Step 1: Update block editor prompts for Tailwind awareness**

Update `getBlockEditorPrompt()` to:
- Detect if the block uses Tailwind (contains utility classes like `text-`, `bg-`, `rounded-`, `px-`) vs legacy inline styles
- If Tailwind: instruct the AI to preserve Tailwind utility classes, use the same pattern
- If legacy: keep existing instructions about CSS variables
- List all 24 section types so the AI knows what it's editing

Update `getAddBlockPrompt()` similarly — new blocks always use Tailwind.

- [ ] **Step 2: Commit**

```bash
git add src/services/agents/prompts/block-editor.ts
git commit -m "feat: update block-editor prompts — Tailwind-aware, all 24 section types"
```

---

### Task 45: Full build + visual verification

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: Clean compile, no errors.

- [ ] **Step 2: Start dev server and test generation**

Run: `npm run dev`
Navigate to the app, create a new project, type "I'm a soccer coach in Palo Alto and want a website."
Expected: Services template renders with Tailwind CSS, professional quality.

- [ ] **Step 3: Test each template category**

Test with different prompts to trigger each template:
- "SaaS app for project management" → landing
- "Italian restaurant in downtown SF" → restaurant
- "Design agency portfolio" → agency
- "Annual tech conference" → event

- [ ] **Step 4: Test theme switching**

Via chat: "Change the theme to bold" / "Make it warm" / "Use the vibrant theme"
Verify each theme applies correctly.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "feat: enriched template library — 10 templates, 24 sections, Tailwind CSS"
git push
```
