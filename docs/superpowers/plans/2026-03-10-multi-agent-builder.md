# Multi-Agent Builder Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-prompt template picker with a multi-agent router system that enables full HTML control over generated websites via block-level editing.

**Architecture:** Haiku router classifies user intent and dispatches to specialized agents (Sonnet for generation/editing, Haiku for theme swaps). Websites are stored as ordered HTML blocks in Supabase, assembled at render time with theme CSS.

**Tech Stack:** Next.js 16 (App Router), anthropic-ai/sdk (Haiku + Sonnet), Supabase Postgres, TypeScript

---

## Chunk 1: Data Model and Types

### Task 1: Database migration — blocks table and theme column

**Files:**
- Supabase migration via MCP tool (project: saqlwyfdlxjjzatsccgd)

- [ ] **Step 1: Create blocks table**

Run via Supabase MCP apply_migration:

```sql
CREATE TABLE blocks (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  block_type text NOT NULL,
  html       text NOT NULL,
  position   int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_blocks_project_id ON blocks(project_id);
```

- [ ] **Step 2: Add theme column to projects**

```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS theme text DEFAULT 'ocean';
```

- [ ] **Step 3: Create RPC function for position shifting**

```sql
CREATE OR REPLACE FUNCTION increment_block_positions(p_project_id uuid, p_from_position int)
RETURNS void AS $$
BEGIN
  UPDATE blocks SET position = position + 1
  WHERE project_id = p_project_id AND position >= p_from_position;
END;
$$ LANGUAGE plpgsql;
```

- [ ] **Step 4: Verify** via list_tables MCP tool

### Task 2: Agent types and Project interface update

**Files:**
- Create: `src/services/agents/types.ts`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Create src/services/agents/types.ts**

```typescript
export type AgentIntent =
  | 'generate_site'
  | 'edit_block'
  | 'add_block'
  | 'remove_block'
  | 'reorder_blocks'
  | 'change_theme'
  | 'clarify'

export interface RouterResult {
  intent: AgentIntent
  target_blocks: string[]
  description: string
  question?: string
  position?: number
}

export interface AgentResponse {
  action: 'generated' | 'edited' | 'theme_changed' | 'removed' | 'reordered' | 'clarify'
  message: string
  question?: string
}

export interface Block {
  id: string
  project_id: string
  block_type: string
  html: string
  position: number
}
```

- [ ] **Step 2: Add theme to Project interface in src/lib/types.ts**

Add `theme: string | null` to the Project interface after `template_config`.

- [ ] **Step 3: Commit**

```
git add src/services/agents/types.ts src/lib/types.ts
git commit -m "feat: add agent types and update Project interface"
```

---

## Chunk 2: Agent Prompts

### Task 3: Router prompt

**Files:**
- Create: `src/services/agents/prompts/router.ts`

- [ ] **Step 1: Create router prompt**

The router prompt receives the current site state (has blocks? which blocks? current theme?) and classifies the user intent into one of the 7 intents. It outputs structured JSON with intent, target_blocks, description, and optional question/position.

Available intents vary based on whether blocks exist:
- No blocks: only generate_site and clarify
- Has blocks: edit_block, add_block, remove_block, reorder_blocks, change_theme, clarify, generate_site (rebuild)

Block types: navbar, hero, features, gallery, pricing, cta, contact, footer, testimonials, custom
Themes: ocean, sunset, violet, forest, mono

- [ ] **Step 2: Commit**

### Task 4: Generator prompt

**Files:**
- Create: `src/services/agents/prompts/generator.ts`

- [ ] **Step 1: Create generator prompt**

Reuses template/theme descriptions from existing prompts.ts. Instructs Sonnet to pick the best template and theme, then generate all content fields as JSON. Output is a TemplateConfig object.

- [ ] **Step 2: Commit**

### Task 5: Block editor prompt

**Files:**
- Create: `src/services/agents/prompts/block-editor.ts`

- [ ] **Step 1: Create block editor prompt**

Two functions:
- `getBlockEditorPrompt(blockType, currentHtml, allBlockTypes)` — for editing existing blocks
- `getAddBlockPrompt(blockType, allBlockTypes)` — for creating new blocks

Key rules enforced in prompt:
1. Return ONLY the updated HTML, no explanation or markdown fences
2. Use CSS custom properties: var(--bg), var(--text), var(--accent), var(--accent-text), var(--surface), var(--muted), var(--border)
3. Use inline styles (no external CSS framework)
4. Preserve existing content unless asked to change it
5. Match existing style patterns

- [ ] **Step 2: Commit**

### Task 6: Theme agent prompt

**Files:**
- Create: `src/services/agents/prompts/theme.ts`

- [ ] **Step 1: Create theme prompt**

Lists available themes with descriptions and color values. Maps vague requests like "warmer" to sunset, "darker" to ocean/violet. Returns JSON with theme ID and description.

- [ ] **Step 2: Commit**

---

## Chunk 3: Agent Implementations

### Task 7: Router agent

**Files:**
- Create: `src/services/agents/router.ts`

- [ ] **Step 1: Implement routeIntent function**

