# In-House Website Builder — Design Spec

## Overview

Replace v0's API with a self-hosted, template-based website builder. Pre-built templates and color themes are assembled at build time using shadcn/ui + Tailwind CSS. At runtime, Claude Haiku picks the right template/theme and extracts content from the user's chat message. The result is rendered server-side and displayed in an iframe — no external API dependencies.

## Goals

- **Zero external generation API** — no v0 SDK, no third-party code generation
- **Minimal runtime AI cost** — ~200-400 tokens per request via Claude Haiku (~$0.001)
- **Pre-built quality** — polished templates using shadcn/ui, not AI-generated code
- **Public URLs** — every project gets a shareable link at `/site/[projectId]`
- **Iterative editing** — follow-up messages patch existing content, not regenerate

## Site Types (MVP)

- **Landing pages** — SaaS/product marketing: hero, features, pricing, CTA, footer
- **Portfolio sites** — Creative showcase: intro, gallery grid, about, contact

## Architecture

### Runtime Flow

```
1. User sends chat message
   "Build me a photography portfolio with a dark elegant feel"

2. POST /api/builder/generate { message, project_id }
   → Claude Haiku (structured output) returns JSON:
   {
     template: "portfolio-minimal",
     theme: "ocean",
     content: {
       siteName: "Alex Rivera Photography",
       tagline: "Capturing light and shadow",
       heroTitle: "Visual Storytelling",
       ...
     }
   }

3. Server stores template_config JSON in Supabase (projects table)

4. Server renders React template with injected content → static HTML

5. Preview iframe loads /api/builder/preview/[projectId]
   Public URL: /site/[projectId]
```

### Follow-up Messages (Iterative Editing)

```
User: "Change theme to violet and update tagline to 'Moments in time'"

→ Haiku receives: current template_config JSON + new message
→ Returns: patch object with only changed fields
→ Server merges patch into stored config
→ Re-renders preview
```

State is stored in Supabase per project. Each message is an incremental update.

## Templates

### 4 Template Layouts

| Template | ID | Sections |
|---|---|---|
| Landing Light | `landing-light` | Navbar, Hero, Features grid, Pricing cards, CTA banner, Footer |
| Landing Dark | `landing-dark` | Navbar, Hero, Features grid, Pricing cards, CTA banner, Footer |
| Portfolio Minimal | `portfolio-minimal` | Navbar, Hero/Intro, Gallery grid, About, Contact, Footer |
| Portfolio Bold | `portfolio-bold` | Navbar, Editorial hero, Asymmetric gallery, About, Contact, Footer |

### 5 Color Themes

Each theme is a set of CSS custom properties applied at the root level.

| Theme | ID | Background | Text | Accent | Surface |
|---|---|---|---|---|---|
| Ocean | `ocean` | #0f172a (dark slate) | #f8fafc | #3b82f6 (blue) | rgba(255,255,255,0.05) |
| Sunset | `sunset` | #fefce8 (warm cream) | #1c1917 | #f97316 (orange) | rgba(249,115,22,0.05) |
| Violet | `violet` | #0c0a1a (deep purple) | #f5f3ff | #8b5cf6 (violet) | rgba(139,92,246,0.05) |
| Forest | `forest` | #f0fdf4 (light mint) | #14532d | #16a34a (green) | rgba(22,163,74,0.05) |
| Mono | `mono` | #fafafa (white) | #09090b | #18181b (black) | #f4f4f5 |

**Result:** 4 templates x 5 themes = 20 unique site variations.

### Theme Implementation

```typescript
// src/templates/themes.ts
export const themes = {
  ocean: { bg: '#0f172a', text: '#f8fafc', accent: '#3b82f6', ... },
  sunset: { bg: '#fefce8', text: '#1c1917', accent: '#f97316', ... },
  // ...
}
```

Applied as CSS variables on the root element of the rendered page. All section components reference these variables — swapping theme = swapping 6 CSS values.

## Section Components

Built with shadcn/ui + Tailwind. Each component accepts typed props for content injection.

| Component | Props | Used In |
|---|---|---|
| `Navbar` | siteName, links[] | All templates |
| `HeroCenter` | title, subtitle, ctaText, ctaUrl | Landing Light/Dark |
| `HeroSplit` | title, subtitle, description | Portfolio Minimal |
| `HeroBold` | title, subtitle | Portfolio Bold |
| `FeaturesGrid` | features[]{icon, title, description} | Landing templates |
| `GalleryGrid` | items[]{title, category, imageUrl?} | Portfolio templates |
| `GalleryAsymmetric` | items[]{title, category, imageUrl?} | Portfolio Bold |
| `Testimonials` | testimonials[]{quote, name, role} | Landing templates |
| `PricingCards` | plans[]{name, price, features[], highlighted?} | Landing templates |
| `CTABanner` | title, subtitle, ctaText | Landing templates |
| `ContactSection` | email, phone?, address? | Portfolio templates |
| `Footer` | siteName, links[], copyright | All templates |

## AI Service (Claude Haiku)

### Template Picker + Content Extractor

**Model:** Claude Haiku (claude-haiku-4-5-20251001)
**Input tokens:** ~200 (system prompt + user message)
**Output tokens:** ~200-400 (structured JSON)
**Cost:** ~$0.001 per request

**System prompt** defines:
- Available templates and their purposes
- Available themes and their aesthetics
- Content schema (TypeScript interface)
- Instructions to return valid JSON only

