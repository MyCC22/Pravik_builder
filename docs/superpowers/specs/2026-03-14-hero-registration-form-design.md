# Hero Registration Form — Design Spec

**Date:** 2026-03-14
**Status:** Approved
**Approach:** Shared `renderHeroForm()` utility injected into existing hero variants (Approach B)

---

## Problem

Currently, generated websites have no inline forms. Lead capture relies on a "Book Now" button that links out to a separate `/book/[projectId]` page with 4-7 fields. This adds friction and hurts conversion. High-converting landing pages embed a short form (2-4 fields) directly in the hero section.

## Solution Overview

Add an overlapping registration form card to hero sections. The AI decides per-business whether to include it, guided by per-category field hints. The form reuses the existing `tools`/`tool_submissions` pipeline with a new `tool_type = 'hero_registration'`. All styling is theme-driven. Submission is handled by self-contained inline JavaScript.

---

## 1. Hero Form Utility — `renderHeroForm()`

### File
`src/templates/sections/hero-form.tsx`

### Signature
```typescript
export function renderHeroForm(
  toolId: string,
  fields: ToolField[],
  t: ThemeClasses,
  projectId: string,
  submitText?: string,
  successMessage?: string,
  formTitle?: string
): string
```

### Responsibilities
1. Generates the overlapping form card HTML (white/dark card with shadow, positioned to float over the hero bottom edge)
2. Renders 2-4 form fields dynamically from the `fields` array
3. Emits inline `<script>` for client-side validation, fetch submission to `/api/tools/submit`, loading state, error display, and success transition
4. Applies all styling from `ThemeClasses` — zero hardcoded colors

### Guardrails
| Rule | Behavior |
|------|----------|
| **Field count cap** | If >4 fields passed, silently truncates to first 4 |
| **Field type whitelist** | Only renders `text`, `email`, `phone`, `dropdown`. Silently drops `textarea` and `number` |
| **Required name + email** | If fields array is missing a `name` field (type `text`) or an `email` field (type `email`), auto-injects them at the start |
| **Empty toolId** | Returns empty string — hero renders normally without form |
| **escapeHtml()** | Applied to all user-generated content: field labels, placeholders, form title, success message, dropdown options |
| **Responsive** | Fields stack single-column below 640px; button goes full-width on mobile |

---

## 2. Theme Integration

### New ThemeClasses Properties
```typescript
// Added to ThemeClasses interface in theme-classes.ts
formCardBg: string       // e.g., "bg-white" (light) or "bg-gray-900" (dark)
formInputBg: string      // e.g., "bg-gray-50" or "bg-gray-800"
formInputBorder: string  // e.g., "border-gray-200" or "border-gray-700"
formInputText: string    // e.g., "text-gray-900" or "text-white"
formLabelText: string    // e.g., "text-gray-800" or "text-gray-100"
```

### Per-Theme Definitions
Each of the 4 themes (clean, bold, vibrant, warm) defines these properties in `theme-classes.ts`. Dark template variants (restaurant-dark, event-dark) use dark card backgrounds with light text — no jarring white card on dark pages.

### Anti-Mismatch Rules
- Zero hardcoded colors in `renderHeroForm()` — everything comes from `ThemeClasses`
- Button uses existing `t.accentBg` + `t.accentText` + `rounded-full` (matching the pill-shaped CTA pattern from the retheme)
- Card uses existing `t.cardShadow` for shadow consistency
- Form card radius matches `t.cardRadius` or uses `rounded-2xl` to match the section card pattern

---

## 3. Hero Variant Integration

### Parameter Addition
Each hero renderer gets an optional last parameter:

```typescript
// hero-center.tsx
renderHeroCenter(title, subtitle, t, ctaText, ctaUrl, heroImageUrl, tagline, heroFormHtml?)

// hero-bold.tsx
renderHeroBold(title, subtitle, t, ctaText, ctaUrl, heroImageUrl, tagline, heroFormHtml?)

// hero-split.tsx
renderHeroSplit(title, subtitle, t, ctaText, ctaUrl, heroImageUrl, tagline, heroFormHtml?)
```

