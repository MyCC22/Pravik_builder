# Enriched Template Library Design

## Overview

Expand the Pravik Builder template system from 4 templates to 10, add 12 new section components, and migrate all HTML to Tailwind CSS via CDN for premium, production-grade quality. Inspired by Tailwind Plus and Framer marketplace templates.

## Goals

- Support 5 business categories: Landing/SaaS, Local Services, Restaurant, Agency, Event
- 24 total section components (12 existing refactored + 12 new)
- Premium Tailwind CSS quality matching Tailwind Plus level of polish
- Keep the existing TemplateConfig JSON pipeline (AI returns JSON, we render deterministically)
- Full backward compatibility with existing projects

## Template Categories & Variants

| Category | Variant 1 | Variant 2 | Target User |
|---|---|---|---|
| Landing/SaaS | `landing` | `landing-bold` | Startups, product launches, apps |
| Services | `services` | `services-bold` | Plumber, coach, tutor, trainer, contractor |
| Restaurant | `restaurant` | `restaurant-dark` | Restaurants, cafes, food trucks, bakeries |
| Agency | `agency` | `agency-editorial` | Freelancers, studios, consulting firms |
| Event | `event` | `event-dark` | Conferences, courses, workshops, meetups |

10 templates total. Each variant within a category uses the same sections but with different layout feel (centered vs split hero, grid vs asymmetric gallery).

## Themes (4, unchanged names)

Applied via Tailwind utility classes instead of CSS custom properties:

| Theme | Background | Text | Accent | Surface | Muted | Border |
|---|---|---|---|---|---|---|
| clean | bg-white | text-slate-900 | blue-600 | slate-50 | slate-500 | slate-200 |
| bold | bg-zinc-950 | text-white | indigo-500 | zinc-900 | zinc-400 | zinc-800 |
| vibrant | bg-gradient-to-br from-blue-50 via-purple-50 to-emerald-50 | text-slate-900 | blue-600 | bg-white/80 backdrop-blur-sm | slate-600 | slate-200 |
| warm | bg-stone-50 | text-stone-900 | orange-700 | white | stone-500 | stone-200 |

Theme classes passed to section renderers via a `ThemeClasses` object.

## Section Library (24 total)

### Existing sections (refactored to Tailwind):

| Section | Block Type | Used By |
|---|---|---|
| Navbar | navbar | All |
| Hero Center | hero | landing, services, event |
| Hero Split | hero | agency, restaurant |
| Hero Bold | hero | bold/editorial/dark variants |
| Features Grid | features | landing, services |
| Testimonials | testimonials | All categories |
| Pricing Cards | pricing | landing, event |
| CTA Banner | cta | All categories |
| Gallery Grid | gallery | agency, restaurant |
| Gallery Asymmetric | gallery | bold variants |
| Contact | contact | All categories |
| Footer | footer | All |

### New sections:

| Section | Block Type | Used By | Description |
|---|---|---|---|
| Service Cards | services | services | 3-6 cards with icon, title, description, hover lift |
| Process Steps | process | services, agency | Numbered timeline - "How it works" |
| Team Grid | team | agency, services | Photo placeholder + name + role + bio |
| Client Logos | clients | agency | Row of logo placeholders with grayscale filter |
| FAQ Accordion | faq | services, event | Expandable Q&A pairs with smooth toggle |
| Menu Display | menu | restaurant | Categorized items with name, description, price |
| Hours & Location | hours | restaurant, services | Hours table + address + map placeholder |
| Booking CTA | booking | restaurant, services | Prominent reservation/appointment CTA |
| Schedule/Agenda | schedule | event | Time-blocked agenda with tracks/sessions |
| Speaker Bios | speakers | event | Photo placeholder + name + topic + bio |
| Stats Counter | stats | All | 3-4 large numbers with labels |
| Before/After | before-after | services | Side-by-side comparison cards |

## Template Compositions

### Landing
- `landing`: navbar -> hero-center -> features-grid -> stats -> testimonials -> pricing -> cta-banner -> footer
- `landing-bold`: navbar -> hero-bold -> features-grid -> stats -> testimonials -> pricing -> cta-banner -> footer

### Services
- `services`: navbar -> hero-center -> service-cards -> process-steps -> stats -> testimonials -> faq -> booking-cta -> contact -> footer
- `services-bold`: navbar -> hero-bold -> service-cards -> before-after -> stats -> testimonials -> faq -> booking-cta -> contact -> footer

### Restaurant
- `restaurant`: navbar -> hero-split -> menu-display -> gallery-grid -> testimonials -> hours-location -> booking-cta -> footer
- `restaurant-dark`: navbar -> hero-bold -> menu-display -> gallery-asymmetric -> testimonials -> hours-location -> booking-cta -> footer

