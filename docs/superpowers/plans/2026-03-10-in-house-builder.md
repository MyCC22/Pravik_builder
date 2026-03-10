# In-House Website Builder Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace v0's API with a self-hosted template-based builder using pre-built shadcn/ui components, 5 color themes, and Claude Haiku for template selection + content injection.

**Architecture:** Pre-built React templates with CSS variable theming are rendered server-side. Claude Haiku (structured output) picks template/theme and extracts content from user messages (~$0.001/request). Generated HTML is served from self-hosted API routes — no external dependencies.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui, @anthropic-ai/sdk (Claude Haiku), Supabase (Postgres), react-dom/server (renderToString)

**Spec:** `docs/superpowers/specs/2026-03-10-in-house-builder-design.md`

---

## Chunk 1: Foundation — Types, Themes, and AI Service

### Task 1: Install dependencies and update package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Anthropic SDK**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Remove v0-sdk**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npm uninstall v0-sdk
```

- [ ] **Step 3: Add ANTHROPIC_API_KEY to .env.local**

Add this line to `.env.local`:
```
ANTHROPIC_API_KEY=<your-key-here>
```

The user must provide their actual Anthropic API key. The app won't work without it.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: swap v0-sdk for @anthropic-ai/sdk"
```

---

### Task 2: Create template types

**Files:**
- Create: `src/templates/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/templates/types.ts

export const TEMPLATE_IDS = [
  'landing-light',
  'landing-dark',
  'portfolio-minimal',
  'portfolio-bold',
] as const

export type TemplateId = (typeof TEMPLATE_IDS)[number]

export const THEME_IDS = ['ocean', 'sunset', 'violet', 'forest', 'mono'] as const

export type ThemeId = (typeof THEME_IDS)[number]

export interface Feature {
  icon: string
  title: string
  description: string
}

export interface GalleryItem {
  title: string
  category: string
}

export interface Testimonial {
  quote: string
  name: string
  role: string
}

export interface PricingPlan {
  plan: string
  price: string
  features: string[]
  highlighted?: boolean
}

export interface NavLink {
  label: string
  href: string
}

export interface TemplateContent {
  siteName: string
  tagline: string
  heroTitle: string
  heroSubtitle: string
  ctaText?: string
  ctaUrl?: string
  features?: Feature[]
  galleryItems?: GalleryItem[]
  testimonials?: Testimonial[]
  pricing?: PricingPlan[]
  contactEmail?: string
  contactPhone?: string
  footerLinks?: NavLink[]
}

export interface TemplateConfig {
  template: TemplateId
  theme: ThemeId
  content: TemplateContent
}
```

- [ ] **Step 2: Update src/lib/types.ts to add template_config to Project**

In `src/lib/types.ts`, modify the `Project` interface to add the `template_config` field. Also remove the `V0Chat` and `V0Deployment` interfaces since they're no longer needed.

Replace the entire file with:

```typescript
import type { TemplateConfig } from '@/templates/types'

export interface User {
  id: string
  phone_number: string
  created_at: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  v0_chat_id: string | null
  v0_project_id: string | null
  preview_url: string | null
  template_config: TemplateConfig | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  project_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface Session {
  id: string
  user_id: string
  phone_number: string
  session_token: string
  source: 'web' | 'twilio'
  expires_at: string
  created_at: string
}
```

- [ ] **Step 3: Commit**

```bash
git add src/templates/types.ts src/lib/types.ts
git commit -m "feat: add template config types"
```

---

### Task 3: Create color themes

**Files:**
- Create: `src/templates/themes.ts`

- [ ] **Step 1: Create the themes file**

```typescript
// src/templates/themes.ts

import type { ThemeId } from './types'

export interface ThemeColors {
  bg: string
  text: string
  accent: string
  accentText: string
  surface: string
  muted: string
  border: string
}

export const themes: Record<ThemeId, ThemeColors> = {
  ocean: {
    bg: '#0f172a',
    text: '#f8fafc',
    accent: '#3b82f6',
    accentText: '#ffffff',
    surface: 'rgba(255,255,255,0.05)',
    muted: '#94a3b8',
    border: 'rgba(255,255,255,0.1)',
  },
  sunset: {
    bg: '#fefce8',
    text: '#1c1917',
    accent: '#f97316',
    accentText: '#ffffff',
    surface: 'rgba(249,115,22,0.05)',
    muted: '#78716c',
    border: 'rgba(0,0,0,0.1)',
  },
  violet: {
    bg: '#0c0a1a',
    text: '#f5f3ff',
    accent: '#8b5cf6',
    accentText: '#ffffff',
    surface: 'rgba(139,92,246,0.05)',
    muted: '#a78bfa',
    border: 'rgba(255,255,255,0.1)',
  },
  forest: {
    bg: '#f0fdf4',
    text: '#14532d',
    accent: '#16a34a',
    accentText: '#ffffff',
    surface: 'rgba(22,163,74,0.05)',
    muted: '#6b7280',
    border: 'rgba(0,0,0,0.1)',
  },
  mono: {
    bg: '#fafafa',
    text: '#09090b',
    accent: '#18181b',
    accentText: '#ffffff',
    surface: '#f4f4f5',
    muted: '#71717a',
    border: '#e4e4e7',
  },
}

export function getThemeCSS(themeId: ThemeId): string {
  const t = themes[themeId]
  return `
    :root {
      --bg: ${t.bg};
      --text: ${t.text};
      --accent: ${t.accent};
      --accent-text: ${t.accentText};
      --surface: ${t.surface};
      --muted: ${t.muted};
      --border: ${t.border};
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
    }
    a { color: var(--accent); text-decoration: none; }
  `
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/themes.ts
git commit -m "feat: add 5 color themes with CSS variable generation"
```

