# Action Steps Menu Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a left-edge slide-out drawer to the builder page that shows a visual checklist of post-build steps (contact form, phone number, AI phone), synced bidirectionally with the voice AI via Supabase Realtime.

**Architecture:** Static checklist defined in code. Three new voice AI tools broadcast Realtime events to control the drawer. Frontend tracks completion state in React + fetches initial state from a new API endpoint. The `useCallSession` hook is refactored from positional to options-object API to accommodate new event listeners.

**Tech Stack:** Next.js (React), TypeScript, Tailwind CSS, Supabase (Realtime + Postgres), Python (FastAPI/Pipecat voice server), OpenAI Realtime API

**Spec:** `docs/superpowers/specs/2026-03-12-action-steps-menu-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/features/action-steps/action-steps-config.ts` | **Create** | Static step definitions (`ACTION_STEPS`) and `ActionStep` type |
| `src/features/action-steps/action-steps-tab.tsx` | **Create** | Left-edge tab with badge showing remaining step count |
| `src/features/action-steps/action-steps-drawer.tsx` | **Create** | Slide-out drawer with step list, overlay, header |
| `src/app/api/projects/[projectId]/completion/route.ts` | **Create** | GET endpoint returning `{hasBlocks, hasBookingTool, hasPhone}` |
| `src/hooks/use-call-session.ts` | **Modify** | Refactor to options object, add 3 new event listeners |
| `src/app/build/[projectId]/page.tsx` | **Modify** | Add drawer state, completion state, wire up action steps |
| `src/features/builder/builder-layout.tsx` | **Modify** | Render ActionStepsTab + ActionStepsDrawer in preview panel |
| `voice-server/src/services/realtime.py` | **Modify** | 3 new broadcast helpers + `step_selected` context template |
| `voice-server/src/tools.py` | **Modify** | 3 new tool definitions + handlers, contact form detection in edit handler |
| `voice-server/src/pipeline.py` | **Modify** | Add ACTION STEPS MENU to system prompt, register new tool timeouts |

---

## Chunk 1: Voice Server — Broadcast Helpers & Context Template

### Task 1: Add broadcast helpers to `realtime.py`

**Files:**
- Modify: `voice-server/src/services/realtime.py:95-115` (after `broadcast_project_selected`, before `broadcast_call_ended`)

- [ ] **Step 1: Add three new broadcast functions**

Add these after the `broadcast_project_selected` function (line 94) and before `broadcast_call_ended` (line 97):

```python
async def broadcast_open_action_menu(call_sid: str) -> None:
    """Broadcast open_action_menu event to show the action steps drawer."""
    channel = await _get_channel(call_sid)
    await channel.send_broadcast(
        "open_action_menu",
        {"timestamp": int(time.time() * 1000)},
    )


async def broadcast_close_action_menu(call_sid: str) -> None:
    """Broadcast close_action_menu event to hide the action steps drawer."""
    channel = await _get_channel(call_sid)
    await channel.send_broadcast(
        "close_action_menu",
        {"timestamp": int(time.time() * 1000)},
    )


async def broadcast_step_completed(call_sid: str, step_id: str) -> None:
    """Broadcast step_completed event to check off a step in the drawer."""
    channel = await _get_channel(call_sid)
    await channel.send_broadcast(
        "step_completed",
        {
            "stepId": step_id,
            "timestamp": int(time.time() * 1000),
        },
    )
```

- [ ] **Step 2: Add `step_selected` context template to `inject_web_context_into_llm`**

In the `inject_web_context_into_llm` function, add a new `elif` block after the `"new_project_requested"` case (line 169) and before the `"image_uploaded"` case (line 170):

```python
    elif action_type == "step_selected":
        step_label = payload.get("stepLabel", "a step")
        context_text = (
            f"[WEB PAGE UPDATE: The user tapped '{step_label}' in the action steps menu. "
            f"They want to work on this next. Acknowledge their choice and proceed to help them with it.]"
        )
```