### Positioning Per Variant
| Variant | Form Placement |
|---------|---------------|
| **hero-center** | Centered below hero text, 80% width desktop / 95% mobile, `-mt-16` overlap into next section |
| **hero-bold** | Same as hero-center — centered with overlap |
| **hero-split** | Replaces right-side content area; sits naturally in the split layout |

### CTA Button Behavior
When `heroFormHtml` is present, the existing CTA button (`ctaText`/`ctaUrl`) is **hidden**. The form replaces it as the primary call-to-action. When `heroFormHtml` is absent, heroes render exactly as they do today — zero changes to existing behavior.

---

## 4. AI Generation — Category Hints

### Generator Prompt Addition
The AI receives a new instruction block in `prompts/generator.ts`:

```
Hero Registration Form:
Decide whether this business would benefit from an inline lead-capture
form in the hero section. Most service businesses, agencies, consultancies,
and appointment-based businesses SHOULD have one. Restaurants with menus,
event pages with ticketing links, or pure portfolio/ecommerce sites may NOT need one.

Set "includeHeroForm": true/false in your response.
If true, provide "heroFormConfig" with:
- "formTitle": short action-oriented heading (e.g., "Get Your Free Quote")
- "submitText": button label (e.g., "Get Started", "Book Now")
- "successMessage": thank-you text shown inline after submission
- "fields": array of 2-4 fields, each with name, label, type, required, placeholder, options

Field rules:
- Use a single "name" field (never split into first/last)
- Allowed types: text, email, phone, dropdown
- Every form MUST have at least name (text) + email (email)
- Maximum 4 fields total

When generating for an unlisted or unknown business category, ALWAYS include
heroFormConfig with fallback fields: name (text, required), email (email, required),
phone (phone, optional).

Every new category MUST have hero form field hints defined. Do not leave them undefined.
```

### Per-Category Hints Table

| Category | includeHeroForm | Suggested Fields | Reasoning |
|----------|----------------|-----------------|-----------|
| `consulting` / `agency` | true | Name, Email, Company | Qualify leads by company |
| `salon` / `spa` / `beauty` | true | Name, Phone, Service (dropdown) | Phone for confirmations, service to route |
| `restaurant` | false | — | Menu/reservation links work better |
| `fitness` / `gym` | true | Name, Email, Phone | Phone for trial class follow-up |
| `medical` / `dental` / `healthcare` | true | Name, Phone, Preferred Time (dropdown) | Phone-first for scheduling |
| `legal` / `finance` | true | Name, Email, Brief Description (text) | Need context before consultation |
| `education` / `tutoring` | true | Name, Email, Subject (dropdown) | Route to right instructor |
| `real_estate` | true | Name, Email, Phone | High-value leads need multiple contact methods |
| `event` | false | — | Ticket links / event details more relevant |
| `ecommerce` | false | — | Products and cart are the CTA |
| `photography` / `portfolio` | true | Name, Email | Simple inquiry |
| **Unknown / fallback** | true | Name, Email, Phone | Safe universal default |

These hints are included in the generator prompt so the AI can reference them. The AI may deviate if the specific business warrants it — hints are guidance, not hard constraints.

### Category Addition Enforcement
The generator prompt includes:
```
When you encounter or create a new business category, you MUST define hero form
field hints for it. Follow the pattern: decide if a hero form is appropriate,
and if so, specify 2-4 optimal fields for that category. Unknown categories
default to Name (text, required), Email (email, required), Phone (phone, optional).
```

---

## 5. Tool Creation Flow

### During `generateWebsite()` in `generator.ts`:

1. AI returns JSON with `includeHeroForm: true` and `heroFormConfig`
2. `validateHeroFormConfig()` runs:
   - Ensures 2-4 fields (truncates excess)
   - Ensures `name` (text) + `email` (email) fields exist (injects if missing)
   - Rejects `textarea` and `number` field types (drops them)
   - Validates field names are snake_case
   - Ensures `submitText` and `successMessage` are non-empty strings (applies defaults if empty)
