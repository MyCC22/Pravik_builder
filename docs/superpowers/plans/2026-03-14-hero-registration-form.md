# Hero Registration Form Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an overlapping short-form registration card to hero sections, AI-decided per business, that captures 2-4 fields and submits to the existing tools/tool_submissions pipeline.

**Architecture:** A shared `renderHeroForm()` utility generates the form card HTML + inline JS. Each hero variant accepts it as an optional last parameter and positions it with overlap. The AI generator decides per-business whether to include it, guided by per-category field hints. Storage reuses the existing `tools` table with `tool_type = 'hero_registration'`.

**Tech Stack:** TypeScript, Tailwind CSS (via CDN in rendered HTML), vanilla JavaScript (inline), Supabase (existing tables), Anthropic Claude API (existing generator)

**Spec:** `docs/superpowers/specs/2026-03-14-hero-registration-form-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/templates/sections/hero-form.tsx` | `renderHeroForm()` — generates form card HTML + inline JS for submission, validation, success state |

### Modified Files
| File | Change |
|------|--------|
| `src/services/agents/types.ts` | Add `HeroFormConfig` interface |
| `src/templates/types.ts` | Add hero form fields to `TemplateContent` + `TemplateConfig` |
| `src/templates/theme-classes.ts` | Add 5 form-specific theme properties to `ThemeClasses` interface + all 4 theme definitions |
| `src/templates/sections/hero-center.tsx` | Add optional `heroFormHtml` param, hide CTA when present, position form with overlap |
| `src/templates/sections/hero-bold.tsx` | Same as hero-center |
| `src/templates/sections/hero-split.tsx` | Add optional `heroFormHtml` param, replace right column content when present |
| `src/services/agents/generator.ts` | Add `validateHeroFormConfig()`, `createHeroRegistrationTool()`, wire into `generateSite()` pipeline |
| `src/services/agents/prompts/generator.ts` | Add hero form instructions + category hints to AI prompt |
| `src/templates/landing.tsx` | Wire `heroFormHtml` through to hero renderer |
| `src/templates/landing-bold.tsx` | Wire `heroFormHtml` through to hero renderer |
| `src/templates/services.tsx` | Wire `heroFormHtml` through to hero renderer |
| `src/templates/services-bold.tsx` | Wire `heroFormHtml` through to hero renderer |
| `src/templates/restaurant.tsx` | Wire `heroFormHtml` through to hero renderer |
| `src/templates/restaurant-dark.tsx` | Wire `heroFormHtml` through to hero renderer |
| `src/templates/agency.tsx` | Wire `heroFormHtml` through to hero renderer |
| `src/templates/agency-editorial.tsx` | Wire `heroFormHtml` through to hero renderer |
| `src/templates/event.tsx` | Wire `heroFormHtml` through to hero renderer |
| `src/templates/event-dark.tsx` | Wire `heroFormHtml` through to hero renderer |

---

## Chunk 1: Types, Theme, and Hero Form Utility

### Task 1: Add HeroFormConfig type

**Files:**
- Modify: `src/services/agents/types.ts:48-57`

- [ ] **Step 1: Add HeroFormConfig interface after ToolConfig**

In `src/services/agents/types.ts`, add after line 57 (after the closing `}` of `ToolConfig`):

```typescript
export interface HeroFormConfig {
  formTitle: string
  submitText: string
  successMessage: string
  fields: ToolField[]
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -E "types\.ts" || echo "No errors in types.ts"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/services/agents/types.ts
git commit -m "feat: add HeroFormConfig type for hero registration forms"
```

---

### Task 2: Add hero form fields to TemplateContent and TemplateConfig

**Files:**
- Modify: `src/templates/types.ts:125-188`

- [ ] **Step 1: Add hero form fields to TemplateContent**

In `src/templates/types.ts`, add before the closing `}` of `TemplateContent` (after line 180, after `bookingSubheading`):

```typescript
  // Hero registration form (optional — AI decides)
  includeHeroForm?: boolean
  heroFormTitle?: string
  heroFormSubmitText?: string
  heroFormSuccessMessage?: string
```

- [ ] **Step 2: Add heroToolId and heroFormFields to TemplateConfig**

