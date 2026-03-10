# Multi-Agent Builder System Design

## Goal

Replace the single-prompt template picker with a multi-agent system that routes user requests to specialized agents, enabling full HTML control over generated websites.

## Problem

The current system has one AI call (Claude Haiku) that always regenerates the entire TemplateConfig JSON regardless of what the user asks. "Add a phone number at the top" gets the same treatment as "build me a website" — it re-picks template/theme and regenerates all content, often ignoring the specific request.

## Architecture Overview

Three-tier pipeline: Router → Agent → Renderer

```
User Message
    ↓
[Router] Haiku (~$0.001, <1s)
  → Classifies intent + identifies target
    ↓
[Agent] Dispatched based on intent
  → generate_site  (Sonnet) — first-time creation
  → edit_block     (Sonnet) — modify specific HTML block
  → add_block      (Sonnet) — create new section
  → remove_block   (direct) — delete block from DB
  → reorder_blocks (direct) — update positions
  → change_theme   (Haiku)  — swap CSS variables
  → clarify        (none)   — ask user a question
    ↓
[Renderer] Assembles blocks + theme → full HTML
```

## Data Model

### New `blocks` table

```sql
CREATE TABLE blocks (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  block_type text NOT NULL,
  html       text NOT NULL,
  position   int NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

- `block_type`: navbar | hero | features | gallery | pricing | cta | contact | footer | custom
- `html`: rendered HTML for this block, uses CSS variables for theme compatibility
- `position`: render order (0, 1, 2, ...)

### Projects table changes

- Keep `template_config` for reference (original template/theme choice)
- Add `theme text` column — current active theme ID, stored separately so theme swaps don't touch blocks

### Rendering

```
SELECT html FROM blocks WHERE project_id = ? ORDER BY position
→ concatenate all block HTML
→ wrap in <!DOCTYPE html> + <head> with theme CSS + <body>
```

### Migration path

Existing projects with `template_config` but no blocks render via the old path. New projects use blocks. No breaking change.

## Router Agent (Haiku)

Fast, cheap classifier. Receives user message + summary of current blocks.

### Input

```json
{
  "message": "add a phone number at the top",
  "has_site": true,
  "current_blocks": ["navbar:0", "hero:1", "gallery:2", "contact:3", "footer:4"],
  "current_theme": "ocean"
}
```

### Output

```json
{
  "intent": "edit_block",
  "target_blocks": ["navbar"],
  "description": "Add phone number to the navbar section",
  "needs_clarification": false
}
```

### Intent types

| Intent | Agent | When |
|--------|-------|------|
| `generate_site` | Generator (Sonnet) | No blocks exist, user describes what they want |
| `edit_block` | Block Editor (Sonnet) | Modify existing block(s) — content, style, layout |
| `add_block` | Block Editor (Sonnet) | Create a new section |
| `remove_block` | Direct DB delete | "remove the pricing section" |
| `reorder_blocks` | Direct DB update | "move contact above the footer" |
| `change_theme` | Theme Agent (Haiku) | "make it darker", "use green colors" |
| `clarify` | No agent | Ambiguous request, return question to user |

`remove_block` and `reorder_blocks` don't need an AI agent — the router identifies the target and the system executes directly.

## Agent Implementations

### Generator Agent (Sonnet)

Runs once per project for initial site creation.

- Gets user's description (e.g. "soccer coaching site in Palo Alto")
- Picks template + theme (same logic as current system)
- Renders full HTML using current template system
- Splits rendered HTML into blocks — each `<nav>`, `<section>`, `<footer>` becomes a block
- Stores blocks in DB
- Returns assistant message describing what was built

### Block Editor Agent (Sonnet)

The workhorse for all HTML modifications.

- Input: target block's current HTML + user's request + site context (theme, block list)
- System prompt enforces: return ONLY the updated HTML block, use CSS variables for theme compatibility
- Output: modified HTML string
- For `add_block`: no existing HTML input, Sonnet generates a new block from scratch

Examples:
- "add phone number at the top" → edits navbar block HTML
- "make the hero bigger" → edits hero block CSS
- "add testimonials section" → creates new testimonials block

### Theme Agent (Haiku)

Fast CSS-only swap.

- Input: user request + current theme + available themes
- Output: new theme ID
- Maps vague requests: "make it warmer" → sunset, "make it darker" → ocean/violet
- No HTML changes — CSS variables handle everything

## API Changes

### Endpoint

`POST /api/builder/generate` stays as the single endpoint. Orchestration happens server-side.

### Response format

```json
{
  "action": "generated" | "edited" | "theme_changed" | "removed" | "reordered" | "clarify",
  "message": "Done! I added a phone number to your navbar.",
  "question": null,
  "previewUrl": "/site/{project_id}"
}
```

For `clarify` action, `question` contains the AI's question and no preview changes occur.

### Orchestrator flow

```
POST /api/builder/generate { message, project_id }
  → Load blocks + theme from DB
  → Router (Haiku) → determines intent
  → Dispatch to appropriate agent
  → Update DB (blocks/theme)
  → Return { action, message, previewUrl }
```

## Renderer Changes

New `renderFromBlocks()` replaces `renderTemplate()`:

```typescript
export async function renderFromBlocks(projectId: string): Promise<string> {
  // 1. Load blocks ordered by position
  // 2. Load theme from project
  // 3. Concatenate block HTML
  // 4. Wrap in HTML document with theme CSS
}
```

Preview endpoint falls back to old `template_config` rendering for unmigrated projects.

## Frontend Changes

- Response `action` field drives contextual UI messages
- `clarify` action shows AI question in chat without loading spinner on preview
- Loading text varies: "Generating..." for new sites, "Updating..." for edits

## File Structure

```
src/services/agents/
  router.ts          — Haiku intent classifier
  generator.ts       — Sonnet site generator (templates → blocks)
  block-editor.ts    — Sonnet HTML block editor
  theme-agent.ts     — Haiku theme switcher
  prompts/
    router.ts        — Router system prompt
    generator.ts     — Generator system prompt
    block-editor.ts  — Block editor system prompt
    theme.ts         — Theme agent system prompt
  orchestrator.ts    — Ties it all together
```

## Model Strategy

- **Router**: Claude Haiku (~$0.001/request, <1s) — classification only
- **Generator**: Claude Sonnet (~$0.01/request) — initial site creation
- **Block Editor**: Claude Sonnet (~$0.01/request) — HTML modifications
- **Theme Agent**: Claude Haiku (~$0.001/request) — CSS variable swap

## Cost Estimates

- First generation: ~$0.012 (router + generator)
- Content/layout edit: ~$0.011 (router + block editor)
- Theme change: ~$0.002 (router + theme agent)
- Clarification: ~$0.001 (router only)