- Uses Claude Haiku (claude-haiku-4-5-20251001), max_tokens: 256
- Input: message, blocks array, current theme
- Builds block summary as "type:position" pairs
- Parses JSON response into RouterResult
- Strips markdown fences before parsing

- [ ] **Step 2: Commit**

### Task 8: Generator agent

**Files:**
- Create: `src/services/agents/generator.ts`

- [ ] **Step 1: Implement generateSite function**

Flow:
1. Call Sonnet with generator prompt to get TemplateConfig JSON
2. Validate template/theme IDs (fallback to defaults)
3. Render HTML using existing template renderers (renderLandingLight, etc.)
4. Split rendered HTML into blocks using regex (nav, sections, footer)
5. Store blocks in Supabase blocks table
6. Update project with theme and template_config
7. Return blocks, theme, and config

The splitHtmlIntoBlocks function extracts:
- `<nav>` tags as navbar blocks
- `<section>` and `<footer>` tags, classified by id attribute or content keywords (features, pricing, gallery, contact, testimonials, cta)
- First unclassified section becomes hero

- [ ] **Step 2: Commit**

### Task 9: Block editor agent

**Files:**
- Create: `src/services/agents/block-editor.ts`

- [ ] **Step 1: Implement editBlock and addBlock functions**

editBlock:
- Uses Claude Sonnet, max_tokens: 4096
- Sends target block HTML + user message
- Returns updated HTML string

addBlock:
- Uses Claude Sonnet, max_tokens: 4096
- Generates new block HTML
- Calls increment_block_positions RPC to shift existing blocks
- Inserts new block at specified position

- [ ] **Step 2: Commit**

### Task 10: Theme agent

**Files:**
- Create: `src/services/agents/theme-agent.ts`

- [ ] **Step 1: Implement pickTheme function**

- Uses Claude Haiku, max_tokens: 128
- Returns theme ID and description
- Validates against THEME_IDS

- [ ] **Step 2: Commit**

---

## Chunk 4: Orchestrator and Renderer

### Task 11: Block renderer

**Files:**
- Create: `src/templates/render-blocks.ts`

- [ ] **Step 1: Implement renderFromBlocks function**

- Loads blocks from Supabase ordered by position
- Loads project theme
- Concatenates block HTML
- Wraps in full HTML document with theme CSS, base reset styles, and font stack
- Returns null if no blocks (allows fallback to old renderer)

- [ ] **Step 2: Commit**

### Task 12: Orchestrator

**Files:**
- Create: `src/services/agents/orchestrator.ts`

- [ ] **Step 1: Implement handleMessage function**

Main dispatch logic:
1. Load blocks and theme from Supabase
2. If no blocks exist: skip router, go straight to generateSite
3. Otherwise: call routeIntent to classify
4. Switch on intent:
   - generate_site: delete existing blocks, run generator
   - edit_block: find target block, run block editor, update in DB
   - add_block: run block editor to create new block, insert at position
   - remove_block: delete block from DB
   - reorder_blocks: update positions (MVP: acknowledge only)
   - change_theme: run theme agent, update project
   - clarify: return question to user
5. Return AgentResponse with action, message, and optional question

Edge cases:
- edit_block target not found: return clarify asking if user wants to add it instead
- generate_site with existing blocks: delete blocks first, then regenerate

- [ ] **Step 2: Commit**

---

## Chunk 5: Wire Up API and Frontend

### Task 13: Update generate route

**Files:**
- Modify: `src/app/api/builder/generate/route.ts`

- [ ] **Step 1: Replace route to use orchestrator**

- Import handleMessage from orchestrator
- Call handleMessage(message, project_id)
- Store user and assistant messages in Supabase
- Return { action, message, question, previewUrl }
- Keep maxDuration = 30

- [ ] **Step 2: Commit**

### Task 14: Update preview route and site page

**Files:**
- Modify: `src/app/api/builder/preview/[projectId]/route.ts`
- Modify: `src/app/site/[projectId]/page.tsx`

- [ ] **Step 1: Update preview route**

- Try renderFromBlocks first
- If returns null (no blocks), fall back to old renderTemplate with template_config
- If neither exists, return "No preview available"

- [ ] **Step 2: Update site page with same fallback**

- [ ] **Step 3: Commit**

### Task 15: Update builder page and preview panel

**Files:**
- Modify: `src/app/build/[projectId]/page.tsx`
- Modify: `src/features/builder/preview-panel.tsx`

- [ ] **Step 1: Update builder page for new response format**

- Use result.message directly as assistant content (server generates good messages now)
- Only refresh preview iframe when action is not 'clarify'
- For clarify: just show the message in chat, no loading on preview

- [ ] **Step 2: Update preview panel**

- Accept action prop for contextual loading text
- "Generating your website..." for generate
- "Updating..." for edit/add/remove
- "Switching theme..." for theme_changed

- [ ] **Step 3: Commit**

### Task 16: Build and deploy

- [ ] **Step 1: Run npm run build — verify no errors**
- [ ] **Step 2: Test locally — first message, theme change, block edit, clarify**
- [ ] **Step 3: Deploy with npx vercel --prod --yes**
- [ ] **Step 4: Final commit**