In `src/templates/types.ts`, update the `TemplateConfig` interface (currently lines 183-187) to:

```typescript
export interface TemplateConfig {
  template: TemplateId
  theme: ThemeId
  content: TemplateContent
  // Set by generator after creating hero_registration tool — not AI-generated
  heroToolId?: string
  heroFormFields?: import('../services/agents/types').ToolField[]
}
```

Note: Use the import type inline to avoid a circular dependency. Alternatively, if inline import is problematic, add `import type { ToolField } from '../services/agents/types'` at the top of the file.

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -E "types\.ts" || echo "No errors in types.ts"`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/templates/types.ts
git commit -m "feat: add hero form fields to TemplateContent and TemplateConfig"
```

---

### Task 3: Add form theme properties to ThemeClasses

**Files:**
- Modify: `src/templates/theme-classes.ts:3-144`

- [ ] **Step 1: Add 5 new properties to ThemeClasses interface**

In `src/templates/theme-classes.ts`, add before the closing `}` of `ThemeClasses` (after line 36, after `footerTextMuted`):

```typescript
  /** Form card background */
  formCardBg: string
  /** Form input background */
  formInputBg: string
  /** Form input border color */
  formInputBorder: string
  /** Form input text color */
  formInputText: string
  /** Form label/title text color */
  formLabelText: string
```

- [ ] **Step 2: Add form properties to the `clean` theme**

In the `clean` theme object (after line 63, after `footerTextMuted`), add:

```typescript
    formCardBg: 'bg-white',
    formInputBg: 'bg-gray-50',
    formInputBorder: 'border-gray-200',
    formInputText: 'text-gray-900',
    formLabelText: 'text-gray-800',
```

- [ ] **Step 3: Add form properties to the `bold` theme**

In the `bold` theme object (after line 88, after `footerTextMuted`), add:

```typescript
    formCardBg: 'bg-zinc-900',
    formInputBg: 'bg-zinc-800',
    formInputBorder: 'border-zinc-700',
    formInputText: 'text-white',
    formLabelText: 'text-zinc-100',
```

- [ ] **Step 4: Add form properties to the `vibrant` theme**

In the `vibrant` theme object (after line 113, after `footerTextMuted`), add:

```typescript
    formCardBg: 'bg-white',
    formInputBg: 'bg-gray-50',
    formInputBorder: 'border-gray-200',
    formInputText: 'text-gray-900',
    formLabelText: 'text-gray-800',
```

- [ ] **Step 5: Add form properties to the `warm` theme**

In the `warm` theme object (after line 138, after `footerTextMuted`), add:

```typescript
    formCardBg: 'bg-white',
    formInputBg: 'bg-stone-50',
    formInputBorder: 'border-stone-200',
    formInputText: 'text-stone-900',
    formLabelText: 'text-stone-800',
```

- [ ] **Step 6: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -E "theme-classes\.ts" || echo "No errors"`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/templates/theme-classes.ts
git commit -m "feat: add form-specific theme properties to all 4 themes"
```

---

### Task 4: Create renderHeroForm() utility

**Files:**
- Create: `src/templates/sections/hero-form.tsx`

- [ ] **Step 1: Create the hero-form.tsx file**

Create `src/templates/sections/hero-form.tsx` with the following content:

```typescript
import type { ThemeClasses } from '../theme-classes'
import type { ToolField } from '@/services/agents/types'
import { escapeHtml } from '../utils'

const ALLOWED_FIELD_TYPES = ['text', 'email', 'phone', 'dropdown'] as const

/**
 * Renders an overlapping registration form card for the hero section.
 * Returns raw HTML string + inline <script> for submission handling.
 * Returns empty string if toolId is falsy (hero renders without form).
 */
export function renderHeroForm(
  toolId: string,
  fields: ToolField[],
  t: ThemeClasses,
  submitText = 'Get Started',
  successMessage = 'Thanks! We will be in touch soon.',
  formTitle?: string
): string {
  if (!toolId) return ''

  // Guardrails: filter to allowed types, cap at 4 fields
  let safeFields = fields
    .filter(f => (ALLOWED_FIELD_TYPES as readonly string[]).includes(f.type))
    .slice(0, 4)

  // Ensure name + email exist
  const hasName = safeFields.some(f => f.type === 'text' && f.name === 'name')
  const hasEmail = safeFields.some(f => f.type === 'email')
  if (!hasEmail) {
    safeFields.unshift({ name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'Your email' })
  }
  if (!hasName) {
    safeFields.unshift({ name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Your name' })
  }
  safeFields = safeFields.slice(0, 4)

  const titleHtml = formTitle
    ? `<h3 class="text-lg font-bold ${t.formLabelText} mb-4 text-center">${escapeHtml(formTitle)}</h3>`
    : ''

  const fieldsHtml = safeFields.map(f => renderField(f, t)).join('\n')

  const formId = `hero-form-${toolId.slice(0, 8)}`

  return `