- [ ] **Step 3: Verify the file is syntactically correct**

Run: `cd /Users/tarun/Desktop/Pravik_Builder/voice-server && python -c "from src.services.realtime import broadcast_open_action_menu, broadcast_close_action_menu, broadcast_step_completed; print('OK')"`

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add voice-server/src/services/realtime.py
git commit -m "feat(voice): add action menu broadcast helpers and step_selected context"
```

---

### Task 2: Add tool definitions and handlers to `tools.py`

**Files:**
- Modify: `voice-server/src/tools.py:30-137` (TOOLS list), `voice-server/src/tools.py:1-17` (imports), `voice-server/src/tools.py:352-523` (handlers)

- [ ] **Step 1: Add imports for new broadcast functions**

At `voice-server/src/tools.py` line 13, update the import from `src.services.realtime`:

Change:
```python
from src.services.realtime import broadcast_preview_update, broadcast_project_selected
```

To:
```python
from src.services.realtime import (
    broadcast_preview_update,
    broadcast_project_selected,
    broadcast_open_action_menu,
    broadcast_close_action_menu,
    broadcast_step_completed,
)
```

- [ ] **Step 2: Add 3 new tool definitions to TOOLS list**

After the `change_theme` tool definition (line 136, before the closing `]` of TOOLS on line 137), add:

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

- [ ] **Step 3: Add the valid step IDs constant**

After the `_AUTO_YES_PATTERNS` list (line 27), add:

```python
# Valid step IDs for the action steps menu
_VALID_STEP_IDS = {"build_site", "contact_form", "phone_number"}
```

- [ ] **Step 4: Add 3 new handler functions inside `create_tool_handlers`**

Inside `create_tool_handlers`, after the `handle_change_theme` function (around line 631) and before the returning user tools section comment, add:

```python
    # ------------------------------------------------------------------
    # Action steps menu tools
    # ------------------------------------------------------------------

    async def handle_open_action_menu(params: FunctionCallParams):
        try:
            await broadcast_open_action_menu(ctx.call_sid)
            await params.result_callback({
                "message": "The action steps menu is now visible on the user's phone. "
                "Guide them through the available steps."
            })
        except Exception as err:
            logger.error(f"[{ctx.call_sid}] open_action_menu failed: {err}")
            await params.result_callback({"message": "Menu opened."})

    async def handle_close_action_menu(params: FunctionCallParams):
        try:
            await broadcast_close_action_menu(ctx.call_sid)
            await params.result_callback({
                "message": "The action steps menu has been closed."
            })
        except Exception as err:
            logger.error(f"[{ctx.call_sid}] close_action_menu failed: {err}")
            await params.result_callback({"message": "Menu closed."})

    async def handle_complete_action_step(params: FunctionCallParams):
        step_id = params.arguments.get("step_id", "").strip()
        if step_id not in _VALID_STEP_IDS:
            await params.result_callback({
                "message": f"Invalid step_id '{step_id}'. Valid IDs are: {', '.join(sorted(_VALID_STEP_IDS))}"
            })
            return

        try:
            await broadcast_step_completed(ctx.call_sid, step_id)
            await params.result_callback({
                "message": f"Step '{step_id}' marked as completed in the action steps menu."
            })
        except Exception as err:
            logger.error(f"[{ctx.call_sid}] complete_action_step failed: {err}")
            await params.result_callback({"message": f"Step '{step_id}' completed."})
```

- [ ] **Step 5: Register the 3 new handlers in the handlers dict**

In the `handlers` dict (around line 755), add after `"change_theme"`:

```python
        "open_action_menu": handle_open_action_menu,
        "close_action_menu": handle_close_action_menu,
        "complete_action_step": handle_complete_action_step,