---

### Task 4: Create AI template picker service

**Files:**
- Create: `src/services/ai/prompts.ts`
- Create: `src/services/ai/template-picker.ts`

- [ ] **Step 1: Create the system prompts file**

```typescript
// src/services/ai/prompts.ts

import { TEMPLATE_IDS, THEME_IDS } from '@/templates/types'
import type { TemplateConfig } from '@/templates/types'

const TEMPLATE_DESCRIPTIONS = `
Templates available:
- "landing-light": Clean SaaS/product landing page with light background. Sections: navbar, centered hero, features grid, pricing cards, CTA banner, footer.
- "landing-dark": Bold modern landing page with dark background. Same sections as landing-light but with dark aesthetic.
- "portfolio-minimal": Clean whitespace-heavy portfolio/showcase. Sections: navbar, split hero with intro text, image gallery grid, about, contact, footer.
- "portfolio-bold": High-contrast editorial portfolio with large typography. Sections: navbar, bold hero, asymmetric gallery, about, contact, footer.
`

const THEME_DESCRIPTIONS = `
Color themes available:
- "ocean": Dark slate background (#0f172a), blue accent — professional, tech
- "sunset": Warm cream background (#fefce8), orange accent — warm, inviting
- "violet": Deep purple background (#0c0a1a), violet accent — modern, creative
- "forest": Light mint background (#f0fdf4), green accent — natural, fresh
- "mono": White background (#fafafa), black accent — timeless, minimal
`

const CONTENT_SCHEMA = `
Content fields (include all that apply to the chosen template):
{
  "siteName": "string - business/brand name",
  "tagline": "string - short tagline",
  "heroTitle": "string - main hero heading",
  "heroSubtitle": "string - hero supporting text",
  "ctaText": "string - call to action button text (landing templates)",
  "ctaUrl": "string - CTA link, default '#contact'",
  "features": [{"icon": "emoji", "title": "string", "description": "string"}] (landing templates, 3-6 items),
  "galleryItems": [{"title": "string", "category": "string"}] (portfolio templates, 4-8 items),
  "testimonials": [{"quote": "string", "name": "string", "role": "string"}] (landing templates, 2-3 items),
  "pricing": [{"plan": "string", "price": "string/mo", "features": ["string"], "highlighted": bool}] (landing templates, 2-3 plans),
  "contactEmail": "string (portfolio templates)",
  "contactPhone": "string (portfolio templates, optional)",
  "footerLinks": [{"label": "string", "href": "#section"}]
}
`

export function getNewChatPrompt(): string {
  return `You are a website template selector. Given a user's description of a website they want, return a JSON object with template, theme, and content.

${TEMPLATE_DESCRIPTIONS}
${THEME_DESCRIPTIONS}
${CONTENT_SCHEMA}

Rules:
- Return ONLY valid JSON, no markdown, no explanation
- Pick the template and theme that best match the user's description
- Generate realistic, professional content based on what the user describes
- If the user doesn't specify a style, default to "landing-light" with "mono" theme
- For landing templates, always include features (3-6), at least 2 testimonials, and 2-3 pricing plans
- For portfolio templates, always include galleryItems (4-8) and contactEmail
- Template IDs: ${JSON.stringify(TEMPLATE_IDS)}
- Theme IDs: ${JSON.stringify(THEME_IDS)}
`
}

export function getUpdatePrompt(currentConfig: TemplateConfig): string {
  return `You are a website template editor. The user wants to modify their existing website. Below is the current configuration.

Current configuration:
${JSON.stringify(currentConfig, null, 2)}

${TEMPLATE_DESCRIPTIONS}
${THEME_DESCRIPTIONS}
${CONTENT_SCHEMA}

Rules:
- Return the FULL updated JSON configuration (not a patch — return the complete object)
- Only change what the user asks to change; keep everything else the same
- Return ONLY valid JSON, no markdown, no explanation
- Template IDs: ${JSON.stringify(TEMPLATE_IDS)}
- Theme IDs: ${JSON.stringify(THEME_IDS)}
`
}
```

- [ ] **Step 2: Create the template picker service**

```typescript
// src/services/ai/template-picker.ts

import Anthropic from '@anthropic-ai/sdk'
import type { TemplateConfig } from '@/templates/types'
import { TEMPLATE_IDS, THEME_IDS } from '@/templates/types'
import { getNewChatPrompt, getUpdatePrompt } from './prompts'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

function validateConfig(parsed: Record<string, unknown>): TemplateConfig {
  const template = parsed.template as string
  const theme = parsed.theme as string

  if (!TEMPLATE_IDS.includes(template as TemplateConfig['template'])) {
    throw new Error(`Invalid template: ${template}`)
  }
  if (!THEME_IDS.includes(theme as TemplateConfig['theme'])) {
    throw new Error(`Invalid theme: ${theme}`)
  }
  if (!parsed.content || typeof parsed.content !== 'object') {
    throw new Error('Missing content object')
  }

  return parsed as unknown as TemplateConfig
}

export async function pickTemplate(
  message: string,
  currentConfig: TemplateConfig | null
): Promise<TemplateConfig> {
  const systemPrompt = currentConfig
    ? getUpdatePrompt(currentConfig)
    : getNewChatPrompt()

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
  })

  const text =
    response.content[0].type === 'text' ? response.content[0].text : ''

  // Strip markdown code fences if present
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()

  const parsed = JSON.parse(cleaned)
  return validateConfig(parsed)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/services/ai/prompts.ts src/services/ai/template-picker.ts
git commit -m "feat: add Claude Haiku template picker service"
```

---

## Chunk 2: Section Components

### Task 5: Create section components — Navbar and Footer

**Files:**
- Create: `src/templates/sections/navbar.tsx`
- Create: `src/templates/sections/footer.tsx`

- [ ] **Step 1: Create navbar component**

```tsx
// src/templates/sections/navbar.tsx

import type { NavLink } from '../types'

interface NavbarProps {
  siteName: string
  links?: NavLink[]
}

export function Navbar({ siteName, links = [] }: NavbarProps) {
  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 24px',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontWeight: 700, fontSize: '18px' }}>{siteName}</span>
      <div style={{ display: 'flex', gap: '24px', fontSize: '14px', color: 'var(--muted)' }}>
        {links.map((link) => (
          <a key={link.label} href={link.href} style={{ color: 'var(--muted)' }}>
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  )
}
```

Note: We use inline styles instead of Tailwind because these components are rendered server-side to standalone HTML via `renderToString`. The generated HTML page won't have Tailwind's CSS loaded — it only has the theme CSS variables. Inline styles ensure the output is self-contained.

- [ ] **Step 2: Create footer component**

```tsx
// src/templates/sections/footer.tsx

import type { NavLink } from '../types'

interface FooterProps {
  siteName: string
  links?: NavLink[]
  copyright?: string
}

export function Footer({ siteName, links = [], copyright }: FooterProps) {
  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      padding: '32px 24px',
      textAlign: 'center',
      fontSize: '14px',
      color: 'var(--muted)',
    }}>
      {links.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '16px' }}>
          {links.map((link) => (
            <a key={link.label} href={link.href} style={{ color: 'var(--muted)' }}>
              {link.label}
            </a>
          ))}
        </div>
      )}
      <p>{copyright || `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`}</p>
    </footer>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/templates/sections/navbar.tsx src/templates/sections/footer.tsx
git commit -m "feat: add navbar and footer section components"
```

---

### Task 6: Create hero section components (3 variants)

**Files:**
- Create: `src/templates/sections/hero-center.tsx`
- Create: `src/templates/sections/hero-split.tsx`
- Create: `src/templates/sections/hero-bold.tsx`

- [ ] **Step 1: Create centered hero (for landing templates)**

```tsx
// src/templates/sections/hero-center.tsx

interface HeroCenterProps {
  title: string
  subtitle: string
  ctaText?: string
  ctaUrl?: string
}

export function HeroCenter({ title, subtitle, ctaText, ctaUrl = '#contact' }: HeroCenterProps) {
  return (
    <section style={{
      padding: '80px 24px',
      textAlign: 'center',
      maxWidth: '720px',
      margin: '0 auto',
    }}>
      <h1 style={{ fontSize: '48px', fontWeight: 800, lineHeight: 1.1, marginBottom: '16px', letterSpacing: '-1px' }}>
        {title}
      </h1>
      <p style={{ fontSize: '18px', color: 'var(--muted)', marginBottom: '32px', lineHeight: 1.6 }}>
        {subtitle}
      </p>
      {ctaText && (
        <a
          href={ctaUrl}
          style={{
            display: 'inline-block',
            background: 'var(--accent)',
            color: 'var(--accent-text)',
            padding: '12px 32px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '16px',
          }}
        >
          {ctaText}
        </a>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Create split hero (for portfolio-minimal)**

```tsx
// src/templates/sections/hero-split.tsx

interface HeroSplitProps {
  title: string
  subtitle: string
  tagline?: string
}

export function HeroSplit({ title, subtitle, tagline }: HeroSplitProps) {
  return (
    <section style={{
      padding: '80px 24px',
      maxWidth: '960px',
      margin: '0 auto',
    }}>
      {tagline && (
        <p style={{ fontSize: '14px', color: 'var(--accent)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '2px' }}>
          {tagline}
        </p>
      )}
      <h1 style={{ fontSize: '40px', fontWeight: 300, lineHeight: 1.3, marginBottom: '16px' }}>
        {title}
      </h1>
      <p style={{ fontSize: '18px', color: 'var(--muted)', maxWidth: '560px', lineHeight: 1.6 }}>
        {subtitle}
      </p>
    </section>
  )
}
```

- [ ] **Step 3: Create bold hero (for portfolio-bold)**

```tsx
// src/templates/sections/hero-bold.tsx

interface HeroBoldProps {
  title: string
  subtitle: string
}

export function HeroBold({ title, subtitle }: HeroBoldProps) {
  return (
    <section style={{
      padding: '100px 24px 60px',
      maxWidth: '960px',
      margin: '0 auto',
    }}>
      <h1 style={{
        fontSize: '64px',
        fontWeight: 900,
        lineHeight: 1.0,
        letterSpacing: '-2px',
        textTransform: 'uppercase',
        marginBottom: '20px',
      }}>
        {title}
      </h1>
      <p style={{ fontSize: '18px', color: 'var(--muted)', maxWidth: '480px' }}>
        {subtitle}
      </p>
    </section>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/templates/sections/hero-center.tsx src/templates/sections/hero-split.tsx src/templates/sections/hero-bold.tsx
git commit -m "feat: add 3 hero section variants"
```

---

### Task 7: Create content section components — Features, Gallery, Testimonials, Pricing

**Files:**
- Create: `src/templates/sections/features-grid.tsx`
- Create: `src/templates/sections/gallery-grid.tsx`
- Create: `src/templates/sections/gallery-asymmetric.tsx`
- Create: `src/templates/sections/testimonials.tsx`
- Create: `src/templates/sections/pricing-cards.tsx`

- [ ] **Step 1: Create features grid**

```tsx
// src/templates/sections/features-grid.tsx

import type { Feature } from '../types'

interface FeaturesGridProps {
  features: Feature[]
}

export function FeaturesGrid({ features }: FeaturesGridProps) {
  return (
    <section style={{ padding: '64px 24px', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '32px',
      }}>
        {features.map((f) => (
          <div key={f.title} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '24px',
          }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>{f.icon}</div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>{f.title}</h3>
            <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6 }}>{f.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create gallery grid (for portfolio-minimal)**

```tsx
// src/templates/sections/gallery-grid.tsx

import type { GalleryItem } from '../types'

interface GalleryGridProps {
  items: GalleryItem[]
}

export function GalleryGrid({ items }: GalleryGridProps) {
  return (
    <section style={{ padding: '64px 24px', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px',
      }}>
        {items.map((item) => (
          <div key={item.title} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '200px',
              background: `linear-gradient(135deg, var(--surface), var(--border))`,
            }} />
            <div style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{item.title}</h3>
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>{item.category}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Create asymmetric gallery (for portfolio-bold)**

```tsx
// src/templates/sections/gallery-asymmetric.tsx

import type { GalleryItem } from '../types'

interface GalleryAsymmetricProps {
  items: GalleryItem[]
}

export function GalleryAsymmetric({ items }: GalleryAsymmetricProps) {
  return (
    <section style={{ padding: '40px 24px', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
        {items.slice(0, 2).map((item) => (
          <div key={item.title} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            overflow: 'hidden',
          }}>
            <div style={{ height: '240px', background: `linear-gradient(135deg, var(--surface), var(--border))` }} />
            <div style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>{item.title}</h3>
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>{item.category}</p>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
        {items.slice(2, 4).map((item) => (
          <div key={item.title} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            overflow: 'hidden',
          }}>
            <div style={{ height: '200px', background: `linear-gradient(135deg, var(--surface), var(--border))` }} />
            <div style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>{item.title}</h3>
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>{item.category}</p>
            </div>
          </div>
        ))}
      </div>
      {items.length > 4 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}>
          {items.slice(4).map((item) => (
            <div key={item.title} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}>
              <div style={{ height: '160px', background: `linear-gradient(135deg, var(--surface), var(--border))` }} />
              <div style={{ padding: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '2px' }}>{item.title}</h3>
                <p style={{ fontSize: '12px', color: 'var(--muted)' }}>{item.category}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Create testimonials**

```tsx
// src/templates/sections/testimonials.tsx

import type { Testimonial } from '../types'

interface TestimonialsProps {
  testimonials: Testimonial[]
}

export function Testimonials({ testimonials }: TestimonialsProps) {
  return (
    <section style={{ padding: '64px 24px', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
      }}>
        {testimonials.map((t) => (
          <div key={t.name} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '24px',
          }}>
            <p style={{ fontSize: '15px', lineHeight: 1.6, marginBottom: '16px', fontStyle: 'italic' }}>
              &ldquo;{t.quote}&rdquo;
            </p>
            <div>
              <p style={{ fontWeight: 600, fontSize: '14px' }}>{t.name}</p>
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>{t.role}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Create pricing cards**

```tsx
// src/templates/sections/pricing-cards.tsx

import type { PricingPlan } from '../types'

interface PricingCardsProps {
  plans: PricingPlan[]
}

export function PricingCards({ plans }: PricingCardsProps) {
  return (
    <section style={{ padding: '64px 24px', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '24px',
        alignItems: 'start',
      }}>
        {plans.map((p) => (
          <div key={p.plan} style={{
            background: p.highlighted ? 'var(--accent)' : 'var(--surface)',
            color: p.highlighted ? 'var(--accent-text)' : 'var(--text)',
            border: p.highlighted ? 'none' : '1px solid var(--border)',
            borderRadius: '12px',
            padding: '32px 24px',
            textAlign: 'center',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>{p.plan}</h3>
            <div style={{ fontSize: '36px', fontWeight: 800, marginBottom: '24px' }}>{p.price}</div>
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '24px', fontSize: '14px', lineHeight: 2 }}>
              {p.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <a
              href="#contact"
              style={{
                display: 'inline-block',
                padding: '10px 24px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                background: p.highlighted ? 'var(--accent-text)' : 'var(--accent)',
                color: p.highlighted ? 'var(--accent)' : 'var(--accent-text)',
              }}
            >
              Get Started
            </a>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/templates/sections/features-grid.tsx src/templates/sections/gallery-grid.tsx src/templates/sections/gallery-asymmetric.tsx src/templates/sections/testimonials.tsx src/templates/sections/pricing-cards.tsx
git commit -m "feat: add features, gallery, testimonials, pricing sections"
```

---

### Task 8: Create CTA and Contact section components

**Files:**
- Create: `src/templates/sections/cta-banner.tsx`
- Create: `src/templates/sections/contact-section.tsx`

- [ ] **Step 1: Create CTA banner**

```tsx
// src/templates/sections/cta-banner.tsx

interface CTABannerProps {
  title: string
  subtitle?: string
  ctaText: string
  ctaUrl?: string
}

export function CTABanner({ title, subtitle, ctaText, ctaUrl = '#contact' }: CTABannerProps) {
  return (
    <section style={{
      padding: '64px 24px',
      textAlign: 'center',
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
    }}>
      <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '12px' }}>{title}</h2>
      {subtitle && (
        <p style={{ fontSize: '16px', color: 'var(--muted)', marginBottom: '24px' }}>{subtitle}</p>
      )}
      <a
        href={ctaUrl}
        style={{
          display: 'inline-block',
          background: 'var(--accent)',
          color: 'var(--accent-text)',
          padding: '12px 32px',
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '16px',
        }}
      >
        {ctaText}
      </a>
    </section>
  )
}
```

- [ ] **Step 2: Create contact section**

```tsx
// src/templates/sections/contact-section.tsx

interface ContactSectionProps {
  email: string
  phone?: string
  address?: string
}

export function ContactSection({ email, phone, address }: ContactSectionProps) {
  return (
    <section id="contact" style={{
      padding: '64px 24px',
      maxWidth: '600px',
      margin: '0 auto',
      textAlign: 'center',
    }}>
      <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '24px' }}>Get in Touch</h2>
      <div style={{ fontSize: '16px', lineHeight: 2, color: 'var(--muted)' }}>
        <p><a href={`mailto:${email}`} style={{ color: 'var(--accent)' }}>{email}</a></p>
        {phone && <p>{phone}</p>}
        {address && <p>{address}</p>}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/templates/sections/cta-banner.tsx src/templates/sections/contact-section.tsx
git commit -m "feat: add CTA banner and contact section components"
```

---

## Chunk 3: Templates and Renderer

### Task 9: Create the 4 template components

**Files:**
- Create: `src/templates/landing-light.tsx`
- Create: `src/templates/landing-dark.tsx`
- Create: `src/templates/portfolio-minimal.tsx`
- Create: `src/templates/portfolio-bold.tsx`

- [ ] **Step 1: Create landing-light template**

```tsx
// src/templates/landing-light.tsx

import type { TemplateContent } from './types'
import { Navbar } from './sections/navbar'
import { HeroCenter } from './sections/hero-center'
import { FeaturesGrid } from './sections/features-grid'
import { Testimonials } from './sections/testimonials'
import { PricingCards } from './sections/pricing-cards'
import { CTABanner } from './sections/cta-banner'
import { Footer } from './sections/footer'

interface LandingLightProps {
  content: TemplateContent
}

export function LandingLight({ content }: LandingLightProps) {
  const navLinks = content.footerLinks || [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Contact', href: '#contact' },
  ]

  return (
    <>
      <Navbar siteName={content.siteName} links={navLinks} />
      <HeroCenter
        title={content.heroTitle}
        subtitle={content.heroSubtitle}
        ctaText={content.ctaText}
        ctaUrl={content.ctaUrl}
      />
      {content.features && content.features.length > 0 && (
        <div id="features">
          <FeaturesGrid features={content.features} />
        </div>
      )}
      {content.testimonials && content.testimonials.length > 0 && (
        <Testimonials testimonials={content.testimonials} />
      )}
      {content.pricing && content.pricing.length > 0 && (
        <div id="pricing">
          <PricingCards plans={content.pricing} />
        </div>
      )}
      <CTABanner
        title="Ready to get started?"
        subtitle={content.tagline}
        ctaText={content.ctaText || 'Get Started'}
      />
      <Footer siteName={content.siteName} links={navLinks} />
    </>
  )
}
```

- [ ] **Step 2: Create landing-dark template**

This is identical in structure to landing-light — the visual difference comes entirely from the theme CSS variables. But we keep it as a separate file so templates can diverge later (e.g., different section order, different hero variant).

```tsx
// src/templates/landing-dark.tsx

import type { TemplateContent } from './types'
import { Navbar } from './sections/navbar'
import { HeroCenter } from './sections/hero-center'
import { FeaturesGrid } from './sections/features-grid'
import { Testimonials } from './sections/testimonials'
import { PricingCards } from './sections/pricing-cards'
import { CTABanner } from './sections/cta-banner'
import { Footer } from './sections/footer'

interface LandingDarkProps {
  content: TemplateContent
}

export function LandingDark({ content }: LandingDarkProps) {
  const navLinks = content.footerLinks || [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Contact', href: '#contact' },
  ]

  return (
    <>
      <Navbar siteName={content.siteName} links={navLinks} />
      <HeroCenter
        title={content.heroTitle}
        subtitle={content.heroSubtitle}
        ctaText={content.ctaText}
        ctaUrl={content.ctaUrl}
      />
      {content.features && content.features.length > 0 && (
        <div id="features">
          <FeaturesGrid features={content.features} />
        </div>
      )}
      {content.testimonials && content.testimonials.length > 0 && (
        <Testimonials testimonials={content.testimonials} />
      )}
      {content.pricing && content.pricing.length > 0 && (
        <div id="pricing">
          <PricingCards plans={content.pricing} />
        </div>
      )}
      <CTABanner
        title="Ready to get started?"
        subtitle={content.tagline}
        ctaText={content.ctaText || 'Get Started'}
      />
      <Footer siteName={content.siteName} links={navLinks} />
    </>
  )
}
```

- [ ] **Step 3: Create portfolio-minimal template**

```tsx
// src/templates/portfolio-minimal.tsx

import type { TemplateContent } from './types'
import { Navbar } from './sections/navbar'
import { HeroSplit } from './sections/hero-split'
import { GalleryGrid } from './sections/gallery-grid'
import { ContactSection } from './sections/contact-section'
import { Footer } from './sections/footer'

interface PortfolioMinimalProps {
  content: TemplateContent
}

export function PortfolioMinimal({ content }: PortfolioMinimalProps) {
  const navLinks = content.footerLinks || [
    { label: 'Work', href: '#work' },
    { label: 'About', href: '#about' },
    { label: 'Contact', href: '#contact' },
  ]

  return (
    <>
      <Navbar siteName={content.siteName} links={navLinks} />
      <HeroSplit
        title={content.heroTitle}
        subtitle={content.heroSubtitle}
        tagline={content.tagline}
      />
      {content.galleryItems && content.galleryItems.length > 0 && (
        <div id="work">
          <GalleryGrid items={content.galleryItems} />
        </div>
      )}
      <ContactSection
        email={content.contactEmail || 'hello@example.com'}
        phone={content.contactPhone}
      />
      <Footer siteName={content.siteName} links={navLinks} />
    </>
  )
}
```

- [ ] **Step 4: Create portfolio-bold template**

```tsx
// src/templates/portfolio-bold.tsx

import type { TemplateContent } from './types'
import { Navbar } from './sections/navbar'
import { HeroBold } from './sections/hero-bold'
import { GalleryAsymmetric } from './sections/gallery-asymmetric'
import { ContactSection } from './sections/contact-section'
import { Footer } from './sections/footer'

interface PortfolioBoldProps {
  content: TemplateContent
}

export function PortfolioBold({ content }: PortfolioBoldProps) {
  const navLinks = content.footerLinks || [
    { label: 'Projects', href: '#work' },
    { label: 'About', href: '#about' },
    { label: 'Contact', href: '#contact' },
  ]

  return (
    <>
      <Navbar siteName={content.siteName} links={navLinks} />
      <HeroBold title={content.heroTitle} subtitle={content.heroSubtitle} />
      {content.galleryItems && content.galleryItems.length > 0 && (
        <div id="work">
          <GalleryAsymmetric items={content.galleryItems} />
        </div>
      )}
      <ContactSection
        email={content.contactEmail || 'hello@example.com'}
        phone={content.contactPhone}
      />
      <Footer siteName={content.siteName} links={navLinks} />
    </>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/templates/landing-light.tsx src/templates/landing-dark.tsx src/templates/portfolio-minimal.tsx src/templates/portfolio-bold.tsx
git commit -m "feat: add 4 template components"
```

---

### Task 10: Create the template renderer

**Files:**
- Create: `src/templates/render.ts`

- [ ] **Step 1: Create the renderer**

This is the core function that takes a `TemplateConfig` and produces a standalone HTML string. It uses React's `renderToString` on the server to render the template component, then wraps it with the theme CSS.

```typescript
// src/templates/render.ts

import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import type { TemplateConfig, TemplateId, TemplateContent } from './types'
import { getThemeCSS } from './themes'
import { LandingLight } from './landing-light'
import { LandingDark } from './landing-dark'
import { PortfolioMinimal } from './portfolio-minimal'
import { PortfolioBold } from './portfolio-bold'

type TemplateComponent = (props: { content: TemplateContent }) => React.JSX.Element

const templateMap: Record<TemplateId, TemplateComponent> = {
  'landing-light': LandingLight,
  'landing-dark': LandingDark,
  'portfolio-minimal': PortfolioMinimal,
  'portfolio-bold': PortfolioBold,
}

export function renderTemplate(config: TemplateConfig): string {
  const Component = templateMap[config.template]
  if (!Component) {
    throw new Error(`Unknown template: ${config.template}`)
  }

  const bodyHtml = renderToString(
    createElement(Component, { content: config.content })
  )

  const themeCSS = getThemeCSS(config.theme)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${config.content.siteName}</title>
  <style>${themeCSS}</style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/render.ts
git commit -m "feat: add template renderer (config → HTML)"
```

---

## Chunk 4: API Routes and Integration

### Task 11: Create the generate API route

**Files:**
- Create: `src/app/api/builder/generate/route.ts`

- [ ] **Step 1: Create the generate endpoint**

```typescript
// src/app/api/builder/generate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { pickTemplate } from '@/services/ai/template-picker'
import { getSupabaseClient } from '@/services/supabase/client'

export async function POST(req: NextRequest) {
  try {
    const { message, project_id } = await req.json()

    if (!message || !project_id) {
      return NextResponse.json(
        { error: 'message and project_id required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Load current config (null for new projects)
    const { data: project } = await supabase
      .from('projects')
      .select('template_config')
      .eq('id', project_id)
      .single()

    const currentConfig = project?.template_config ?? null

    // Call Claude Haiku
    const config = await pickTemplate(message, currentConfig)

    // Store updated config and preview URL
    const previewUrl = `/site/${project_id}`
    await supabase
      .from('projects')
      .update({
        template_config: config,
        preview_url: previewUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project_id)

    // Store messages
    await supabase.from('messages').insert([
      { project_id, role: 'user', content: message },
      { project_id, role: 'assistant', content: `Updated: ${config.template} / ${config.theme}` },
    ])

    return NextResponse.json({ config, previewUrl })
  } catch (error) {
    console.error('Builder generate error:', error)
    return NextResponse.json(
      { error: 'Failed to generate website' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/builder/generate/route.ts
git commit -m "feat: add /api/builder/generate endpoint"
```

---

### Task 12: Create the preview API route

**Files:**
- Create: `src/app/api/builder/preview/[projectId]/route.ts`

- [ ] **Step 1: Create the preview endpoint**

```typescript
// src/app/api/builder/preview/[projectId]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/services/supabase/client'
import { renderTemplate } from '@/templates/render'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params

    const supabase = getSupabaseClient()
    const { data: project, error } = await supabase
      .from('projects')
      .select('template_config')
      .eq('id', projectId)
      .single()

    if (error || !project?.template_config) {
      return new NextResponse(
        '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666"><p>No preview available yet. Send a message to get started.</p></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    const html = renderTemplate(project.template_config)

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    })
  } catch (error) {
    console.error('Preview render error:', error)
    return new NextResponse(
      '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666"><p>Error rendering preview</p></body></html>',
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/builder/preview/[projectId]/route.ts
git commit -m "feat: add /api/builder/preview/[projectId] endpoint"
```

---

### Task 13: Create the public site page

**Files:**
- Create: `src/app/site/[projectId]/page.tsx`

- [ ] **Step 1: Create the public site page**

This is a Next.js server component that renders the same template as the preview route, but as a proper page with a clean URL.

```tsx
// src/app/site/[projectId]/page.tsx

import { getSupabaseClient } from '@/services/supabase/client'
import { renderTemplate } from '@/templates/render'

export default async function SitePage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = getSupabaseClient()
  const { data: project } = await supabase
    .from('projects')
    .select('template_config, name')
    .eq('id', projectId)
    .single()

  if (!project?.template_config) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'sans-serif',
        color: '#666',
      }}>
        <p>Site not found or not yet built.</p>
      </div>
    )
  }

  const html = renderTemplate(project.template_config)

  return (
    <iframe
      srcDoc={html}
      style={{ width: '100%', height: '100vh', border: 'none' }}
      title={project.name || 'Website'}
    />
  )
}
```

Note: We use `srcDoc` with an iframe to render the generated HTML in isolation from the Next.js app's own styles. This keeps the generated site's CSS variables and styles completely separate. An alternative would be returning raw HTML with a custom layout that has no global styles, but `srcDoc` is simpler for MVP.

- [ ] **Step 2: Commit**

```bash
git add src/app/site/[projectId]/page.tsx
git commit -m "feat: add public /site/[projectId] page"
```

---

### Task 14: Update the builder page to use new API

**Files:**
- Modify: `src/app/build/[projectId]/page.tsx`

- [ ] **Step 1: Rewrite the builder page**

Replace the entire file. Key changes:
- Remove `chatId` state (no more v0 chat ID)
- Single `/api/builder/generate` endpoint for both new and follow-up messages
- Preview URL is now `/api/builder/preview/[projectId]` (self-hosted)
- Add share URL display

```tsx
// src/app/build/[projectId]/page.tsx

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { BuilderLayout } from '@/features/builder/builder-layout'
import { PreviewPanel } from '@/features/builder/preview-panel'
import { ChatPanel } from '@/features/builder/chat-panel'
import { useSession } from '@/features/auth/use-session'
import type { Message, Project } from '@/lib/types'

export default function BuilderPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useSession()
  const [project, setProject] = useState<Project | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || !projectId) return

    fetch(`/api/projects`, {
      headers: { 'x-user-id': user.id },
    })
      .then((res) => res.json())
      .then((data) => {
        const proj = data.projects?.find((p: Project) => p.id === projectId)
        if (proj) {
          setProject(proj)
          // If project already has a template, show the preview
          if (proj.template_config) {
            setPreviewUrl(`/api/builder/preview/${projectId}`)
          }
        }
      })
  }, [user, projectId])

  const handleSend = useCallback(
    async (message: string) => {
      if (!projectId) return

      const tempMsg: Message = {
        id: `temp-${Date.now()}`,
        project_id: projectId,
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, tempMsg])
      setLoading(true)

      try {
        const res = await fetch('/api/builder/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, project_id: projectId }),
        })
        const result = await res.json()

        if (result.error) {
          throw new Error(result.error)
        }

        // Force iframe refresh by appending timestamp
        setPreviewUrl(`/api/builder/preview/${projectId}?t=${Date.now()}`)

        const assistantMsg: Message = {
          id: `temp-assistant-${Date.now()}`,
          project_id: projectId,
          role: 'assistant',
          content: `Updated: ${result.config?.template} / ${result.config?.theme}`,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, assistantMsg])
      } catch (err) {
        console.error('Send error:', err)
        const errorMsg: Message = {
          id: `temp-error-${Date.now()}`,
          project_id: projectId,
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, errorMsg])
      } finally {
        setLoading(false)
      }
    },
    [projectId]
  )

  const shareUrl = projectId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/site/${projectId}` : null

  return (
    <BuilderLayout
      preview={<PreviewPanel url={previewUrl} loading={loading} />}
      chat={<ChatPanel messages={messages} onSend={handleSend} loading={loading} />}
      shareUrl={shareUrl}
    />
  )
}
```

- [ ] **Step 2: Update BuilderLayout to accept shareUrl**

Modify `src/features/builder/builder-layout.tsx` to show a share link when available:

```tsx
// src/features/builder/builder-layout.tsx

'use client'

import { ReactNode } from 'react'

interface BuilderLayoutProps {
  preview: ReactNode
  chat: ReactNode
  shareUrl?: string | null
}

export function BuilderLayout({ preview, chat, shareUrl }: BuilderLayoutProps) {
  return (
    <div className="flex flex-col h-dvh bg-black">
      {/* Preview panel - 70% */}
      <div className="h-[70dvh] w-full border-b border-white/10 relative">
        {preview}
        {shareUrl && (
          <div className="absolute top-2 right-2 z-10">
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors"
            >
              Share link
            </a>
          </div>
        )}
      </div>

      {/* Chat panel - 30% */}
      <div className="h-[30dvh] w-full flex flex-col">
        {chat}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/build/[projectId]/page.tsx src/features/builder/builder-layout.tsx
git commit -m "feat: wire builder page to new /api/builder/generate"
```

---

### Task 15: Update constants and clean up v0 references

**Files:**
- Modify: `src/lib/constants.ts`
- Remove: `src/services/v0/platform.ts`
- Remove: `src/services/v0/model.ts`
- Remove: `src/app/api/v0/chat/route.ts`
- Remove: `src/app/api/v0/message/route.ts`
- Remove: `src/app/api/v0/deploy/route.ts`
- Modify: `src/features/deploy/deploy-button.tsx`

- [ ] **Step 1: Update constants**

Replace `src/lib/constants.ts` with:

```typescript
export const ROUTES = {
  LOGIN: '/',
  PROJECTS: '/projects',
  BUILD: (projectId: string) => `/build/${projectId}`,
  SITE: (projectId: string) => `/site/${projectId}`,
} as const

export const API = {
  AUTH_LOGIN: '/api/auth/login',
  PROJECTS: '/api/projects',
  BUILDER_GENERATE: '/api/builder/generate',
  BUILDER_PREVIEW: (projectId: string) => `/api/builder/preview/${projectId}`,
  VOICE_TRANSCRIBE: '/api/voice/transcribe',
} as const
```

- [ ] **Step 2: Update deploy button to show share link instead**

Since sites are now self-hosted, there's no separate "deploy" step. Replace `src/features/deploy/deploy-button.tsx` with a simpler share button:

```tsx
// src/features/deploy/deploy-button.tsx

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface DeployButtonProps {
  projectId: string
  disabled?: boolean
}

export function DeployButton({ projectId, disabled }: DeployButtonProps) {
  const [copied, setCopied] = useState(false)

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/site/${projectId}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleCopy}
      disabled={disabled}
    >
      {copied ? 'Copied!' : 'Copy Link'}
    </Button>
  )
}
```

- [ ] **Step 3: Delete v0 service files and API routes**

```bash
rm src/services/v0/platform.ts
rm src/services/v0/model.ts
rm src/app/api/v0/chat/route.ts
rm src/app/api/v0/message/route.ts
rm src/app/api/v0/deploy/route.ts
rmdir src/services/v0
rmdir src/app/api/v0/chat
rmdir src/app/api/v0/message
rmdir src/app/api/v0/deploy
rmdir src/app/api/v0
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: replace v0 with in-house builder, remove v0 service and routes"
```

---

## Chunk 5: Database Migration and Verification

### Task 16: Add template_config column to Supabase

**Files:**
- None (Supabase dashboard or migration)

- [ ] **Step 1: Run the migration**

Using the Supabase MCP tool, run:

```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS template_config JSONB;
```

This adds the `template_config` column that stores the full `TemplateConfig` JSON object per project.

- [ ] **Step 2: Verify the column exists**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'projects' AND column_name = 'template_config';
```

Expected: one row showing `template_config` with data type `jsonb`.

---

### Task 17: Add ANTHROPIC_API_KEY to Vercel

**Files:**
- None (Vercel dashboard or CLI)

- [ ] **Step 1: Add environment variable to Vercel**

The user needs to add `ANTHROPIC_API_KEY` to their Vercel project's environment variables. This can be done via the Vercel dashboard (Settings → Environment Variables) or CLI:

```bash
vercel env add ANTHROPIC_API_KEY
```

Also add it to `.env.local` for local development:

```
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 2: Verify the build succeeds**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npm run build
```

Expected: Build succeeds with no TypeScript errors.

---

### Task 18: End-to-end verification

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npm run dev
```

- [ ] **Step 2: Test the generate endpoint directly**

```bash
curl -X POST http://localhost:3000/api/builder/generate \
  -H "Content-Type: application/json" \
  -d '{"message": "Build a photography portfolio with dark minimal style", "project_id": "<use-a-real-project-id>"}'
```

Expected: JSON response with `config` object containing `template`, `theme`, and `content` fields.

- [ ] **Step 3: Test the preview endpoint**

Navigate to `http://localhost:3000/api/builder/preview/<project-id>` in a browser.

Expected: Full HTML page rendered with the template and theme applied.

- [ ] **Step 4: Test the public site URL**

Navigate to `http://localhost:3000/site/<project-id>` in a browser.

Expected: Same rendered site at a clean URL.

- [ ] **Step 5: Test the full builder flow**

1. Login with a phone number
2. Create a new project
3. In the builder, type "Create a SaaS landing page for a project management tool"
4. Verify the preview iframe shows a rendered landing page
5. Type "Change the theme to violet"
6. Verify the preview updates with the violet color scheme
7. Click the "Share link" button and verify the URL works in a new tab

- [ ] **Step 6: Commit any final fixes**

```bash
git add -A
git commit -m "fix: final adjustments from e2e testing"
```

---

## Summary

| Chunk | Tasks | What it builds |
|-------|-------|----------------|
| 1: Foundation | Tasks 1-4 | Dependencies, types, themes, AI service |
| 2: Sections | Tasks 5-8 | 12 section components (navbar, heroes, features, gallery, etc.) |
| 3: Templates + Renderer | Tasks 9-10 | 4 template components + HTML renderer |
| 4: API + Integration | Tasks 11-15 | API routes, builder page update, v0 removal |
| 5: Database + Verification | Tasks 16-18 | DB migration, env vars, e2e testing |

**Total: 18 tasks** across 5 chunks. Each task is independently committable.