### Agency
- `agency`: navbar -> hero-split -> client-logos -> features-grid -> gallery-grid -> process-steps -> team-grid -> testimonials -> cta-banner -> footer
- `agency-editorial`: navbar -> hero-bold -> client-logos -> gallery-asymmetric -> process-steps -> team-grid -> testimonials -> cta-banner -> footer

### Event
- `event`: navbar -> hero-center -> stats -> speakers -> schedule -> pricing -> faq -> cta-banner -> footer
- `event-dark`: navbar -> hero-bold -> stats -> speakers -> schedule -> pricing -> faq -> cta-banner -> footer

Sections are optional: if the AI doesn't provide content for a section, it's skipped.

## Content Schema (TemplateConfig)

```typescript
interface TemplateContent {
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

### New content types:

```typescript
interface ServiceItem { icon: string; title: string; description: string }
interface ProcessStep { step: string; title: string; description: string }
interface TeamMember { name: string; role: string; bio: string }
interface ClientLogo { name: string }
interface FAQItem { question: string; answer: string }
interface MenuCategory { category: string; items: MenuItem[] }
interface MenuItem { name: string; description: string; price: string }
interface HoursEntry { day: string; hours: string }
interface ScheduleItem { time: string; title: string; speaker?: string; description?: string }
interface Speaker { name: string; topic: string; bio: string }
interface StatItem { value: string; label: string }
interface BeforeAfterItem { label: string; before: string; after: string }
```

## Styling Approach

### Tailwind CDN

HTML document shell:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="{theme.bg} antialiased">
  {sections}
</body>
</html>
```

### Quality standards baked into every section:
- `tracking-tight` on headings, `leading-relaxed` on body text
- `rounded-2xl` cards with `ring-1 ring-{border}` (not heavy borders)
- Subtle `shadow-sm` or `shadow-lg` for elevation
- `transition-all duration-200` on interactive elements
- `backdrop-blur-xl` on navbar for frosted glass
- Responsive: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Consistent width: `max-w-7xl mx-auto px-6 lg:px-8`

## Generator Agent Changes

- Describe all 10 template IDs with selection guidance
- Describe all content fields with which templates use them
- Increase max_tokens from 2048 to 4096
- Template selection rules: food business -> restaurant, event/course -> event, creative studio -> agency, any service provider -> services, default -> landing
- Update fallback template ID from `'landing-light'` to `'landing'`

## Block Editor Changes

- Update prompts to know all 24 section types
- Ensure edits preserve Tailwind classes

## Backward Compatibility

### Template ID resolution
Add a `resolveTemplateId()` function in `src/templates/types.ts` (separate from `resolveThemeId()` which handles theme IDs). This maps old template IDs to new ones:
- `landing-light` -> `landing`
- `landing-dark` -> `landing`
- `portfolio-minimal` -> `agency`
- `portfolio-bold` -> `agency-editorial`

Update the generator fallback (line 90-93 in generator.ts) from `'landing-light'` to `'landing'`.

### Old vs new block detection in renderFromBlocks()
When `renderFromBlocks()` loads blocks from the DB, it must detect whether blocks use the old inline-style system or new Tailwind classes. Detection: check if any block's HTML contains `style="` with `var(--` — if so, it's an old project. Wrap old blocks in the legacy CSS variable shell (preserving `getThemeCSS()`). Wrap new blocks in the Tailwind CDN shell.

### Block editor prompt bifurcation
The block editor must detect whether the block being edited uses Tailwind classes or inline CSS variables, and use the appropriate prompt. Detection: if the block HTML contains `class="` with Tailwind utility patterns (e.g., `text-`, `bg-`, `rounded-`, `px-`, `py-`), use the Tailwind-aware prompt. Otherwise use the legacy inline-style prompt. This ensures edits on old projects don't break their styling.

### Navbar mobile menu
The Tailwind navbar will include an inline `onclick` handler for the mobile hamburger toggle (simple `document.getElementById('mobile-menu').classList.toggle('hidden')`). No external JS dependencies.

- No database schema changes needed

## Files Changed

### Deleted:
- src/templates/landing-light.tsx
- src/templates/landing-dark.tsx
- src/templates/portfolio-minimal.tsx
- src/templates/portfolio-bold.tsx
- src/templates/themes.ts
- All 12 existing section files in src/templates/sections/

### Added:
- 10 template files (one per template ID)
- 24 section files (12 refactored + 12 new) in src/templates/sections/
- src/templates/theme-classes.ts (Tailwind class mappings per theme)

### Modified:
- src/templates/types.ts (new template IDs, content interfaces)
- src/templates/render.ts (new template map, Tailwind CDN shell)
- src/templates/render-blocks.ts (detect old vs new blocks)
- src/services/agents/prompts/generator.ts (all 10 templates + content fields)
- src/services/agents/prompts/block-editor.ts (all 24 section types)
- src/services/agents/generator.ts (max_tokens 2048 -> 4096)
