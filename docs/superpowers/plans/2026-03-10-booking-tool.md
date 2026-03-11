# Booking / Lead Capture Tool — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a modular booking/lead capture form tool that attaches to any generated website, with AI-generated fields, chat/voice editing, themed split-layout form page, and Supabase-backed submissions.

**Architecture:** JSON-driven form config stored in a `tools` table. AI generates the initial field schema from the business description. A standalone `/book/[projectId]` page renders the form deterministically from JSON. The existing multi-agent orchestrator is extended with `edit_tool` and `add_tool` intents for field modifications.

**Tech Stack:** Next.js (App Router), Supabase (PostgreSQL + RLS), Tailwind CSS (CDN), Claude Haiku (tool agents), TypeScript

**Spec:** `docs/superpowers/specs/2026-03-10-booking-tool-design.md`

---

## Chunk 1: Database + Types Foundation

### Task 1: Apply database migration

**Files:**
- Database: Supabase project `saqlwyfdlxjjzatsccgd`

- [ ] **Step 1: Create the `tools` and `tool_submissions` tables with RLS**

Apply this migration via the Supabase MCP tool `apply_migration`:

```sql
-- Create tools table
CREATE TABLE tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  tool_type TEXT NOT NULL DEFAULT 'booking',
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tools_project_id ON tools(project_id);

-- RLS for tools
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tools_select_public" ON tools
  FOR SELECT USING (true);

CREATE POLICY "tools_insert_owner" ON tools
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT user_id FROM projects WHERE id = project_id)
  );

CREATE POLICY "tools_update_owner" ON tools
  FOR UPDATE USING (
    auth.uid() = (SELECT user_id FROM projects WHERE id = project_id)
  );

CREATE POLICY "tools_delete_owner" ON tools
  FOR DELETE USING (
    auth.uid() = (SELECT user_id FROM projects WHERE id = project_id)
  );

-- Create tool_submissions table
CREATE TABLE tool_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID REFERENCES tools(id) ON DELETE CASCADE NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tool_submissions_tool_id ON tool_submissions(tool_id);

-- RLS for tool_submissions
ALTER TABLE tool_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "submissions_insert_public" ON tool_submissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "submissions_select_owner" ON tool_submissions
  FOR SELECT USING (
    auth.uid() = (
      SELECT p.user_id
      FROM projects p
      JOIN tools t ON t.project_id = p.id
      WHERE t.id = tool_id
    )
  );

CREATE POLICY "submissions_delete_owner" ON tool_submissions
  FOR DELETE USING (
    auth.uid() = (
      SELECT p.user_id
      FROM projects p
      JOIN tools t ON t.project_id = p.id
      WHERE t.id = tool_id
    )
  );
```

- [ ] **Step 2: Verify migration applied**

Run via Supabase MCP `execute_sql`:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('tools', 'tool_submissions');
```

Expected: Both tables returned.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: apply tools + tool_submissions migration"
```

Note: The migration is applied directly to Supabase. This commit just records any local file changes.

---

### Task 2: Add TypeScript types to agents/types.ts

**Files:**
- Modify: `src/services/agents/types.ts`

- [ ] **Step 1: Add tool-related types and extend AgentIntent and AgentResponse**

Open `src/services/agents/types.ts` and make these changes:

1. Add `'edit_tool'` and `'add_tool'` to the `AgentIntent` union (after `'change_theme'`):

```typescript
export type AgentIntent =
  | 'generate_site'
  | 'edit_block'
  | 'add_block'
  | 'remove_block'
  | 'reorder_blocks'
  | 'change_theme'
  | 'edit_tool'
  | 'add_tool'
  | 'clarify'
```

2. Add `'tool_created'` and `'tool_edited'` to the `AgentResponse.action` union:

```typescript
export interface AgentResponse {
  action: 'generated' | 'edited' | 'theme_changed' | 'removed' | 'reordered' | 'clarify' | 'tool_created' | 'tool_edited'
  message: string
  question?: string
}
```

3. Add the new tool types at the end of the file:

```typescript
export type ToolFieldType = 'text' | 'email' | 'phone' | 'textarea' | 'number' | 'dropdown'

export interface ToolField {
  name: string
  label: string
  type: ToolFieldType
  required: boolean
  placeholder?: string
  options?: string[]
}

export interface ToolConfig {
  title: string
  subtitle: string
  submitText: string
  successMessage: string
  trustSignals: string[]
  fields: ToolField[]
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npx next build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/agents/types.ts && git commit -m "feat(types): add ToolConfig, ToolField, and tool agent intents"
```

---

### Task 3: Add Tool and ToolSubmission to lib/types.ts

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add Tool and ToolSubmission interfaces**

Add these at the end of `src/lib/types.ts`, after the `CallSession` interface.

**Important:** Do NOT import from `@/services/agents/types` here — that would create a circular dependency (lib → services). Instead, use `Record<string, unknown>` for the config field since it comes from JSONB. The `ToolConfig` type in `agents/types.ts` is used for runtime typing within the agent layer.

```typescript
export interface Tool {
  id: string
  project_id: string
  tool_type: string
  config: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ToolSubmission {
  id: string
  tool_id: string
  data: Record<string, string>
  submitted_at: string
}
```

No new imports needed.