<div class="relative z-10 max-w-xl mx-auto px-4 -mt-16">
  <div id="${formId}" class="${t.formCardBg} rounded-2xl ${t.cardShadow} p-6 sm:p-8 border ${t.formInputBorder}">
    ${titleHtml}
    <form id="${formId}-form" onsubmit="return false;" novalidate>
      <div class="space-y-4">
        ${fieldsHtml}
      </div>
      <button
        type="submit"
        id="${formId}-btn"
        class="${t.accentBg} ${t.accentBgHover} ${t.accentText} w-full mt-6 px-8 py-3.5 text-base font-semibold rounded-full shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
      >
        <span id="${formId}-btn-text">${escapeHtml(submitText)}</span>
        <span id="${formId}-spinner" class="hidden w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
      </button>
      <div id="${formId}-error" class="hidden mt-3 text-sm text-red-600 text-center"></div>
    </form>
    <div id="${formId}-success" class="hidden text-center py-6">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-4">
        <svg class="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      </div>
      <p class="text-lg font-semibold ${t.formLabelText}">${escapeHtml(successMessage)}</p>
    </div>
  </div>
</div>
${renderInlineScript(formId, toolId, safeFields)}
`
}

function renderField(field: ToolField, t: ThemeClasses): string {
  const id = `hf-${field.name}`
  const req = field.required ? ' required' : ''
  const ph = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : ''
  const label = `<label for="${id}" class="block text-sm font-medium ${t.formLabelText} mb-1">${escapeHtml(field.label)}${field.required ? ' *' : ''}</label>`
  const inputClasses = `w-full px-4 py-2.5 ${t.formInputBg} ${t.formInputText} border ${t.formInputBorder} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition`
  const errorDiv = `<div id="${id}-err" class="hidden text-xs text-red-600 mt-1"></div>`

  if (field.type === 'dropdown' && field.options?.length) {
    const opts = field.options.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('')
    return `<div>${label}<select id="${id}" name="${field.name}" class="${inputClasses}"${req}><option value="">Select...</option>${opts}</select>${errorDiv}</div>`
  }

  const typeMap: Record<string, string> = { text: 'text', email: 'email', phone: 'tel' }
  const inputType = typeMap[field.type] || 'text'

  return `<div>${label}<input id="${id}" name="${field.name}" type="${inputType}" class="${inputClasses}"${ph}${req}/>${errorDiv}</div>`
}

function renderInlineScript(formId: string, toolId: string, fields: ToolField[]): string {
  const fieldMeta = JSON.stringify(fields.map(f => ({
    name: f.name,
    type: f.type,
    required: f.required,
  })))

  return `<script>