**For follow-up messages**, the system prompt includes the current `template_config` and instructs Haiku to return only changed fields as a patch.

### Content Schema

```typescript
interface TemplateContent {
  siteName: string
  tagline: string
  heroTitle: string
  heroSubtitle: string
  ctaText?: string
  ctaUrl?: string
  features?: Array<{ icon: string; title: string; description: string }>
  galleryItems?: Array<{ title: string; category: string }>
  testimonials?: Array<{ quote: string; name: string; role: string }>
  pricing?: Array<{ plan: string; price: string; features: string[]; highlighted?: boolean }>
  contactEmail?: string
  contactPhone?: string
  footerLinks?: Array<{ label: string; href: string }>
}

interface TemplateConfig {
  template: 'landing-light' | 'landing-dark' | 'portfolio-minimal' | 'portfolio-bold'
  theme: 'ocean' | 'sunset' | 'violet' | 'forest' | 'mono'
  content: TemplateContent
}
```

## API Routes

### New Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/builder/generate` | POST | User message → Haiku → template config → store + render |
| `/api/builder/preview/[projectId]` | GET | Render stored template config to full HTML page |
| `/site/[projectId]` | GET | Public URL — same render as preview but with clean URL |

### Removed Routes

| Route | Reason |
|---|---|
| `/api/v0/chat` | Replaced by `/api/builder/generate` |
| `/api/v0/message` | Replaced by `/api/builder/generate` (handles both new + follow-up) |
| `/api/v0/deploy` | No longer needed — sites are self-hosted |

### Generate Endpoint

```
POST /api/builder/generate
Body: { message: string, project_id: string }

1. Load current template_config from Supabase (null for new projects)
2. Call Claude Haiku with system prompt + current config + user message
3. Parse JSON response, merge with existing config (or use as-is for new)
4. Store updated template_config in Supabase projects table
5. Store user + assistant messages in Supabase messages table
6. Return { config: TemplateConfig, previewUrl: string }
```

### Preview Endpoint

```
GET /api/builder/preview/[projectId]

1. Load template_config from Supabase
2. Import the matching template component
3. Render to full HTML string (React renderToString + theme CSS)
4. Return HTML with Content-Type: text/html
```

### Public Site Route

```
GET /site/[projectId]

Same as preview but served as a Next.js page route.
Clean URL for sharing: pravik-builder.vercel.app/site/abc123
```

## Database Changes

### Projects Table — Add Column

```sql
ALTER TABLE projects ADD COLUMN template_config JSONB;
```

Stores the full `TemplateConfig` object. The `preview_url` column becomes `/site/[projectId]` (self-hosted) instead of a v0 demo URL. The `v0_chat_id` and `v0_project_id` columns become unused (can be dropped later).

## File Structure

### New Files

```
src/templates/
  types.ts                    # TemplateConfig, TemplateContent interfaces
  themes.ts                   # 5 color theme definitions
  render.ts                   # renderTemplate(config) → HTML string
  landing-light.tsx           # Landing page light template component
  landing-dark.tsx            # Landing page dark template component
  portfolio-minimal.tsx       # Portfolio minimal template component
  portfolio-bold.tsx          # Portfolio bold template component
  sections/
    navbar.tsx
    hero-center.tsx
    hero-split.tsx
    hero-bold.tsx
    features-grid.tsx
    gallery-grid.tsx
    gallery-asymmetric.tsx
    testimonials.tsx
    pricing-cards.tsx
    cta-banner.tsx
    contact-section.tsx
    footer.tsx

src/services/ai/
  template-picker.ts          # Claude Haiku integration
  prompts.ts                  # System prompts for template selection + content extraction

src/app/api/builder/
  generate/route.ts           # POST: message → AI → config → store
  preview/[projectId]/route.ts # GET: render template to HTML

src/app/site/[projectId]/
  page.tsx                    # Public shareable page
```

### Modified Files

```
src/app/build/[projectId]/page.tsx  # Use /api/builder/generate instead of /api/v0/*
src/features/builder/preview-panel.tsx  # Point to /api/builder/preview/[id]
src/lib/types.ts                    # Add TemplateConfig types
package.json                        # Add @anthropic-ai/sdk, remove v0-sdk
```

### Removed Files

```
src/services/v0/platform.ts         # v0 SDK wrapper
src/services/v0/model.ts            # v0 model API
src/app/api/v0/chat/route.ts        # v0 chat creation
src/app/api/v0/message/route.ts     # v0 message sending
src/app/api/v0/deploy/route.ts      # v0 deployment
```

## Dependencies

### Add
- `@anthropic-ai/sdk` — Claude Haiku API calls

### Remove
- `v0-sdk` — no longer needed

## Environment Variables

### Add
- `ANTHROPIC_API_KEY` — for Claude Haiku

### Keep
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — database
- `OPENAI_API_KEY` — Whisper (voice transcription still uses OpenAI)
- `TWILIO_*` — phone webhooks unchanged

### Remove (optional)
- `V0_API_KEY` — no longer needed

## Testing Strategy

1. **Template rendering** — each template renders valid HTML with sample content
2. **Theme application** — CSS variables correctly applied for each theme
3. **AI integration** — Haiku returns valid TemplateConfig JSON
4. **Iterative updates** — follow-up messages correctly patch existing config
5. **Public URLs** — `/site/[id]` serves rendered HTML
6. **Builder page** — chat → generate → preview cycle works end-to-end