- [ ] **Step 2: Verify build**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npx next build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts && git commit -m "feat(types): add Tool and ToolSubmission interfaces"
```

---

## Chunk 2: AI Agents (ToolGenerator + ToolEditor)

### Task 4: Create ToolGenerator prompt

**Files:**
- Create: `src/services/agents/prompts/tool-generator.ts`

- [ ] **Step 1: Create the prompt file**

Create `src/services/agents/prompts/tool-generator.ts`:

```typescript
export function getToolGeneratorPrompt(templateType: string): string {
  return `You are a booking/lead capture form generator. Given a business description, generate a form configuration as a JSON object.

Template type being used: "${templateType}"

Return a JSON object with this exact shape:
{
  "title": "Short action-oriented title (e.g., 'Book a Free Trial', 'Get a Free Quote', 'Schedule a Consultation')",
  "subtitle": "One sentence explaining what happens after submission",
  "submitText": "Button text matching the title (e.g., 'Book My Free Trial', 'Get My Quote')",
  "successMessage": "Thank you message shown after submission (1-2 sentences)",
  "trustSignals": ["3 short trust-building phrases relevant to this business"],
  "fields": [
    {
      "name": "snake_case_field_name",
      "label": "Human-Readable Label",
      "type": "text|email|phone|textarea|number|dropdown",
      "required": true or false,
      "placeholder": "Hint text (optional)",
      "options": ["only", "for", "dropdown", "type"]
    }
  ]
}

Field type rules:
- "text": Short free text (names, titles)
- "email": Email address (always include one, always required)
- "phone": Phone number (usually optional)
- "textarea": Long free text (messages, descriptions)
- "number": Numeric input (quantities, ages as numbers)
- "dropdown": Selection from predefined options (must include "options" array)

Guidelines:
- Generate 4-7 fields appropriate for this specific business type
- Always include at minimum: a name field (text, required), an email field (email, required)
- Include a phone field (phone, optional) for most service businesses
- Use dropdowns for categorical choices (experience level, service type, group size, etc.)
- Field names should be snake_case and descriptive
- Labels should be concise and clear
- Trust signals should be specific to the business, not generic
- Title should match the business action (booking, quoting, scheduling, etc.)

Return ONLY valid JSON. No markdown fences. No explanation.`
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add src/services/agents/prompts/tool-generator.ts && git commit -m "feat: add ToolGenerator system prompt"
```

---

### Task 5: Create ToolGenerator agent

**Files:**
- Create: `src/services/agents/tool-generator.ts`

- [ ] **Step 1: Create the agent file**

Create `src/services/agents/tool-generator.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getToolGeneratorPrompt } from './prompts/tool-generator'
import type { ToolConfig } from './types'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

// Use service role key for server-side tool writes (RLS requires auth.uid() for
// owner-only INSERT, but server agents don't have a user session)
function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export function validateToolConfig(parsed: unknown): ToolConfig {
  const config = parsed as Record<string, unknown>

  // Ensure required top-level fields exist with sensible defaults
  const title = typeof config.title === 'string' ? config.title : 'Book Now'
  const subtitle = typeof config.subtitle === 'string' ? config.subtitle : 'Fill in your details below'
  const submitText = typeof config.submitText === 'string' ? config.submitText : 'Submit'
  const successMessage = typeof config.successMessage === 'string'
    ? config.successMessage
    : 'Thanks! We\'ll be in touch soon.'
  const trustSignals = Array.isArray(config.trustSignals)
    ? config.trustSignals.filter((s): s is string => typeof s === 'string')
    : []

  // Validate fields array
  const rawFields = Array.isArray(config.fields) ? config.fields : []
  const validTypes = ['text', 'email', 'phone', 'textarea', 'number', 'dropdown']
  const fields = rawFields
    .filter((f: unknown): f is Record<string, unknown> =>
      typeof f === 'object' && f !== null && typeof (f as Record<string, unknown>).name === 'string'
    )
    .map((f: Record<string, unknown>) => ({
      name: String(f.name),
      label: typeof f.label === 'string' ? f.label : String(f.name),
      type: validTypes.includes(String(f.type)) ? String(f.type) as ToolConfig['fields'][0]['type'] : 'text' as const,
      required: f.required === true,
      ...(typeof f.placeholder === 'string' ? { placeholder: f.placeholder } : {}),
      ...(Array.isArray(f.options) ? { options: f.options.filter((o): o is string => typeof o === 'string') } : {}),
    }))

  return { title, subtitle, submitText, successMessage, trustSignals, fields }
}