3. Generator calls `createHeroRegistrationTool(projectId, heroFormConfig)`:
   - Inserts into `tools` table: `tool_type = 'hero_registration'`, `is_active = true`
   - Config stored as JSON with `title`, `subtitle`, `submitText`, `successMessage`, `fields`
   - Returns `toolId`
4. `toolId` + `fields` are passed into template rendering
5. Template composition file calls `renderHeroForm(toolId, fields, t, ...)` and passes result to the hero renderer

### Validation Function
```typescript
function validateHeroFormConfig(config: HeroFormConfig): HeroFormConfig {
  let fields = (config.fields || [])
    .filter(f => ['text', 'email', 'phone', 'dropdown'].includes(f.type))
    .slice(0, 4)

  const hasName = fields.some(f => f.type === 'text' && f.name.includes('name'))
  const hasEmail = fields.some(f => f.type === 'email')

  if (!hasEmail) fields.unshift({ name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'Your email' })
  if (!hasName) fields.unshift({ name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Your name' })

  fields = fields.slice(0, 4) // Re-cap after injection

  return {
    formTitle: config.formTitle || 'Get Started',
    submitText: config.submitText || 'Submit',
    successMessage: config.successMessage || 'Thanks! We will be in touch soon.',
    fields
  }
}
```

---

## 6. TemplateContent Type Extensions

### New Fields in `types.ts`
```typescript
// Hero registration form (optional — AI decides)
includeHeroForm?: boolean
heroFormTitle?: string         // "Get Your Free Quote"
heroFormSubmitText?: string    // "Get Started"
heroFormSuccessMessage?: string // "Thanks! We will be in touch soon."
```

The actual `fields` array and `toolId` live in the `tools` table, not in `TemplateContent`. This maintains the existing separation between content config and tool config.

---

## 7. Template Composition Wiring

### Pattern for All Template Files
```typescript
// In each template composition file (landing.tsx, services.tsx, etc.):

// 1. Build hero form HTML if tool exists
const heroFormHtml = heroToolId
  ? renderHeroForm(heroToolId, heroFormFields, t, projectId,
      content.heroFormSubmitText, content.heroFormSuccessMessage, content.heroFormTitle)
  : undefined

// 2. Pass to hero renderer
sections.push(renderHeroCenter(
  content.heroTitle, content.heroSubtitle, t,
  content.ctaText, content.ctaUrl, heroImageUrl, content.tagline,
  heroFormHtml
))
```

### renderTemplate() Extension
`renderTemplate()` in `render.ts` receives the optional `heroToolId` and `heroFormFields` to pass through to template composition. These come from the generation pipeline which creates the tool row.

### Coexistence with Booking CTA
When `includeHeroForm` is true, the booking CTA section still renders if present (services/restaurant templates). They serve different purposes:
- Hero form: quick inquiry / lead capture (2-4 fields)
- Booking CTA: link to comprehensive booking page (4-7 fields)

The AI prompt is updated to generate non-redundant CTAs (e.g., hero form says "Get a Free Quote", booking CTA says "Schedule a Full Consultation").

---

## 8. Inline JavaScript — Form Submission

### Behavior Spec
Since the generated site is raw HTML in an iframe (no React), the form uses self-contained vanilla JavaScript.

### Submission Flow
```
User fills fields → clicks submit →
  1. Button shows CSS spinner + disables (prevents double-submit)
  2. Client-side validation runs:
     - Required fields: non-empty after trim
     - Email: /.+@.+\..+/ check
     - Phone: at least 7 digit characters
     - Dropdown: non-empty if required
  3. If invalid → red error text below offending field, re-enable button
  4. If valid → POST /api/tools/submit { tool_id, data }
  5. On 200 → form fields fade out, success message fades in (same card dimensions, no layout jump)
  6. On 429 → "Please wait a moment before trying again"
  7. On 4xx/5xx/network → "Something went wrong. Please try again." + re-enable button
```