(function(){
  var formEl=document.getElementById('${formId}-form');
  var btn=document.getElementById('${formId}-btn');
  var btnText=document.getElementById('${formId}-btn-text');
  var spinner=document.getElementById('${formId}-spinner');
  var errBox=document.getElementById('${formId}-error');
  var successBox=document.getElementById('${formId}-success');
  var fields=${fieldMeta};
  var submitting=false;

  function strip(s){return s.replace(/<[^>]*>/g,'').trim();}

  function validate(){
    var ok=true;
    fields.forEach(function(f){
      var el=document.getElementById('hf-'+f.name);
      var errEl=document.getElementById('hf-'+f.name+'-err');
      if(!el||!errEl)return;
      var v=strip(el.value);
      errEl.classList.add('hidden');errEl.textContent='';
      if(f.required&&!v){errEl.textContent='Required';errEl.classList.remove('hidden');ok=false;}
      else if(f.type==='email'&&v&&!/.+@.+\\..+/.test(v)){errEl.textContent='Invalid email';errEl.classList.remove('hidden');ok=false;}
      else if(f.type==='phone'&&v&&(v.replace(/\\D/g,'')).length<7){errEl.textContent='Invalid phone';errEl.classList.remove('hidden');ok=false;}
    });
    return ok;
  }

  btn.addEventListener('click',function(){
    if(submitting)return;
    errBox.classList.add('hidden');
    if(!validate())return;
    submitting=true;
    btnText.classList.add('hidden');spinner.classList.remove('hidden');
    btn.disabled=true;

    var data={};
    fields.forEach(function(f){
      var el=document.getElementById('hf-'+f.name);
      if(el)data[f.name]=strip(el.value);
    });

    fetch('/api/tools/submit',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({tool_id:'${toolId}',data:data})
    }).then(function(r){
      if(r.ok){
        formEl.style.transition='opacity 0.3s';formEl.style.opacity='0';
        setTimeout(function(){
          formEl.classList.add('hidden');
          successBox.classList.remove('hidden');
          successBox.style.opacity='0';
          setTimeout(function(){successBox.style.transition='opacity 0.3s';successBox.style.opacity='1';},10);
        },300);
      } else if(r.status===429){
        errBox.textContent='Please wait a moment before trying again.';errBox.classList.remove('hidden');
        submitting=false;btnText.classList.remove('hidden');spinner.classList.add('hidden');btn.disabled=false;
      } else {
        errBox.textContent='Something went wrong. Please try again.';errBox.classList.remove('hidden');
        submitting=false;btnText.classList.remove('hidden');spinner.classList.add('hidden');btn.disabled=false;
      }
    }).catch(function(){
      errBox.textContent='Something went wrong. Please try again.';errBox.classList.remove('hidden');
      submitting=false;btnText.classList.remove('hidden');spinner.classList.add('hidden');btn.disabled=false;
    });
  });
})();
</script>`
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -E "hero-form" || echo "No errors in hero-form.tsx"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/templates/sections/hero-form.tsx
git commit -m "feat: add renderHeroForm() utility for inline hero registration"
```

---

## Chunk 2: Hero Variant Integration

### Task 5: Add heroFormHtml parameter to hero-center.tsx

**Files:**
- Modify: `src/templates/sections/hero-center.tsx`

- [ ] **Step 1: Add heroFormHtml optional parameter**

The current signature (line ~4) is:
```typescript
export function renderHeroCenter(title: string, subtitle: string, t: ThemeClasses, ctaText?: string, ctaUrl = '#contact', heroImageUrl?: string, tagline?: string): string {
```

Change to:
```typescript
export function renderHeroCenter(title: string, subtitle: string, t: ThemeClasses, ctaText?: string, ctaUrl = '#contact', heroImageUrl?: string, tagline?: string, heroFormHtml?: string): string {
```

- [ ] **Step 2: Conditionally hide CTA button when form is present**

Change line 12 from:
```typescript
  const ctaHtml = ctaText
```
to:
```typescript
  const ctaHtml = ctaText && !heroFormHtml
```

- [ ] **Step 3: Append heroFormHtml in BOTH return paths**

**IMPORTANT:** hero-center has TWO return paths — one for image background (line 19-28) and one for gradient background (line 31-39). The form HTML must be added to BOTH.

For the **image variant** (line 19-28), change the closing from:
```typescript
    ${ctaHtml}
  </div>
</section>`
```
to:
```typescript
    ${ctaHtml}
  </div>
  ${heroFormHtml || ''}
</section>`
```