export async function generateBookingTool(
  businessDescription: string,
  projectId: string,
  templateType: string
): Promise<ToolConfig | null> {
  try {
    const systemPrompt = getToolGeneratorPrompt(templateType)

    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: businessDescription }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    const config = validateToolConfig(parsed)

    // Store in DB (service role key bypasses RLS for server-side inserts)
    const supabase = getServiceSupabase()
    const { error } = await supabase
      .from('tools')
      .insert({
        project_id: projectId,
        tool_type: 'booking',
        config,
      })

    if (error) {
      console.error('Failed to insert tool:', error.message)
      return null
    }

    return config
  } catch (err) {
    console.error('generateBookingTool failed:', err)
    return null
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add src/services/agents/tool-generator.ts && git commit -m "feat: add ToolGenerator agent with validation"
```

---

### Task 6: Create ToolEditor prompt

**Files:**
- Create: `src/services/agents/prompts/tool-editor.ts`

- [ ] **Step 1: Create the prompt file**

Create `src/services/agents/prompts/tool-editor.ts`:

```typescript
import type { ToolConfig } from '../types'

export function getToolEditorPrompt(currentConfig: ToolConfig): string {
  return `You are a booking form editor. You will receive the current form configuration and the user's requested changes. Return the updated configuration.

Current form config:
${JSON.stringify(currentConfig, null, 2)}

Rules:
1. Return ONLY the updated JSON — no explanation, no markdown fences
2. Preserve all existing fields and settings UNLESS the user explicitly asks to change them
3. When adding a field, generate an appropriate snake_case "name" and choose the right "type"
4. Valid field types: "text", "email", "phone", "textarea", "number", "dropdown"
5. For dropdown fields, always include an "options" array
6. When removing a field, remove it from the fields array entirely
7. When changing field order, move the field to the requested position
8. Keep the same JSON structure: { title, subtitle, submitText, successMessage, trustSignals, fields }
9. Make the requested changes as precisely as possible — don't redesign the whole form
10. If changing branding (title, subtitle, button text, trust signals), update only what's requested`
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add src/services/agents/prompts/tool-editor.ts && git commit -m "feat: add ToolEditor system prompt"
```

---

### Task 7: Create ToolEditor agent

**Files:**
- Create: `src/services/agents/tool-editor.ts`

- [ ] **Step 1: Create the agent file**

Create `src/services/agents/tool-editor.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { getToolEditorPrompt } from './prompts/tool-editor'
import { validateToolConfig } from './tool-generator'
import type { ToolConfig } from './types'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

export async function editToolConfig(
  currentConfig: ToolConfig,
  message: string
): Promise<ToolConfig> {
  const systemPrompt = getToolEditorPrompt(currentConfig)

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  const parsed = JSON.parse(cleaned)

  // Reuse the same validation as the generator for consistent config shape
  return validateToolConfig(parsed)
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add src/services/agents/tool-editor.ts && git commit -m "feat: add ToolEditor agent"
```

---

## Chunk 3: Router + Orchestrator Integration

### Task 8: Update router prompt with tool intents

**Files:**
- Modify: `src/services/agents/prompts/router.ts`

- [ ] **Step 1: Add tool intents to the router prompt**

In `src/services/agents/prompts/router.ts`, make these changes:

1. Add to the `hasBlocks` branch of `availableIntents` (after the `"generate_site"` line, before `"clarify"`):

```
- "edit_tool": User wants to modify the booking/lead capture form (fields, branding, button text)
- "add_tool": User wants to add a booking form or lead capture form to their site
```

2. Add these disambiguation rules to the end of the `Rules:` section (before the closing backtick):

```
- "form", "booking form", "fields", "dropdown", "add a field", "change the form", "make required", "update the form" → edit_tool (modifies the booking form, not an HTML block)
- "add a booking form", "add a contact form", "add lead capture" → add_tool (creates a new booking tool)
- "add a contact section", "add a features section" → add_block (adds an HTML section, NOT a tool)
- Key distinction: form-specific language (fields, dropdown, required, form fields) → tool intents. Section-specific language (section, block) → block intents.
```

The full updated file should look like this after changes:

```typescript
import type { Block } from '../types'

const BLOCK_TYPES = ['navbar', 'hero', 'features', 'gallery', 'pricing', 'cta', 'contact', 'footer', 'testimonials', 'custom']
const THEMES = ['clean', 'bold', 'vibrant', 'warm']

export function getRouterPrompt(blocks: Block[], currentTheme: string | null): string {
  const hasBlocks = blocks.length > 0
  const blockSummary = blocks.map(b => `${b.block_type}:${b.position}`).join(', ')

  const availableIntents = hasBlocks
    ? `
Available intents:
- "edit_block": User wants to change content, style, or layout of an existing block
- "add_block": User wants to add a new section to the site
- "remove_block": User wants to delete a section
- "reorder_blocks": User wants to move sections around
- "change_theme": User wants to change colors or theme
- "edit_tool": User wants to modify the booking/lead capture form (fields, branding, button text)
- "add_tool": User wants to add a booking form or lead capture form to their site
- "generate_site": User wants to completely rebuild the site from scratch
- "clarify": The request is too ambiguous to act on — ask a question`
    : `
Available intents:
- "generate_site": User describes what they want and we build it
- "clarify": The request is too vague to build a site — ask what kind of site they need`

  return `You are an intent classifier for a website builder. Analyze the user's message and determine what action to take.

Current site state:
- Has blocks: ${hasBlocks}
${hasBlocks ? `- Current blocks: [${blockSummary}]` : '- No blocks yet (empty site)'}
- Current theme: ${currentTheme || 'none'}

${availableIntents}

Block types: ${BLOCK_TYPES.join(', ')}
Themes: ${THEMES.join(', ')}

Return a JSON object:
{
  "intent": "intent_name",
  "target_blocks": ["block_type"],
  "description": "what you understood the user wants",
  "question": "only if intent is clarify, the question to ask",
  "position": number (only for add_block — where to insert, 0-indexed)
}

Rules:
- Return ONLY valid JSON, no markdown fences, no explanation
- For edit_block: target_blocks should contain the block type(s) to edit
- For add_block: target_blocks should contain the new block type, position should be where to insert it
- For remove_block: target_blocks should contain the block type(s) to remove
- For change_theme: target_blocks can be empty
- For generate_site: target_blocks can be empty
- For edit_tool and add_tool: target_blocks can be empty
- When the user mentions "top" or "header", that's usually the navbar
- When the user mentions "bottom" or "end", that's usually the footer
- "Colors", "darker", "lighter", "warmer" → change_theme
- "Add phone number" or "change text" on an existing section → edit_block
- "Add a testimonials section" → add_block
- "form", "booking form", "fields", "dropdown", "add a field", "change the form", "make required", "update the form" → edit_tool
- "add a booking form", "add a contact form", "add lead capture" → add_tool
- "add a contact section", "add a features section" → add_block (HTML section, NOT a tool)
- Key distinction: form-specific language (fields, dropdown, required, form fields) → tool intents. Section-specific language (section, block) → block intents.
- If unsure which block the user means, use clarify`
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add src/services/agents/prompts/router.ts && git commit -m "feat: add edit_tool and add_tool intents to router prompt"
```

---

### Task 9: Update orchestrator with tool cases

**Files:**
- Modify: `src/services/agents/orchestrator.ts`

- [ ] **Step 1: Add imports for tool agents and service role client**

At the top of `src/services/agents/orchestrator.ts`, add these imports after the existing ones:

```typescript
import { createClient } from '@supabase/supabase-js'
import { generateBookingTool } from './tool-generator'
import { editToolConfig } from './tool-editor'
import type { ToolConfig } from './types'
```

Also add a service role client function (needed because the anon client's RLS blocks tool writes without auth context):

```typescript
function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

- [ ] **Step 2: Add `edit_tool` case to the switch statement**

Add this case after the `change_theme` case (before `case 'clarify':`):

```typescript
    case 'edit_tool': {
      const svc = getServiceSupabase()

      // Load existing tool for this project
      const { data: tool } = await svc
        .from('tools')
        .select('*')
        .eq('project_id', projectId)
        .eq('tool_type', 'booking')
        .single()

      if (!tool) {
        return {
          action: 'clarify',
          message: "You don't have a booking form yet. Would you like me to create one?",
          question: "Would you like me to create a booking form?",
        }
      }

      const updatedConfig = await editToolConfig(tool.config as ToolConfig, message)

      await svc
        .from('tools')
        .update({ config: updatedConfig, updated_at: new Date().toISOString() })
        .eq('id', tool.id)

      return {
        action: 'tool_edited',
        message: `Done! I updated your booking form. View it at /book/${projectId}`,
      }
    }
```

- [ ] **Step 3: Add `add_tool` case to the switch statement**

Add this case right after the `edit_tool` case:

```typescript
    case 'add_tool': {
      const svc = getServiceSupabase()

      // Check if tool already exists
      const { data: existingTool } = await svc
        .from('tools')
        .select('id')
        .eq('project_id', projectId)
        .eq('tool_type', 'booking')
        .single()

      if (existingTool) {
        return {
          action: 'clarify',
          message: "You already have a booking form. Would you like to edit it instead?",
          question: "You already have a booking form. Would you like to edit it?",
        }
      }

      // Get project name for context
      const { data: proj } = await supabase
        .from('projects')
        .select('name, template_config')
        .eq('id', projectId)
        .single()

      const templateType = (proj?.template_config as Record<string, unknown>)?.template as string || 'landing'
      const businessContext = proj?.name || message

      const toolConfig = await generateBookingTool(businessContext, projectId, templateType)

      if (!toolConfig) {
        return {
          action: 'clarify',
          message: "I had trouble creating the booking form. Could you describe your business so I can try again?",
          question: "Could you describe your business?",
        }
      }

      // Update project template_config with bookingUrl
      if (proj?.template_config) {
        const config = proj.template_config as Record<string, unknown>
        const content = (config.content || {}) as Record<string, unknown>
        content.bookingUrl = `/book/${projectId}`
        content.bookingText = toolConfig.submitText
        config.content = content

        await supabase
          .from('projects')
          .update({ template_config: config, updated_at: new Date().toISOString() })
          .eq('id', projectId)
      }

      return {
        action: 'tool_created',
        message: `Done! I created a booking form for your site. View it at /book/${projectId}`,
      }
    }
```

- [ ] **Step 4: Update the initial generation path (no blocks) to also generate the booking tool**

In the `if (currentBlocks.length === 0)` block (around line 31), add the booking tool generation after `generateSite()`:

Change:

```typescript
  if (currentBlocks.length === 0) {
    const result = await generateSite(message, projectId)
    const blockTypes = result.blocks.map(b => b.block_type).join(', ')
    return {
      action: 'generated',
      message: `Your website is ready! I created sections: ${blockTypes} with the ${result.theme} theme.`,
    }
  }
```

To:

```typescript
  if (currentBlocks.length === 0) {
    const result = await generateSite(message, projectId)
    const blockTypes = result.blocks.map(b => b.block_type).join(', ')

    // Auto-generate booking tool
    const templateType = result.config.template || 'landing'
    const toolConfig = await generateBookingTool(message, projectId, templateType)

    if (toolConfig) {
      // Wire CTA buttons to booking page
      const updatedContent = { ...result.config.content, bookingUrl: `/book/${projectId}`, bookingText: toolConfig.submitText }
      const updatedConfig = { ...result.config, content: updatedContent }
      await supabase
        .from('projects')
        .update({ template_config: updatedConfig, updated_at: new Date().toISOString() })
        .eq('id', projectId)
    }

    return {
      action: 'generated',
      message: `Your website is ready! I created sections: ${blockTypes} with the ${result.theme} theme.${toolConfig ? ` A booking form is live at /book/${projectId}` : ''}`,
    }
  }
```

- [ ] **Step 5: Update the `generate_site` case (rebuild) to also regenerate the booking tool**

In the `case 'generate_site':` block, add tool regeneration. Change:

```typescript
    case 'generate_site': {
      // Delete existing blocks, then regenerate
      await supabase.from('blocks').delete().eq('project_id', projectId)
      const result = await generateSite(message, projectId)
      const blockTypes = result.blocks.map(b => b.block_type).join(', ')
      return {
        action: 'generated',
        message: `Rebuilt your website! Sections: ${blockTypes} with the ${result.theme} theme.`,
      }
    }
```

To:

```typescript
    case 'generate_site': {
      // Delete existing blocks and tools, then regenerate
      await supabase.from('blocks').delete().eq('project_id', projectId)
      await supabase.from('tools').delete().eq('project_id', projectId)
      const result = await generateSite(message, projectId)
      const blockTypes = result.blocks.map(b => b.block_type).join(', ')

      // Auto-generate booking tool
      const templateType = result.config.template || 'landing'
      const toolConfig = await generateBookingTool(message, projectId, templateType)

      if (toolConfig) {
        const updatedContent = { ...result.config.content, bookingUrl: `/book/${projectId}`, bookingText: toolConfig.submitText }
        const updatedConfig = { ...result.config, content: updatedContent }
        await supabase
          .from('projects')
          .update({ template_config: updatedConfig, updated_at: new Date().toISOString() })
          .eq('id', projectId)
      }

      return {
        action: 'generated',
        message: `Rebuilt your website! Sections: ${blockTypes} with the ${result.theme} theme.${toolConfig ? ` Booking form updated at /book/${projectId}` : ''}`,
      }
    }
```

- [ ] **Step 6: Verify build**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npx next build
```

- [ ] **Step 7: Commit**

```bash
git add src/services/agents/orchestrator.ts && git commit -m "feat: add edit_tool, add_tool cases and auto-generate booking tool on site creation"
```

---

## Chunk 4: Submission API Endpoint

### Task 10: Create the submission API route

**Files:**
- Create: `src/app/api/tools/submit/route.ts`

- [ ] **Step 1: Create the API route with validation and rate limiting**

Create `src/app/api/tools/submit/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ToolConfig, ToolField } from '@/services/agents/types'

// --- Rate Limiting ---

const ipSubmissions = new Map<string, { count: number; resetAt: number }>()
const toolSubmissions = new Map<string, { count: number; resetAt: number }>()

const IP_LIMIT = 10        // per minute
const IP_WINDOW = 60_000   // 1 minute
const TOOL_LIMIT = 100     // per hour
const TOOL_WINDOW = 3600_000 // 1 hour

function checkRateLimit(
  store: Map<string, { count: number; resetAt: number }>,
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now()
  const entry = store.get(key)

  // Expired or no entry — reset the window
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) {
    return false
  }

  entry.count++
  return true
}

// NOTE: No setInterval for cleanup — serverless functions are ephemeral.
// The checkRateLimit function handles expiry lazily by resetting expired entries.
// This in-memory rate limiter resets on cold starts. For production, use
// Upstash Redis or Vercel's built-in rate limiting.

// --- Validation ---

function stripHtmlTags(str: string): string {
  return str.replace(/<[^>]*>/g, '')
}

function validateEmail(email: string): boolean {
  return /^.+@.+\..+$/.test(email)
}

function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 7
}

function validateSubmission(
  data: Record<string, unknown>,
  fields: ToolField[]
): { valid: boolean; errors: string[]; sanitized: Record<string, string> } {
  const errors: string[] = []
  const sanitized: Record<string, string> = {}

  for (const field of fields) {
    const value = data[field.name]

    // Check required
    if (field.required && (!value || String(value).trim() === '')) {
      errors.push(`${field.label} is required`)
      continue
    }

    // Skip optional empty fields
    if (!value || String(value).trim() === '') continue

    const strValue = stripHtmlTags(String(value).trim())

    // Max length check
    if (strValue.length > 2000) {
      errors.push(`${field.label} is too long (max 2000 characters)`)
      continue
    }

    // Type-specific validation
    switch (field.type) {
      case 'email':
        if (!validateEmail(strValue)) {
          errors.push(`${field.label} must be a valid email address`)
          continue
        }
        break
      case 'phone':
        if (!validatePhone(strValue)) {
          errors.push(`${field.label} must contain at least 7 digits`)
          continue
        }
        break
      case 'number':
        if (isNaN(Number(strValue))) {
          errors.push(`${field.label} must be a number`)
          continue
        }
        break
      case 'dropdown':
        if (field.options && !field.options.includes(strValue)) {
          errors.push(`${field.label} must be one of: ${field.options.join(', ')}`)
          continue
        }
        break
    }

    sanitized[field.name] = strValue
  }

  return { valid: errors.length === 0, errors, sanitized }
}

// --- Route Handler ---

// Use service role key for unauthenticated inserts
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(ipSubmissions, ip, IP_LIMIT, IP_WINDOW)) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse body
    const body = await req.json()
    const { tool_id, data } = body as { tool_id?: string; data?: Record<string, unknown> }

    if (!tool_id || !data) {
      return NextResponse.json(
        { error: 'tool_id and data are required' },
        { status: 400 }
      )
    }

    // Check payload size (rough check)
    if (JSON.stringify(data).length > 50_000) {
      return NextResponse.json(
        { error: 'Payload too large' },
        { status: 413 }
      )
    }

    // Rate limit by tool
    if (!checkRateLimit(toolSubmissions, tool_id, TOOL_LIMIT, TOOL_WINDOW)) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      )
    }

    const supabase = getServiceClient()

    // Load tool config
    const { data: tool, error: toolError } = await supabase
      .from('tools')
      .select('config, is_active')
      .eq('id', tool_id)
      .single()

    if (toolError || !tool) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404 }
      )
    }

    if (!tool.is_active) {
      return NextResponse.json(
        { error: 'This form is currently unavailable' },
        { status: 403 }
      )
    }

    const config = tool.config as ToolConfig

    if (!config.fields || !Array.isArray(config.fields)) {
      return NextResponse.json(
        { error: 'Form configuration error' },
        { status: 500 }
      )
    }

    // Validate submission data against field config
    const { valid, errors, sanitized } = validateSubmission(data, config.fields)

    if (!valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      )
    }

    // Insert submission
    const { error: insertError } = await supabase
      .from('tool_submissions')
      .insert({
        tool_id,
        data: sanitized,
      })

    if (insertError) {
      console.error('Failed to insert submission:', insertError.message)
      return NextResponse.json(
        { error: 'Failed to save submission' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Submit error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tools/submit/route.ts && git commit -m "feat: add /api/tools/submit endpoint with validation and rate limiting"
```

---

## Chunk 5: Form Page UI Components

### Task 11: Create form field components

**Files:**
- Create: `src/features/booking/form-fields.tsx`

- [ ] **Step 1: Create the field components file**

Create `src/features/booking/form-fields.tsx`:

```typescript
'use client'

import type { ToolField } from '@/services/agents/types'

interface FieldProps {
  field: ToolField
  value: string
  error?: string
  onChange: (name: string, value: string) => void
}

const baseInputClasses = 'w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm'
const labelClasses = 'block text-sm font-medium text-slate-700 mb-1.5'
const errorClasses = 'text-xs text-red-500 mt-1'

function TextField({ field, value, error, onChange }: FieldProps) {
  return (
    <div>
      <label className={labelClasses}>
        {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        placeholder={field.placeholder}
        className={`${baseInputClasses} ${error ? 'border-red-300 ring-red-100' : ''}`}
        maxLength={500}
      />
      {error && <p className={errorClasses}>{error}</p>}
    </div>
  )
}

function EmailField({ field, value, error, onChange }: FieldProps) {
  return (
    <div>
      <label className={labelClasses}>
        {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type="email"
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        placeholder={field.placeholder || 'email@example.com'}
        className={`${baseInputClasses} ${error ? 'border-red-300 ring-red-100' : ''}`}
      />
      {error && <p className={errorClasses}>{error}</p>}
    </div>
  )
}

function PhoneField({ field, value, error, onChange }: FieldProps) {
  return (
    <div>
      <label className={labelClasses}>
        {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type="tel"
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        placeholder={field.placeholder || '(555) 000-0000'}
        className={`${baseInputClasses} ${error ? 'border-red-300 ring-red-100' : ''}`}
      />
      {error && <p className={errorClasses}>{error}</p>}
    </div>
  )
}

function TextareaField({ field, value, error, onChange }: FieldProps) {
  return (
    <div>
      <label className={labelClasses}>
        {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        placeholder={field.placeholder}
        rows={4}
        className={`${baseInputClasses} resize-none ${error ? 'border-red-300 ring-red-100' : ''}`}
        maxLength={2000}
      />
      {error && <p className={errorClasses}>{error}</p>}
    </div>
  )
}

function NumberField({ field, value, error, onChange }: FieldProps) {
  return (
    <div>
      <label className={labelClasses}>
        {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        placeholder={field.placeholder}
        className={`${baseInputClasses} ${error ? 'border-red-300 ring-red-100' : ''}`}
      />
      {error && <p className={errorClasses}>{error}</p>}
    </div>
  )
}

function DropdownField({ field, value, error, onChange }: FieldProps) {
  return (
    <div>
      <label className={labelClasses}>
        {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        className={`${baseInputClasses} ${!value ? 'text-slate-400' : ''} ${error ? 'border-red-300 ring-red-100' : ''}`}
      >
        <option value="">Select {field.label.toLowerCase()}...</option>
        {(field.options || []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {error && <p className={errorClasses}>{error}</p>}
    </div>
  )
}

const fieldComponents: Record<string, React.ComponentType<FieldProps>> = {
  text: TextField,
  email: EmailField,
  phone: PhoneField,
  textarea: TextareaField,
  number: NumberField,
  dropdown: DropdownField,
}

export function FormField({ field, value, error, onChange }: FieldProps) {
  const Component = fieldComponents[field.type] || TextField
  return <Component field={field} value={value} error={error} onChange={onChange} />
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add src/features/booking/form-fields.tsx && git commit -m "feat: add form field components (text, email, phone, textarea, number, dropdown)"
```

---

### Task 12: Create thank-you component

**Files:**
- Create: `src/features/booking/thank-you.tsx`

- [ ] **Step 1: Create the component**

Create `src/features/booking/thank-you.tsx`:

```typescript
'use client'

interface ThankYouProps {
  message: string
  siteName: string
}

export function ThankYou({ message, siteName }: ThankYouProps) {
  return (
    <div className="text-center py-12 px-6">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-3">Submitted!</h2>
      <p className="text-slate-600 text-base leading-relaxed max-w-md mx-auto">{message}</p>
      <p className="text-slate-400 text-sm mt-6">— {siteName}</p>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add src/features/booking/thank-you.tsx && git commit -m "feat: add ThankYou confirmation component"
```

---

### Task 13: Create booking form component

**Files:**
- Create: `src/features/booking/booking-form.tsx`

- [ ] **Step 1: Create the form component with validation**

Create `src/features/booking/booking-form.tsx`:

```typescript
'use client'

import { useState, FormEvent } from 'react'
import type { ToolConfig } from '@/services/agents/types'
import { FormField } from './form-fields'
import { ThankYou } from './thank-you'

interface BookingFormProps {
  toolId: string
  config: ToolConfig
  siteName: string
  accentBg: string
  accentBgHover: string
  accentText: string
}

function validateField(value: string, field: ToolConfig['fields'][0]): string | null {
  if (field.required && !value.trim()) {
    return `${field.label} is required`
  }
  if (!value.trim()) return null

  switch (field.type) {
    case 'email':
      if (!/^.+@.+\..+$/.test(value)) return 'Please enter a valid email address'
      break
    case 'phone': {
      const digits = value.replace(/\D/g, '')
      if (digits.length < 7) return 'Please enter a valid phone number'
      break
    }
    case 'number':
      if (isNaN(Number(value))) return 'Please enter a number'
      break
    case 'dropdown':
      if (field.options && !field.options.includes(value)) return 'Please select a valid option'
      break
  }
  return null
}

export function BookingForm({ toolId, config, siteName, accentBg, accentBgHover, accentText }: BookingFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const field of config.fields) {
      initial[field.name] = ''
    }
    return initial
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    // Clear error on change
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    // Validate all fields
    const newErrors: Record<string, string> = {}
    for (const field of config.fields) {
      const error = validateField(values[field.name] || '', field)
      if (error) newErrors[field.name] = error
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/tools/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_id: toolId, data: values }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Submission failed (${res.status})`)
      }

      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return <ThankYou message={config.successMessage} siteName={siteName} />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {config.fields.map((field) => (
        <FormField
          key={field.name}
          field={field}
          value={values[field.name] || ''}
          error={errors[field.name]}
          onChange={handleChange}
        />
      ))}

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className={`w-full ${accentBg} ${accentBgHover} ${accentText} font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 text-sm disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow-md`}
      >
        {submitting ? 'Submitting...' : config.submitText}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add src/features/booking/booking-form.tsx && git commit -m "feat: add BookingForm component with client-side validation"
```

---

### Task 14: Create booking page layout component

**Files:**
- Create: `src/features/booking/booking-page.tsx`

- [ ] **Step 1: Create the split layout component**

Create `src/features/booking/booking-page.tsx`:

```typescript
'use client'

import type { ToolConfig } from '@/services/agents/types'
import type { ThemeClasses } from '@/templates/theme-classes'
import { BookingForm } from './booking-form'

interface BookingPageProps {
  toolId: string
  config: ToolConfig
  siteName: string
  theme: ThemeClasses
}

export function BookingPage({ toolId, config, siteName, theme }: BookingPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row rounded-2xl overflow-hidden shadow-xl ring-1 ring-slate-200">
        {/* Left panel — Branding */}
        <div className={`${theme.accentBg} lg:w-[45%] p-8 lg:p-10 flex flex-col justify-center`}>
          <p className={`text-sm font-medium ${theme.accentText} opacity-80 uppercase tracking-wider mb-3`}>
            {siteName}
          </p>
          <h1 className={`text-2xl lg:text-3xl font-bold ${theme.accentText} tracking-tight mb-3`}>
            {config.title}
          </h1>
          <p className={`text-sm lg:text-base ${theme.accentText} opacity-80 leading-relaxed mb-8`}>
            {config.subtitle}
          </p>

          {config.trustSignals.length > 0 && (
            <ul className="space-y-3">
              {config.trustSignals.map((signal, i) => (
                <li key={i} className="flex items-start gap-3">
                  <svg className={`w-5 h-5 ${theme.accentText} opacity-90 mt-0.5 flex-shrink-0`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span className={`text-sm ${theme.accentText} opacity-90`}>{signal}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right panel — Form */}
        <div className="lg:w-[55%] bg-white p-8 lg:p-10">
          <BookingForm
            toolId={toolId}
            config={config}
            siteName={siteName}
            accentBg={theme.accentBg}
            accentBgHover={theme.accentBgHover}
            accentText={theme.accentText}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add src/features/booking/booking-page.tsx && git commit -m "feat: add BookingPage split layout component"
```

---

### Task 15: Create the /book route layout override

**Files:**
- Create: `src/app/book/layout.tsx`

The root layout at `src/app/layout.tsx` applies `className="dark"` on `<html>` and `bg-black text-white` on `<body>`. The booking page needs a light theme. We override this by creating a route group layout for `/book` that resets the body styling.

- [ ] **Step 1: Create the booking layout**

Create `src/app/book/layout.tsx`:

```typescript
export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen" style={{ background: '#f8fafc', color: '#0f172a' }}>
      {children}
    </div>
  )
}
```

Note: We use both Tailwind classes AND inline styles as a fallback. The Tailwind classes may be overridden by the root layout's dark mode. The inline styles ensure the light theme always wins.

- [ ] **Step 2: Verify build**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/book/layout.tsx && git commit -m "feat: add /book layout to override root dark theme"
```

---

### Task 16: Create the /book/[projectId] page route

**Files:**
- Create: `src/app/book/[projectId]/page.tsx`

- [ ] **Step 1: Create the server component page**

Create `src/app/book/[projectId]/page.tsx`:

```typescript
import { getSupabaseClient } from '@/services/supabase/client'
import { getThemeClasses } from '@/templates/theme-classes'
import type { ThemeId } from '@/templates/types'
import type { ToolConfig } from '@/services/agents/types'
import { BookingPage } from '@/features/booking/booking-page'

export default async function BookPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = getSupabaseClient()

  // Load project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('name, theme')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Page not found</h1>
          <p className="text-slate-500">This page doesn&apos;t exist.</p>
        </div>
      </div>
    )
  }

  // Load tool
  const { data: tool, error: toolError } = await supabase
    .from('tools')
    .select('id, config, is_active')
    .eq('project_id', projectId)
    .eq('tool_type', 'booking')
    .single()

  if (toolError || !tool) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">No booking form yet</h1>
          <p className="text-slate-500">A booking form hasn&apos;t been set up for this site yet.</p>
        </div>
      </div>
    )
  }

  if (!tool.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Form unavailable</h1>
          <p className="text-slate-500">This form is currently unavailable.</p>
        </div>
      </div>
    )
  }

  const config = tool.config as ToolConfig

  if (!config.fields || !Array.isArray(config.fields) || config.fields.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Coming soon</h1>
          <p className="text-slate-500">This form is being set up. Please check back soon.</p>
        </div>
      </div>
    )
  }

  const themeId = (project.theme || 'clean') as ThemeId
  const theme = getThemeClasses(themeId)
  const siteName = project.name || 'Website'

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <style>{`body { font-family: 'Inter', system-ui, sans-serif; margin: 0; }`}</style>
      <BookingPage
        toolId={tool.id}
        config={config}
        siteName={siteName}
        theme={theme}
      />
    </>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/book && git commit -m "feat: add /book/[projectId] page with error states and theme matching"
```

---

## Chunk 6: Final Verification

### Task 17: Full build verification

- [ ] **Step 1: Run full build**

```bash
cd /Users/tarun/Desktop/Pravik_Builder && npx next build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Verify all new files exist**

Check that all files from the spec's file map exist:

```bash
ls -la src/services/agents/tool-generator.ts \
       src/services/agents/tool-editor.ts \
       src/services/agents/prompts/tool-generator.ts \
       src/services/agents/prompts/tool-editor.ts \
       src/app/book/*/page.tsx \
       src/features/booking/booking-page.tsx \
       src/features/booking/booking-form.tsx \
       src/features/booking/form-fields.tsx \
       src/features/booking/thank-you.tsx \
       src/app/api/tools/submit/route.ts
```

- [ ] **Step 3: Verify database tables exist**

Run via Supabase MCP `execute_sql`:

```sql
SELECT table_name, (SELECT count(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name AND table_schema = 'public') as column_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('tools', 'tool_submissions');
```

Expected: Both tables with correct column counts (tools: 7, tool_submissions: 4).

- [ ] **Step 4: Final commit (if any uncommitted changes)**

```bash
git status
```

If clean, done. If not, commit remaining changes.

---

### Task 18: Deploy and manual test

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

- [ ] **Step 2: Deploy to Vercel**

Use `mcp__6f4529d0-ec0d-41e6-80dd-66d416e42f25__deploy_to_vercel` or verify auto-deploy.

Ensure `SUPABASE_SERVICE_ROLE_KEY` environment variable is set in Vercel (needed by the submit endpoint).

- [ ] **Step 3: Manual test — generate a site and verify booking tool was created**

1. Go to the builder, create a new site (e.g., "I'm a soccer coach, build me a website")
2. After generation, check the response mentions a booking form
3. Visit `/book/{projectId}` — should show the split layout form
4. Verify form fields match the business type
5. Submit the form — should show thank you message
6. In Supabase dashboard, check `tool_submissions` table for the new row

- [ ] **Step 4: Manual test — edit the booking form via chat**

1. In the builder chat, say "Add a field for shirt size with options S, M, L, XL"
2. Verify the response confirms the change
3. Refresh `/book/{projectId}` — new dropdown should appear
4. Say "Make phone number required"
5. Refresh — phone field should now show the required asterisk

- [ ] **Step 5: Manual test — add booking form to existing site**

1. Open a project that was created before this feature (no tool exists)
2. Say "Add a booking form"
3. Verify it creates one and gives the URL
4. Visit the URL and verify it works