```

- [ ] **Step 6: Add auto-broadcast in `handle_build_website` after successful build**

In `handle_build_website`, after `await params.result_callback(...)` (line 381) and before the auto-name block, add:

```python
            # Broadcast step completion + open menu
            asyncio.create_task(broadcast_step_completed(ctx.call_sid, "build_site"))
            asyncio.create_task(broadcast_open_action_menu(ctx.call_sid))
```

- [ ] **Step 7: Add contact form detection in `handle_edit_website`**

In `handle_edit_website`, the guard at line ~424 already fetches site state. Capture whether a booking tool existed BEFORE the edit, then after a successful edit, check again.

Modify the existing guard try/except block (around lines 423-435) to capture the "before" booking state. The `had_booking_before` variable must be set in **both** the `try` and `except` branches:

```python
        # Guard: no blocks yet — need to build first
        try:
            state = await fetch_site_state(ctx.project_id)
            if not state.get("blocks"):
                await params.result_callback({
                    "message": (
                        "The website hasn't been built yet. Ask the user what kind of "
                        "website they want, then call build_website to create it first."
                    )
                })
                return
            had_booking_before = any(
                t.get("tool_type") == "booking"
                for t in state.get("tools", [])
            )
        except Exception:
            had_booking_before = False  # Non-critical — proceed with edit
```

Then after the successful edit section (after `ctx.last_edit_summary = ...` on line ~509 and before `await params.result_callback`), add:

```python
            # Check if a contact form was just added
            if not had_booking_before:
                try:
                    new_state = await fetch_site_state(ctx.project_id)
                    has_booking_now = any(
                        t.get("tool_type") == "booking"
                        for t in new_state.get("tools", [])
                    )
                    if has_booking_now:
                        await broadcast_step_completed(ctx.call_sid, "contact_form")
                except Exception:
                    pass  # Non-critical
```

- [ ] **Step 8: Add phone number step completion in `handle_setup_phone_number`**

In `handle_setup_phone_number`, after `await params.result_callback(...)` (line ~582), add:

```python
            # Mark phone number step as completed
            asyncio.create_task(broadcast_step_completed(ctx.call_sid, "phone_number"))