### Success State
The form card transforms in-place:
- Fields and button fade out (CSS transition: opacity 0, 300ms)
- Success content fades in: animated CSS checkmark + `successMessage` text
- Card dimensions stay the same — no page layout shift

### Security
- All field values stripped of HTML tags before submission (XSS prevention)
- `tool_id` hardcoded in HTML at generation time — not user-modifiable
- No CSRF risk: `/api/tools/submit` doesn't use cookie-based auth

### Constraints
- No external dependencies — pure vanilla JS
- CSS-only spinner (rotating border animation)
- CSS-only checkmark animation
- Total inline JS: target under 2KB minified

---

## 9. Files Modified / Created

### New Files
| File | Purpose |
|------|---------|
| `src/templates/sections/hero-form.tsx` | `renderHeroForm()` utility — form card HTML + inline JS |

### Modified Files
| File | Change |
|------|--------|
| `src/templates/theme-classes.ts` | Add `formCardBg`, `formInputBg`, `formInputBorder`, `formInputText`, `formLabelText` per theme |
| `src/templates/types.ts` | Add `includeHeroForm`, `heroFormTitle`, `heroFormSubmitText`, `heroFormSuccessMessage` |
| `src/templates/sections/hero-center.tsx` | Add optional `heroFormHtml` parameter, position form with overlap |
| `src/templates/sections/hero-bold.tsx` | Add optional `heroFormHtml` parameter, position form with overlap |
| `src/templates/sections/hero-split.tsx` | Add optional `heroFormHtml` parameter, position form in right column |
| `src/templates/render.ts` | Pass `heroToolId`/`heroFormFields` through to template composition |
| `src/templates/render-blocks.ts` | Same pass-through for block-based rendering |
| `src/services/agents/generator.ts` | Add `validateHeroFormConfig()`, `createHeroRegistrationTool()`, wire into generation pipeline |
| `src/services/agents/prompts/generator.ts` | Add hero form instructions, category hints, field rules |
| `src/services/agents/prompts/tool-generator.ts` | Add category hint enforcement for new categories |
| `src/templates/landing.tsx` | Wire `heroFormHtml` to hero renderer |
| `src/templates/landing-bold.tsx` | Wire `heroFormHtml` to hero renderer |
| `src/templates/services.tsx` | Wire `heroFormHtml` to hero renderer |
| `src/templates/services-bold.tsx` | Wire `heroFormHtml` to hero renderer |
| `src/templates/restaurant.tsx` | Wire `heroFormHtml` to hero renderer |
| `src/templates/restaurant-dark.tsx` | Wire `heroFormHtml` to hero renderer |
| `src/templates/agency.tsx` | Wire `heroFormHtml` to hero renderer |
| `src/templates/agency-editorial.tsx` | Wire `heroFormHtml` to hero renderer |
| `src/templates/event.tsx` | Wire `heroFormHtml` to hero renderer |
| `src/templates/event-dark.tsx` | Wire `heroFormHtml` to hero renderer |

### No Database Migrations Needed
The existing `tools` and `tool_submissions` tables support this out of the box:
- `tools.tool_type` accepts any string — `'hero_registration'` works immediately
- `tools.config` is JSON — `HeroFormConfig` structure fits
- `tool_submissions.data` is JSON — hero form submissions store identically to booking submissions
- `/api/tools/submit` validates against whatever fields are in the tool config — no changes needed

---

## 10. What This Does NOT Change

- Existing `/book/[projectId]` page and full booking form — untouched
- Existing `booking` tool type and generation — untouched
- `booking-cta.tsx` section — still renders when present, coexists with hero form
- `contact-section.tsx` — untouched
- Templates without hero forms — render exactly as today
- `/api/tools/submit` endpoint — no changes needed (already generic)