For the **gradient variant** (line 31-39), apply the same change:
```typescript
    ${ctaHtml}
  </div>
  ${heroFormHtml || ''}
</section>`
```

The form renders after the centered content `<div>` but still inside the `<section>`, so its negative top margin pulls it to overlap into the next section.

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -E "hero-center" || echo "No errors"`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/templates/sections/hero-center.tsx
git commit -m "feat: hero-center accepts optional heroFormHtml parameter"
```

---

### Task 6: Add heroFormHtml parameter to hero-bold.tsx

**Files:**
- Modify: `src/templates/sections/hero-bold.tsx`

- [ ] **Step 1: Add heroFormHtml optional parameter**

The current signature (line 4) is:
```typescript
export function renderHeroBold(title: string, subtitle: string, t: ThemeClasses, ctaText?: string, ctaUrl = '#contact', heroImageUrl?: string, tagline?: string): string {
```

Change to:
```typescript
export function renderHeroBold(title: string, subtitle: string, t: ThemeClasses, ctaText?: string, ctaUrl = '#contact', heroImageUrl?: string, tagline?: string, heroFormHtml?: string): string {
```

- [ ] **Step 2: Conditionally hide CTA when form is present**

Change line 12 from:
```typescript
  const ctaHtml = ctaText
```
to:
```typescript
  const ctaHtml = ctaText && !heroFormHtml
```

- [ ] **Step 3: Append heroFormHtml in BOTH return paths**

**IMPORTANT:** hero-bold has TWO return paths — one for image background (line 22-31) and one for gradient background (line 39-47). Add form HTML to BOTH.

For the **image variant** (line 22-31), change the closing from:
```typescript
    ${ctaHtml}
  </div>
</section>`
```
to:
```typescript
    ${ctaHtml}
  </div>
  ${heroFormHtml || ''}
</section>`
```

For the **gradient variant** (line 39-47), apply the same change:
```typescript
    ${ctaHtml}
  </div>
  ${heroFormHtml || ''}
</section>`
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -E "hero-bold" || echo "No errors"`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/templates/sections/hero-bold.tsx
git commit -m "feat: hero-bold accepts optional heroFormHtml parameter"
```

---

### Task 7: Add heroFormHtml parameter to hero-split.tsx

**Files:**
- Modify: `src/templates/sections/hero-split.tsx`

- [ ] **Step 1: Add heroFormHtml optional parameter**

The current signature (line 4) is:
```typescript
export function renderHeroSplit(title: string, subtitle: string, t: ThemeClasses, tagline?: string, ctaText?: string, ctaUrl = '#contact', heroImageUrl?: string): string {
```

**Note the different parameter order from the other two heroes!** `tagline` comes before `ctaText` here.

Change to:
```typescript
export function renderHeroSplit(title: string, subtitle: string, t: ThemeClasses, tagline?: string, ctaText?: string, ctaUrl = '#contact', heroImageUrl?: string, heroFormHtml?: string): string {
```

- [ ] **Step 2: Conditionally hide CTA when form is present**

Change line 8 from:
```typescript
  const ctaHtml = ctaText
```
to:
```typescript
  const ctaHtml = ctaText && !heroFormHtml
```

- [ ] **Step 3: Replace right-column content with form when present**

For hero-split, the form replaces the right-side image/content area. The right column is at lines 30-34:

```typescript
    <div class="relative">
      <div class="aspect-[4/3] rounded-3xl ${imageBgClass} ${t.border} overflow-hidden shadow-2xl">
        ${imageHtml}
      </div>
    </div>
```

Replace the right column block (lines 30-34) with a conditional:

```typescript
    ${heroFormHtml
      ? `<div class="flex items-center">${heroFormHtml}</div>`
      : `<div class="relative">
      <div class="aspect-[4/3] rounded-3xl ${imageBgClass} ${t.border} overflow-hidden shadow-2xl">
        ${imageHtml}
      </div>
    </div>`}
```

Note: hero-split has only ONE return path (line 22-36), unlike hero-center/hero-bold. The form sits naturally in the right column without needing overlap positioning.

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -E "hero-split" || echo "No errors"`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/templates/sections/hero-split.tsx
git commit -m "feat: hero-split accepts optional heroFormHtml parameter"
```

---

## Chunk 3: Generator Pipeline

### Task 8: Add validateHeroFormConfig and createHeroRegistrationTool to generator.ts

**Files:**
- Modify: `src/services/agents/generator.ts:1-395`

- [ ] **Step 1: Add HeroFormConfig and ToolField to existing import**

At the top of `src/services/agents/generator.ts`, line 8 currently reads:
```typescript
import type { Block } from './types'
```

Change to:
```typescript
import type { Block, HeroFormConfig, ToolField } from './types'
```

- [ ] **Step 2: Add validateHeroFormConfig function**

Add after `validateRequiredFields()` (after line 358):

```typescript
/**
 * Validate and sanitize hero form config from AI output.
 * Ensures field count, types, and required name/email presence.
 */
function validateHeroFormConfig(config: Partial<HeroFormConfig>): HeroFormConfig {
  // Filter to allowed types, enforce snake_case names, cap at 4
  let fields = (config.fields || [])
    .filter((f: ToolField) => ['text', 'email', 'phone', 'dropdown'].includes(f.type))
    .map((f: ToolField) => ({
      ...f,
      name: f.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    }))
    .slice(0, 4)

  // Ensure name and email fields exist
  const hasName = fields.some((f: ToolField) => f.type === 'text' && f.name === 'name')
  const hasEmail = fields.some((f: ToolField) => f.type === 'email')

  if (!hasEmail) {
    fields.unshift({ name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'Your email' })
  }
  if (!hasName) {
    fields.unshift({ name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Your name' })
  }

  // Re-cap after potential injection
  fields = fields.slice(0, 4)

  return {
    formTitle: config.formTitle || 'Get Started',
    submitText: config.submitText || 'Submit',
    successMessage: config.successMessage || 'Thanks! We will be in touch soon.',
    fields,
  }
}
```

- [ ] **Step 3: Add createHeroRegistrationTool function**

Add after `validateHeroFormConfig()`:

```typescript
/**
 * Creates a hero_registration tool in the database.
 * Returns the tool ID and validated fields for template rendering.
 */
async function createHeroRegistrationTool(
  projectId: string,
  config: HeroFormConfig
): Promise<{ toolId: string; fields: ToolField[] }> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('tools')
    .insert({
      project_id: projectId,
      tool_type: 'hero_registration',
      config: {
        title: config.formTitle,
        submitText: config.submitText,
        successMessage: config.successMessage,
        fields: config.fields,
      },
      is_active: true,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('Failed to create hero_registration tool:', error?.message)
    throw new Error(`Failed to create hero registration tool: ${error?.message}`)
  }

  return { toolId: data.id, fields: config.fields }
}
```

- [ ] **Step 4: Wire into generateSite() pipeline**

In the `generateSite()` function (starts at line 360), after `config = validateSections(config, message)` (line 392) and before `return renderAndStoreBlocks(config, projectId)` (line 394), add:

```typescript
  // Create hero registration tool if AI decided to include one
  if (parsed.content?.includeHeroForm && (parsed as Record<string, unknown>).heroFormConfig) {
    try {
      const rawHeroConfig = (parsed as Record<string, unknown>).heroFormConfig as Partial<HeroFormConfig>
      const validatedHeroConfig = validateHeroFormConfig(rawHeroConfig)
      const { toolId, fields: heroFields } = await createHeroRegistrationTool(projectId, validatedHeroConfig)

      config = {
        ...config,
        heroToolId: toolId,
        heroFormFields: heroFields,
      }

      // Pass display strings from AI to content
      config.content = {
        ...config.content,
        includeHeroForm: true,
        heroFormTitle: validatedHeroConfig.formTitle,
        heroFormSubmitText: validatedHeroConfig.submitText,
        heroFormSuccessMessage: validatedHeroConfig.successMessage,
      }
    } catch (err) {
      console.error('Hero registration tool creation failed, skipping:', err)
      // Non-fatal — site generates without inline form
    }
  }
```

- [ ] **Step 5: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -E "generator\.ts" || echo "No errors"`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/services/agents/generator.ts
git commit -m "feat: add hero form validation, tool creation, and pipeline wiring"
```

---

### Task 9: Add hero form instructions and category hints to AI prompt

**Files:**
- Modify: `src/services/agents/prompts/generator.ts:35-108`

- [ ] **Step 1: Add hero form instructions and category hints to CONTENT_SCHEMA**

In `src/services/agents/prompts/generator.ts`, add to the end of the `CONTENT_SCHEMA` string (before the closing backtick at line 108):

```

Hero Registration Form (optional — AI decides):
Decide whether this business would benefit from an inline lead-capture form in the hero section.
- Most service businesses, agencies, consultancies, and appointment-based businesses SHOULD have one.
- Restaurants with menus, event pages with ticketing links, or pure portfolio/ecommerce sites may NOT need one.

Set "includeHeroForm": true/false in the content object.
If true, also provide a top-level "heroFormConfig" object (NOT inside content) with:
- "formTitle": short action-oriented heading (e.g., "Get Your Free Quote")
- "submitText": button label (e.g., "Get Started", "Book Now")
- "successMessage": thank-you text shown inline after submission
- "fields": array of 2-4 fields, each with: name, label, type, required, placeholder, options (for dropdowns)

Hero form field rules:
- Use a single "name" field (never split into first/last name)
- Allowed field types: text, email, phone, dropdown ONLY
- Every form MUST have at least: name (text, required) + email (email, required)
- Maximum 4 fields total
- When generating for an unlisted or unknown business category, default to: name, email, phone

Category hints for hero form fields:
- consulting/agency → Name, Email, Company
- salon/spa/beauty → Name, Phone, Service (dropdown)
- restaurant → NO hero form (use booking CTA instead)
- fitness/gym → Name, Email, Phone
- medical/dental/healthcare → Name, Phone, Preferred Time (dropdown)
- legal/finance → Name, Email, Brief Description (text)
- education/tutoring → Name, Email, Subject (dropdown)
- real_estate → Name, Email, Phone
- event → NO hero form (use ticket links instead)
- ecommerce → NO hero form (use product CTAs instead)
- photography/portfolio → Name, Email
- unknown/other → Name, Email, Phone (safe fallback)

When encountering a new business category, ALWAYS define hero form fields for it. Follow the pattern above.
```

- [ ] **Step 2: Update the return format in getGeneratorPrompt**

In `getGeneratorPrompt()`, update the return format section (around line 163-168) to include `heroFormConfig`:

Change:
```
Return format:
{
  "template": "template-id",
  "theme": "theme-id",
  "content": { ...all content fields }
}
```

To:
```
Return format:
{
  "template": "template-id",
  "theme": "theme-id",
  "content": { ...all content fields, "includeHeroForm": true/false },
  "heroFormConfig": { "formTitle": "...", "submitText": "...", "successMessage": "...", "fields": [...] }
}
Note: "heroFormConfig" is ONLY included when "includeHeroForm" is true. It sits at the top level alongside "template" and "theme", NOT inside "content".
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -E "prompts/generator" || echo "No errors"`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/services/agents/prompts/generator.ts
git commit -m "feat: add hero form instructions and category hints to AI prompt"
```

---

## Chunk 4: Template Composition Wiring

### Task 10: Wire heroFormHtml in all 10 template composition files

**Files:**
- Modify: All 10 template composition files in `src/templates/`

Each template file follows the same pattern. Add the `renderHeroForm` import, build the `heroFormHtml` string from config, and pass it to the hero renderer.

**Hero renderer mapping (which hero each template uses):**

| Template | Hero Renderer | Hero Call Pattern |
|----------|--------------|-------------------|
| `landing.tsx` | `renderHeroCenter` | `(title, subtitle, t, ctaText, ctaUrl, heroImageUrl, tagline)` |
| `landing-bold.tsx` | `renderHeroBold` | `(title, subtitle, t, ctaText, ctaUrl, heroImageUrl, tagline)` |
| `services.tsx` | `renderHeroCenter` | `(title, subtitle, t, ctaText, ctaUrl, heroImageUrl, tagline)` |
| `services-bold.tsx` | `renderHeroBold` | `(title, subtitle, t, ctaText, ctaUrl, heroImageUrl, tagline)` |
| `restaurant.tsx` | `renderHeroSplit` | `(title, subtitle, t, tagline, ctaText, ctaUrl, heroImageUrl)` |
| `restaurant-dark.tsx` | `renderHeroBold` | `(title, subtitle, t, ctaText, ctaUrl, heroImageUrl, tagline)` |
| `agency.tsx` | `renderHeroSplit` | `(title, subtitle, t, tagline, ctaText, ctaUrl, heroImageUrl)` |
| `agency-editorial.tsx` | `renderHeroBold` | `(title, subtitle, t, ctaText, ctaUrl, heroImageUrl, tagline)` |
| `event.tsx` | `renderHeroCenter` | `(title, subtitle, t, ctaText, ctaUrl, heroImageUrl, tagline)` |
| `event-dark.tsx` | `renderHeroBold` | `(title, subtitle, t, ctaText, ctaUrl, heroImageUrl, tagline)` |

- [ ] **Step 1: Wire landing.tsx**

Add import at top:
```typescript
import { renderHeroForm } from './sections/hero-form'
```

Inside `renderLanding()`, after `const t = ...` and before the `sections` array, add:
```typescript
  const heroFormHtml = config.heroToolId && config.heroFormFields
    ? renderHeroForm(config.heroToolId, config.heroFormFields, t,
        content.heroFormSubmitText, content.heroFormSuccessMessage, content.heroFormTitle)
    : undefined
```

Change the hero call from:
```typescript
    renderHeroCenter(content.heroTitle, content.heroSubtitle, t, content.ctaText, content.ctaUrl, content.heroImageUrl, content.tagline),
```
To:
```typescript
    renderHeroCenter(content.heroTitle, content.heroSubtitle, t, content.ctaText, content.ctaUrl, content.heroImageUrl, content.tagline, heroFormHtml),
```

- [ ] **Step 2: Wire landing-bold.tsx**

Same pattern as Step 1 but uses `renderHeroBold`:

Add import, build `heroFormHtml`, append to `renderHeroBold(...)` call.

- [ ] **Step 3: Wire services.tsx**

Same pattern, uses `renderHeroCenter`.

- [ ] **Step 4: Wire services-bold.tsx**

Same pattern, uses `renderHeroBold`.

- [ ] **Step 5: Wire restaurant.tsx**

Same pattern but uses `renderHeroSplit` with different parameter order:
```typescript
    renderHeroSplit(content.heroTitle, content.heroSubtitle, t, content.tagline, content.ctaText, content.ctaUrl, content.heroImageUrl, heroFormHtml),
```

- [ ] **Step 6: Wire restaurant-dark.tsx**

Uses `renderHeroBold`, same pattern as Step 1.

- [ ] **Step 7: Wire agency.tsx**

Uses `renderHeroSplit`, same parameter order as restaurant.tsx.

- [ ] **Step 8: Wire agency-editorial.tsx**

Uses `renderHeroBold`, same pattern as Step 1.

- [ ] **Step 9: Wire event.tsx**

Uses `renderHeroCenter`, same pattern as Step 1.

- [ ] **Step 10: Wire event-dark.tsx**

Uses `renderHeroBold`, same pattern as Step 1.

- [ ] **Step 11: Verify no TypeScript errors across all template files**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -E "src/templates/(landing|services|restaurant|agency|event)" || echo "No errors"`
Expected: No errors

- [ ] **Step 12: Commit all 10 template files**

```bash
git add src/templates/landing.tsx src/templates/landing-bold.tsx \
  src/templates/services.tsx src/templates/services-bold.tsx \
  src/templates/restaurant.tsx src/templates/restaurant-dark.tsx \
  src/templates/agency.tsx src/templates/agency-editorial.tsx \
  src/templates/event.tsx src/templates/event-dark.tsx
git commit -m "feat: wire heroFormHtml through all 10 template composition files"
```

---

## Chunk 5: Build Verification and Final Commit

### Task 11: Full build verification

- [ ] **Step 1: Run TypeScript type check**

Run: `npx tsc --noEmit --pretty`
Expected: Only pre-existing test file errors (in `tests/`), no errors in `src/`

- [ ] **Step 2: Run Next.js build**

Run: `npm run build`
Expected: Build completes successfully, all pages generated

- [ ] **Step 3: Verify the generated site renders (manual smoke test)**

Start the dev server and generate a test site to verify:
1. The hero form renders correctly in the preview
2. The form card overlaps into the next section
3. Form submission works (hits `/api/tools/submit`)
4. Success state shows correctly

- [ ] **Step 4: Push to main and deploy**

```bash
git push origin main
vercel deploy --prod
```