```

- [ ] **Step 9: Verify the file is syntactically correct**

Run: `cd /Users/tarun/Desktop/Pravik_Builder/voice-server && python -c "from src.tools import TOOLS, create_tool_handlers; print(f'{len(TOOLS)} tools defined'); print('OK')"`

Expected: `8 tools defined` (5 original + 3 new) followed by `OK`

- [ ] **Step 10: Commit**

```bash
git add voice-server/src/tools.py
git commit -m "feat(voice): add action menu tools, step completion broadcasts in build/edit/phone handlers"
```

---

### Task 3: Update system prompt and register new tool timeouts

**Files:**
- Modify: `voice-server/src/pipeline.py:50-117` (`_COMMON_RULES`), `voice-server/src/pipeline.py:283-292` (`TOOL_TIMEOUTS`)

- [ ] **Step 1: Add ACTION STEPS MENU section to `_COMMON_RULES`**

In `voice-server/src/pipeline.py`, in the `_COMMON_RULES` string, add after the `Web page sync:` section (after line 116, before the closing `"""`):

```python

ACTION STEPS MENU:
- After the website is built successfully, present the next steps to the user.
- Call open_action_menu to show the checklist on their phone.
- Say something like: "Great! Now that your site is ready, there are a couple things we can set up — like a contact form or a phone number. Take a look at the menu on your phone, or just tell me which one you'd like to do."
- When a step is completed, call complete_action_step with the step ID.
- When all available steps are done, call close_action_menu, celebrate, and wrap up.
- If the user wants to close the menu or seems done browsing steps, call close_action_menu.
- Do NOT mention "coming soon" items unless the user asks.
```

- [ ] **Step 2: Add new tool timeouts**

In the `TOOL_TIMEOUTS` dict (line ~283), add after `"list_user_projects": 15`:

```python
        "open_action_menu": 10,
        "close_action_menu": 10,
        "complete_action_step": 10,
```

- [ ] **Step 3: Verify the file is syntactically correct**

Run: `cd /Users/tarun/Desktop/Pravik_Builder/voice-server && python -c "from src.pipeline import build_system_instructions; s = build_system_instructions(True, 0, ''); print('ACTION STEPS MENU' in s); print('OK')"`

Expected: `True` followed by `OK`

- [ ] **Step 4: Commit**

```bash
git add voice-server/src/pipeline.py
git commit -m "feat(voice): add ACTION STEPS MENU to system prompt and tool timeouts"
```

---

## Chunk 2: Frontend — Config, API Endpoint, Hook Refactor

### Task 4: Create static step definitions config

**Files:**
- Create: `src/features/action-steps/action-steps-config.ts`

- [ ] **Step 1: Create the config file**

```typescript
export interface ActionStep {
  id: string
  label: string
  subtitle: string
  comingSoon: boolean
}

export const ACTION_STEPS: ActionStep[] = [
  { id: 'build_site', label: 'Build website', subtitle: 'Create your site', comingSoon: false },
  { id: 'contact_form', label: 'Add contact form', subtitle: 'Collect leads from visitors', comingSoon: false },
  { id: 'phone_number', label: 'Get phone number', subtitle: 'Local number for your business', comingSoon: false },
  { id: 'ai_phone', label: 'AI phone agent', subtitle: 'Answer calls automatically', comingSoon: true },
]

/** Step IDs that are actionable (not coming soon) */
export const ACTIONABLE_STEP_IDS = ACTION_STEPS
  .filter((s) => !s.comingSoon)
  .map((s) => s.id)

/** Count of remaining actionable steps */
export function getRemainingCount(completedSteps: Set<string>): number {
  return ACTIONABLE_STEP_IDS.filter((id) => !completedSteps.has(id)).length
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/action-steps/action-steps-config.ts
git commit -m "feat: add static action steps config with types and helpers"
```

---

### Task 5: Create completion state API endpoint

**Files:**
- Create: `src/app/api/projects/[projectId]/completion/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/services/supabase/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const supabase = getSupabaseClient()

    // Check if project has any blocks
    const { count: blocksCount } = await supabase
      .from('blocks')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)

    // Check if project has a booking tool
    const { count: bookingCount } = await supabase
      .from('tools')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('tool_type', 'booking')

    // Check if project has a provisioned phone
    const { data: project } = await supabase
      .from('projects')
      .select('provisioned_phone')
      .eq('id', projectId)
      .single()

    return NextResponse.json({
      hasBlocks: (blocksCount ?? 0) > 0,
      hasBookingTool: (bookingCount ?? 0) > 0,
      hasPhone: !!project?.provisioned_phone,
    })
  } catch (error) {
    console.error('Completion check error:', error)
    return NextResponse.json(
      { hasBlocks: false, hasBookingTool: false, hasPhone: false },
      { status: 200 } // Graceful degradation — return empty state, not error
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/projects/\\[projectId\\]/completion/route.ts
git commit -m "feat: add /api/projects/[projectId]/completion endpoint"
```

---

### Task 6: Refactor `useCallSession` hook to options object + add new events

**Files:**
- Modify: `src/hooks/use-call-session.ts`

This is a **breaking change** to the hook API. The builder page.tsx call site must be updated in Task 8.

- [ ] **Step 1: Rewrite the hook**

Replace the entire file content with:

```typescript
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getSupabaseBrowser } from '@/services/supabase/browser'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface VoiceMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface UseCallSessionReturn {
  isVoiceCall: boolean
  callActive: boolean
  voiceMessages: VoiceMessage[]
  onPreviewUpdate: (() => void) | null
  broadcastWebAction: ((actionType: string, data: Record<string, unknown>) => void) | null
}

export interface UseCallSessionOptions {
  onRefreshPreview?: () => void
  onProjectSwitched?: (projectId: string) => void
  onActionMenuOpen?: () => void
  onActionMenuClose?: () => void
  onStepCompleted?: (stepId: string) => void
}

export function useCallSession(
  callSid: string | null,
  options?: UseCallSessionOptions,
): UseCallSessionReturn {
  const [callActive, setCallActive] = useState(!!callSid)
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Store options in a ref so the channel subscription doesn't re-run when callbacks change
  const optionsRef = useRef(options)
  optionsRef.current = options

  const handlePreviewUpdate = useCallback(() => {
    setTimeout(() => {
      optionsRef.current?.onRefreshPreview?.()
    }, 500)
  }, [])

  useEffect(() => {
    if (!callSid) return

    const supabase = getSupabaseBrowser()
    const channel = supabase.channel(`call:${callSid}`)

    channel
      .on('broadcast', { event: 'preview_updated' }, (payload) => {
        console.log('Preview updated:', payload)
        handlePreviewUpdate()
      })
      .on('broadcast', { event: 'voice_message' }, (payload) => {
        const msg = payload.payload as VoiceMessage
        setVoiceMessages((prev) => [...prev, msg])
      })
      .on('broadcast', { event: 'project_selected' }, (payload) => {
        const projectId = payload.payload?.projectId
        if (projectId) {
          console.log(`Project switched to: ${projectId}`)
          optionsRef.current?.onProjectSwitched?.(projectId)
        }
      })
      .on('broadcast', { event: 'call_ended' }, () => {
        setCallActive(false)
      })
      // Action steps menu events
      .on('broadcast', { event: 'open_action_menu' }, () => {
        console.log('Action menu: open')
        optionsRef.current?.onActionMenuOpen?.()
      })
      .on('broadcast', { event: 'close_action_menu' }, () => {
        console.log('Action menu: close')
        optionsRef.current?.onActionMenuClose?.()
      })
      .on('broadcast', { event: 'step_completed' }, (payload) => {
        const stepId = payload.payload?.stepId
        if (stepId) {
          console.log(`Step completed: ${stepId}`)
          optionsRef.current?.onStepCompleted?.(stepId)
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to call:${callSid} channel`)
        }
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [callSid, handlePreviewUpdate])

  const broadcastWebAction = useCallback(
    (actionType: string, data: Record<string, unknown>) => {
      if (!channelRef.current) return
      channelRef.current.send({
        type: 'broadcast',
        event: 'web_action',
        payload: { actionType, ...data },
      })
    },
    []
  )

  return {
    isVoiceCall: !!callSid,
    callActive,
    voiceMessages,
    onPreviewUpdate: callSid ? handlePreviewUpdate : null,
    broadcastWebAction: callSid ? broadcastWebAction : null,
  }
}
```

Key changes from previous version:
- Second parameter changed from positional `onRefreshPreview?, onProjectSwitched?` to `UseCallSessionOptions` object
- Callbacks stored in `optionsRef` so channel subscription doesn't re-run on callback changes
- Three new `.on('broadcast', ...)` listeners for `open_action_menu`, `close_action_menu`, `step_completed`
- Exported `UseCallSessionOptions` and `UseCallSessionReturn` interfaces

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-call-session.ts
git commit -m "refactor: useCallSession to options object, add action menu event listeners"
```

---

## Chunk 3: Frontend — UI Components

### Task 7: Create ActionStepsTab component

**Files:**
- Create: `src/features/action-steps/action-steps-tab.tsx`

- [ ] **Step 1: Create the tab component**

```tsx
'use client'

import { getRemainingCount } from './action-steps-config'

interface ActionStepsTabProps {
  completedSteps: Set<string>
  onClick: () => void
}

export function ActionStepsTab({ completedSteps, onClick }: ActionStepsTabProps) {
  const remaining = getRemainingCount(completedSteps)

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center"
      style={{
        width: 18,
        height: 52,
        background: '#1e1e2e',
        border: '1px solid #333',
        borderLeft: 'none',
        borderRadius: '0 8px 8px 0',
      }}
      aria-label={`Action steps menu — ${remaining} remaining`}
    >
      <svg
        width="8"
        height="12"
        viewBox="0 0 8 12"
        fill="none"
        className="text-gray-400"
      >
        <path
          d="M1.5 1L6.5 6L1.5 11"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {remaining > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 flex items-center justify-center text-white font-bold"
          style={{
            width: 16,
            height: 16,
            fontSize: 9,
            borderRadius: '50%',
            background: '#3b82f6',
          }}
        >
          {remaining}
        </span>
      )}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/action-steps/action-steps-tab.tsx
git commit -m "feat: add ActionStepsTab component with badge"
```

---

### Task 8: Create ActionStepsDrawer component

**Files:**
- Create: `src/features/action-steps/action-steps-drawer.tsx`

- [ ] **Step 1: Create the drawer component**

```tsx
'use client'

import { ACTION_STEPS, type ActionStep } from './action-steps-config'

interface ActionStepsDrawerProps {
  open: boolean
  completedSteps: Set<string>
  onStepSelected: (stepId: string, stepLabel: string) => void
  onClose: () => void
}

export function ActionStepsDrawer({
  open,
  completedSteps,
  onStepSelected,
  onClose,
}: ActionStepsDrawerProps) {
  return (
    <>
      {/* Dimmed overlay */}
      {open && (
        <div
          className="absolute inset-0 z-20"
          style={{ background: 'rgba(0, 0, 0, 0.5)' }}
          onClick={onClose}
        />
      )}

      {/* Drawer panel */}
      <div
        className="absolute top-0 left-0 h-full z-30 flex flex-col transition-transform duration-300 ease-out"
        style={{
          width: '70%',
          background: '#141420',
          borderRight: '1px solid #2a2a3a',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        <div className="px-4 pt-5 pb-3">
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.5px',
              color: '#666',
              textTransform: 'uppercase' as const,
            }}
          >
            Next Steps
          </span>
        </div>

        <div className="flex flex-col gap-1 px-3 pb-4">
          {ACTION_STEPS.map((step) => (
            <StepItem
              key={step.id}
              step={step}
              completed={completedSteps.has(step.id)}
              onSelect={() => onStepSelected(step.id, step.label)}
            />
          ))}
        </div>
      </div>
    </>
  )
}

function StepItem({
  step,
  completed,
  onSelect,
}: {
  step: ActionStep
  completed: boolean
  onSelect: () => void
}) {
  if (step.comingSoon) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ opacity: 0.35 }}>
        <div
          className="shrink-0"
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: '2px dashed #333',
          }}
        />
        <div>
          <div className="text-sm text-gray-500">{step.label}</div>
          <div className="text-xs text-gray-600">Coming soon</div>
        </div>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ opacity: 0.5 }}>
        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#22c55e',
          }}
        >
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path
              d="M1 4L3.5 6.5L9 1"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <div className="text-sm text-gray-400 line-through">{step.label}</div>
          <div className="text-xs text-gray-500">{step.subtitle}</div>
        </div>
      </div>
    )
  }

  // Active/available
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-white/5 active:bg-white/10 w-full"
    >
      <div
        className="shrink-0"
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: '2px solid #444',
        }}
      />
      <div>
        <div className="text-sm text-white">{step.label}</div>
        <div className="text-xs text-gray-500">{step.subtitle}</div>
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/action-steps/action-steps-drawer.tsx
git commit -m "feat: add ActionStepsDrawer component with step states"
```

---

## Chunk 4: Frontend — Integration (Builder Layout, Page, Wiring)

### Task 9: Update `BuilderLayout` to render action steps components

**Files:**
- Modify: `src/features/builder/builder-layout.tsx`

- [ ] **Step 1: Add imports and new props**

Add imports at the top:

```typescript
import { ActionStepsTab } from '@/features/action-steps/action-steps-tab'
import { ActionStepsDrawer } from '@/features/action-steps/action-steps-drawer'
```

Extend the `BuilderLayoutProps` interface with new optional props:

```typescript
interface BuilderLayoutProps {
  preview: ReactNode
  chat: ReactNode | ((collapsed: boolean) => ReactNode)
  shareUrl?: string | null
  isVoiceCall?: boolean
  callActive?: boolean
  hasMessages?: boolean
  // Action steps menu
  drawerOpen?: boolean
  completedSteps?: Set<string>
  onStepSelected?: (stepId: string, stepLabel: string) => void
  onDrawerToggle?: (open: boolean) => void
}
```

- [ ] **Step 2: Destructure new props and render components in the preview panel**

Update the function signature to destructure the new props:

```typescript
export function BuilderLayout({
  preview,
  chat,
  shareUrl,
  isVoiceCall,
  callActive,
  hasMessages,
  drawerOpen,
  completedSteps,
  onStepSelected,
  onDrawerToggle,
}: BuilderLayoutProps) {
```

Inside the preview panel `<div>` (the one with `className="w-full border-b..."` and `{preview}`), after the share link `<div>` and before the closing `</div>` of the preview container, add:

```tsx
        {/* Action steps menu — only during active voice calls */}
        {isVoiceCall && callActive && completedSteps && onStepSelected && onDrawerToggle && (
          <>
            {!drawerOpen && (
              <ActionStepsTab
                completedSteps={completedSteps}
                onClick={() => onDrawerToggle(true)}
              />
            )}
            <ActionStepsDrawer
              open={!!drawerOpen}
              completedSteps={completedSteps}
              onStepSelected={onStepSelected}
              onClose={() => onDrawerToggle(false)}
            />
          </>
        )}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/builder/builder-layout.tsx
git commit -m "feat: render ActionStepsTab and ActionStepsDrawer in BuilderLayout"
```

---

### Task 10: Update builder page to wire everything together

**Files:**
- Modify: `src/app/build/[projectId]/page.tsx`

This is the main integration task — add drawer state, completion fetching, hook refactoring, and pass everything to layout.

- [ ] **Step 1: Add completion state and drawer state**

After the existing `useState` declarations (around line 21), add:

```typescript
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
```

- [ ] **Step 2: Refactor useCallSession to options object**

Replace the current `useCallSession` call (line 44):

```typescript
  const { isVoiceCall, callActive, voiceMessages, broadcastWebAction } = useCallSession(
    callSid,
    refreshPreview,
    handleProjectSwitched
  )
```

With:

```typescript
  const { isVoiceCall, callActive, voiceMessages, broadcastWebAction } = useCallSession(
    callSid,
    {
      onRefreshPreview: refreshPreview,
      onProjectSwitched: handleProjectSwitched,
      onActionMenuOpen: () => setDrawerOpen(true),
      onActionMenuClose: () => setDrawerOpen(false),
      onStepCompleted: (stepId: string) => {
        setCompletedSteps((prev) => new Set(prev).add(stepId))
      },
    }
  )
```

- [ ] **Step 3: Add completion state fetch on mount**

After the existing `useEffect` that fetches projects (around line 78-94), add a new `useEffect` for completion:

```typescript
  // Fetch initial step completion state
  useEffect(() => {
    if (!projectId) return

    fetch(`/api/projects/${projectId}/completion`)
      .then((res) => res.json())
      .then((data) => {
        const completed = new Set<string>()
        if (data.hasBlocks) completed.add('build_site')
        if (data.hasBookingTool) completed.add('contact_form')
        if (data.hasPhone) completed.add('phone_number')
        setCompletedSteps(completed)
      })
      .catch(() => {
        // Graceful degradation — voice AI will re-broadcast completions
      })
  }, [projectId])
```

- [ ] **Step 4: Add step selection handler**

After the `useCallSession` call (from Step 2 above), add the step selection handler. This must come AFTER `useCallSession` because it depends on `broadcastWebAction`:

```typescript
  const handleStepSelected = useCallback(
    (stepId: string, stepLabel: string) => {
      if (broadcastWebAction) {
        broadcastWebAction('step_selected', { stepId, stepLabel })
      }
      setDrawerOpen(false)
    },
    [broadcastWebAction]
  )
```

- [ ] **Step 5: Pass new props to BuilderLayout**

Update the `<BuilderLayout>` JSX (around line 234) to pass the new props:

```tsx
    <BuilderLayout
      preview={<PreviewPanel url={previewUrl} loading={loading} action={action} />}
      chat={(collapsed) => <ChatPanel messages={messages} onSend={handleSend} loading={loading} collapsed={collapsed} />}
      shareUrl={shareUrl}
      isVoiceCall={isVoiceCall}
      callActive={callActive}
      hasMessages={messages.length > 0}
      drawerOpen={drawerOpen}
      completedSteps={completedSteps}
      onStepSelected={handleStepSelected}
      onDrawerToggle={setDrawerOpen}
    />
```

- [ ] **Step 6: Commit**

```bash
git add src/app/build/\\[projectId\\]/page.tsx
git commit -m "feat: wire action steps state, completion fetch, and drawer to builder page"
```

---

### Task 11: Verify the build compiles and deploy

**Files:** None (verification only)

- [ ] **Step 1: Verify Next.js build**

Run: `cd /Users/tarun/Desktop/Pravik_Builder && npx next build 2>&1 | tail -20`

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Verify voice server imports**

Run: `cd /Users/tarun/Desktop/Pravik_Builder/voice-server && python -c "from src.pipeline import create_pipeline; from src.tools import TOOLS; print(f'{len(TOOLS)} tools'); print('OK')"`

Expected: `8 tools` and `OK`

- [ ] **Step 3: Deploy voice server to Railway**

Run: `cd /Users/tarun/Desktop/Pravik_Builder/voice-server && export PATH="/Users/tarun/.local/bin:$PATH" && railway up --detach`

Expected: Deployment starts successfully.

- [ ] **Step 4: Deploy Next.js to Vercel**

Run: `cd /Users/tarun/Desktop/Pravik_Builder && export PATH="/Users/tarun/.nvm/versions/node/v24.2.0/bin:$PATH" && npx vercel deploy --prod --yes`

Expected: Deployment completes with production URL.

- [ ] **Step 5: Commit all remaining changes**

```bash
git add -A && git status
```

If there are any uncommitted files, commit them:

```bash
git commit -m "chore: final cleanup for action steps menu feature"
```

---

## Verification Checklist

After deployment, verify the feature end-to-end:

1. **Completion endpoint**: `curl https://<vercel-url>/api/projects/<projectId>/completion` should return `{"hasBlocks":...,"hasBookingTool":...,"hasPhone":...}`
2. **Tab visibility**: During an active voice call, the left-edge tab should appear on the builder page
3. **Drawer opens**: Tapping the tab opens the drawer with the step list
4. **Drawer closes**: Tapping the dimmed area closes the drawer
5. **Badge count**: Badge shows count of remaining actionable (non-coming-soon) steps
6. **Step selection**: Tapping an active step broadcasts to voice AI and closes drawer
7. **Auto-open after build**: After `build_website` succeeds, `build_site` checks off and drawer opens
8. **Contact form detection**: After adding a booking form via `edit_website`, `contact_form` checks off
9. **Phone provisioning**: After `setup_phone_number`, `phone_number` checks off
10. **Voice AI tools**: AI can call `open_action_menu`, `close_action_menu`, `complete_action_step`
11. **Returning user**: Completion state is pre-populated from the API on page load
