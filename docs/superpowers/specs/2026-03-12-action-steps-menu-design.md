# Action Steps Menu — Design Spec

## Overview

A left-edge slide-out drawer that shows users a visual checklist of post-build steps (contact form, phone number, etc.) during a voice call. The menu stays in sync with the voice AI — Timmy can open it, check off completed items, and the user can tap items to signal what they want to work on next.

## Problem

After building a website, users need to set up several additional things (contact form, phone number, AI phone agent). Currently the voice AI talks through these one at a time, but the user has no visual reference of what's available, what's done, and what's next. This makes the experience feel open-ended rather than guided.

## Solution

A collapsible left-edge tab + drawer overlay on the builder page. Static checklist defined in code. Bidirectional sync with voice AI via existing Supabase Realtime channel.

---

## UI Components

### ActionStepsTab (collapsed state)

- Small tab anchored to the left edge of the screen, vertically centered
- 18px wide, ~52px tall, rounded on the right side (border-radius: 0 8px 8px 0)
- Dark background matching existing UI (#1e1e2e, border #333)
- Contains a small chevron icon (>)
- Blue badge overlapping top-right corner shows count of remaining (non-completed) actionable steps
- Badge does NOT count "coming soon" items
- Badge hidden when count is 0 (all steps done)
- Only visible during active voice calls (`isVoiceCall && callActive`)
- Tapping the tab opens the drawer

### ActionStepsDrawer (expanded state)

- Slides in from the left edge, covers ~70% of screen width
- Full height of the preview area (does not cover the chat panel at bottom)
- Dark glass background (#141420) with right border (#2a2a3a)
- Preview behind is dimmed with a semi-transparent overlay
- Tapping the dimmed area closes the drawer
- Smooth slide transition (300ms ease-out)

### Step Item States

Each step in the checklist renders differently based on its state:

1. **Completed** — Green filled circle with checkmark, text struck through, reduced opacity (0.5). Not tappable (does not fire `step_selected` events)
2. **Active/available** — Empty circle with colored border (#3b82f6 for highlighted, #444 for normal), white text, subtitle describing what it does. Tappable — has hover/active state with subtle background highlight
3. **Coming soon** — Dashed circle border (#333), gray text, "Coming soon" subtitle, reduced opacity (0.35). Not tappable

### Drawer Header

- "NEXT STEPS" label in small caps, muted color (#666), weight 700, letter-spacing 0.5px

---

## Static Checklist Definition

Steps are defined as a TypeScript constant — no database table needed:

```typescript
interface ActionStep {
  id: string
  label: string
  subtitle: string
  comingSoon: boolean
}

const ACTION_STEPS: ActionStep[] = [
  { id: 'build_site', label: 'Build website', subtitle: 'Create your site', comingSoon: false },
  { id: 'contact_form', label: 'Add contact form', subtitle: 'Collect leads from visitors', comingSoon: false },
  { id: 'phone_number', label: 'Get phone number', subtitle: 'Local number for your business', comingSoon: false },
  { id: 'ai_phone', label: 'AI phone agent', subtitle: 'Answer calls automatically', comingSoon: true },
]
```

To add new steps in the future, add entries to this array. If `comingSoon: true`, the step renders as grayed-out and is not interactive.

### Completion Detection

Step completion is determined by checking project state from the existing database — no new tables:

- `build_site`: Project has at least one block in the `blocks` table
- `contact_form`: Project has a tool with `tool_type = 'booking'` in the `tools` table (the existing booking/contact form system uses `tool_type = 'booking'` — see `fetch_site_state()` in `builder_api.py` and `handle_edit_website` in `tools.py`)
- `phone_number`: Project has a non-null `provisioned_phone` in the `projects` table
- `ai_phone`: Always incomplete (coming soon)

### New API endpoint for completion state

The existing `/api/projects` endpoint returns project metadata only (no blocks/tools). A new lightweight endpoint is needed:

**`GET /api/projects/[projectId]/completion`**

Returns the data needed to determine step completion:

```typescript
// Response shape
{
  hasBlocks: boolean        // blocks table has ≥1 row for this project
  hasBookingTool: boolean   // tools table has a row with tool_type='booking' for this project
  hasPhone: boolean         // projects.provisioned_phone is not null
}
```

Implementation: A single Supabase query (or 2-3 small queries) checking the three conditions. No auth required — the projectId is a UUID, same pattern as the preview endpoint.

The frontend calls this once on mount to pre-populate `completedSteps`. During the call, completion updates arrive via Realtime broadcasts (no polling needed).

---

## Realtime Events (Voice AI <-> Frontend)

Uses the existing `call:{callSid}` Supabase Realtime channel. New broadcast events:

### Voice Server -> Frontend

| Event | Payload | Purpose |
|---|---|---|
| `open_action_menu` | `{}` | Voice AI tells frontend to slide open the drawer |
| `close_action_menu` | `{}` | Voice AI tells frontend to close the drawer |
| `step_completed` | `{ stepId: string }` | Mark a step as done (green checkmark) |

### Frontend -> Voice Server

| Web Action | Payload | Purpose |
|---|---|---|
| `step_selected` | `{ stepId: string, stepLabel: string }` | User tapped a step in the drawer |

These use the existing `broadcastWebAction` function on the frontend and `inject_web_context_into_llm` on the voice server — no new infrastructure.

### Handling `step_completed` before drawer is open

If `step_completed` arrives before `open_action_menu` (e.g. `build_site` completes and both events fire nearly simultaneously), the frontend simply adds the stepId to `completedSteps` immediately. The drawer doesn't need to be open to track completion. When the drawer opens moments later, it renders with the step already checked off.

The frontend silently ignores unknown step IDs in `step_completed` events (defensive against AI hallucination). Since `completedSteps` is a `Set<string>`, duplicate completions are naturally idempotent.

If the completion endpoint fetch fails on mount, the frontend assumes no steps are completed (empty set). This is a safe fallback — the voice AI will re-broadcast completions during the call.

---

## Voice Server Changes

### New context template in `realtime.py`

Add a `step_selected` handler to `inject_web_context_into_llm()`:

```
"step_selected" → "[WEB PAGE UPDATE: The user tapped '{stepLabel}' in the action steps menu.
They want to work on this next. Acknowledge their choice and proceed to help them with it.]"
```

### New broadcast helpers in `realtime.py`

```python
async def broadcast_open_action_menu(call_sid: str) -> None
async def broadcast_close_action_menu(call_sid: str) -> None
async def broadcast_step_completed(call_sid: str, step_id: str) -> None
```

### System prompt update in `pipeline.py`

Add to `_COMMON_RULES`:

```
ACTION STEPS MENU:
- After the website is built successfully, present the next steps to the user.
- Call open_action_menu to show the checklist on their phone.
- Say something like: "Great! Now that your site is ready, there are a couple things
  we can set up — like a contact form or a phone number. Take a look at the menu
  on your phone, or just tell me which one you'd like to do."
- When a step is completed, call complete_action_step with the step ID.
- When all available steps are done, call close_action_menu, celebrate, and wrap up.
- If the user wants to close the menu or seems done browsing steps, call close_action_menu.
- Do NOT mention "coming soon" items unless the user asks.
```

### New voice tools in `tools.py`

Three lightweight tools (no API calls, just broadcast):

1. **`open_action_menu`** — No parameters. Broadcasts `open_action_menu` event. Returns confirmation message.
2. **`close_action_menu`** — No parameters. Broadcasts `close_action_menu` event. Returns confirmation message. Use when user is done browsing or all steps are complete.
3. **`complete_action_step`** — Parameter: `step_id` (string, validated against known step IDs: `build_site`, `contact_form`, `phone_number`). Broadcasts `step_completed` event. Does NOT auto-close the drawer — the drawer stays open so users can see their progress and pick the next step. Returns confirmation. If an unknown `step_id` is provided, returns an error message listing valid IDs.

### OpenAI Realtime tool definitions

These are added to the `TOOLS` list in `tools.py`:

```python
{
    "type": "function",
    "name": "open_action_menu",
    "description": (
        "Open the action steps checklist on the user's phone screen. "
        "Call this after the website is built to show available next steps."
    ),
    "parameters": {"type": "object", "properties": {}, "required": []},
},
{
    "type": "function",
    "name": "close_action_menu",
    "description": (
        "Close the action steps checklist on the user's phone. "
        "Call this when the user is done browsing steps or all available steps are complete."
    ),
    "parameters": {"type": "object", "properties": {}, "required": []},
},
{
    "type": "function",
    "name": "complete_action_step",
    "description": (
        "Mark a step as completed in the action steps checklist. "
        "Call this after successfully completing a step (e.g. after adding a contact form "
        "or provisioning a phone number). The drawer stays open so the user can pick the next step."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "step_id": {
                "type": "string",
                "description": "The step ID to mark as complete: 'contact_form', 'phone_number', etc.",
            },
        },
        "required": ["step_id"],
    },
},
```

These tools are always included in the `TOOLS` list (not conditional on returning user status).

### Triggering the menu

In the existing `handle_build_website` handler, after a successful build:
- Call `broadcast_step_completed(call_sid, "build_site")`
- Call `broadcast_open_action_menu(call_sid)`

In `handle_edit_website`, detect when a booking/contact form was added. The reliable approach: capture the "before" state at the start of the handler (the existing `fetch_site_state()` guard on line ~425 of `tools.py` already does this), then after a successful edit, fetch site state again synchronously (before `result_callback`) and compare. If a booking tool now exists that didn't before, call `broadcast_step_completed(call_sid, "contact_form")`. This comparison must happen within the handler body, not in the async `_inject_site_context()` task.

In `handle_setup_phone_number`, after successful provisioning, call `broadcast_step_completed(call_sid, "phone_number")`.

---

## Frontend Architecture

### New files

```
src/features/action-steps/
  action-steps-tab.tsx      — The left-edge tab with badge
  action-steps-drawer.tsx   — The slide-out drawer with step list
  action-steps-config.ts    — Static step definitions + completion logic
src/app/api/projects/[projectId]/completion/route.ts — Completion state endpoint
```

### Integration with builder-layout.tsx

The `ActionStepsTab` and `ActionStepsDrawer` are rendered inside `BuilderLayout`, positioned absolutely over the preview panel. They receive:

- `isVoiceCall` and `callActive` — only render during active voice calls
- `completedSteps: Set<string>` — which steps are done
- `onStepSelected: (stepId: string) => void` — callback to broadcast web action
- `drawerOpen: boolean` — controlled by parent (set via Realtime events)
- `onDrawerToggle: (open: boolean) => void` — for manual open/close

### State management

In the builder page (`page.tsx`):

```typescript
const [drawerOpen, setDrawerOpen] = useState(false)
const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
```

### `useCallSession` hook changes

The hook's return type is extended with three new callbacks:

```typescript
interface UseCallSessionReturn {
  isVoiceCall: boolean
  callActive: boolean
  voiceMessages: VoiceMessage[]
  onPreviewUpdate: (() => void) | null
  broadcastWebAction: ((actionType: string, data: Record<string, unknown>) => void) | null
  // New action steps callbacks — set by the consumer via options
  onActionMenuOpen: (() => void) | null
  onActionMenuClose: (() => void) | null
  onStepCompleted: ((stepId: string) => void) | null
}
```

The hook accepts an options object as second parameter (replacing positional callbacks):

```typescript
export function useCallSession(
  callSid: string | null,
  options?: {
    onRefreshPreview?: () => void
    onProjectSwitched?: (projectId: string) => void
    onActionMenuOpen?: () => void
    onActionMenuClose?: () => void
    onStepCompleted?: (stepId: string) => void
  }
): UseCallSessionReturn
```

Inside the hook, it subscribes to the three new broadcast events:
- `open_action_menu` → calls `options.onActionMenuOpen`
- `close_action_menu` → calls `options.onActionMenuClose`
- `step_completed` → calls `options.onStepCompleted` with `payload.stepId`

### Initial completion state

On mount, fetch project state via the new `/api/projects/[projectId]/completion` endpoint to pre-populate `completedSteps`:
- `hasBlocks` → add `build_site` to completed set
- `hasBookingTool` → add `contact_form` to completed set
- `hasPhone` → add `phone_number` to completed set

This handles returning users who already completed some steps in a previous call.

---

## Interaction Sequences

### Happy path: First-time user, post-build

1. User describes website → Timmy builds it
2. `handle_build_website` succeeds → broadcasts `step_completed("build_site")` + `open_action_menu`
3. Frontend: "Build website" checks off, drawer slides open, badge shows "2"
4. Timmy says "Take a look at the menu on your phone — we can add a contact form or get you a phone number"
5. User taps "Add contact form" in drawer
6. Frontend broadcasts `step_selected { stepId: "contact_form", stepLabel: "Add contact form" }`
7. Timmy receives context injection, says "Adding a contact form now!" → calls `edit_website`
8. After success, Timmy calls `complete_action_step("contact_form")`
9. Frontend: "Contact form" checks off, drawer stays open, badge updates to "1"
10. User can now tap "Get phone number" or say what's next
11. When all steps are done (or user is finished), Timmy calls `close_action_menu`

### Voice-only path

Same flow, but user says "let's add a contact form" instead of tapping. Timmy handles it through normal conversation. After success, calls `complete_action_step("contact_form")` to update the visual checklist.

### User opens drawer manually

User taps the left-edge tab at any time during the call. Drawer opens. They can see their progress. If they tap a step, it signals the voice AI. If they tap the dimmed area, it closes.

### Returning user with existing progress

User calls back after previously completing some steps. On mount, the completion endpoint returns `{ hasBlocks: true, hasBookingTool: true, hasPhone: false }`. The frontend pre-populates `completedSteps` with `build_site` and `contact_form`. When the drawer opens, only "Get phone number" shows as available. Badge shows "1".

---

## What This Does NOT Include

- No database tables for step state (ephemeral, in React state + derived from project data)
- No AI-driven step generation (static config only)
- No inline forms in the drawer (V1 is voice-first, tapping signals the AI)
- No step reordering or skipping logic (all available steps are always shown)
- The "AI phone agent" step is visual only — renders as "coming soon", not interactive
