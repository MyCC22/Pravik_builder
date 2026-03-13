# Issue 002: Shared Event Contract

**Criticality**: Critical
**Impact**: Silent bugs as events grow
**Effort**: Small (half day)

---

## Problem

The voice server and frontend communicate via Supabase Realtime broadcasts, but there is **no shared schema** defining what events exist or what their payloads look like. Each side independently constructs/parses payloads, so any mismatch is a silent bug.

### Current State

**Voice Server broadcasts** (realtime.py):
```python
# Each function manually constructs payload
await channel.send_broadcast("preview_updated", {
    "action": action, "message": message, "projectId": project_id, "timestamp": ...
})
await channel.send_broadcast("step_completed", {
    "stepId": step_id, "timestamp": ...
})
```

**Frontend listens** (use-call-session.ts):
```typescript
channel.on('broadcast', { event: 'preview_updated' }, (msg) => {
    handlePreviewUpdate()  // Ignores payload entirely
})
channel.on('broadcast', { event: 'step_completed' }, (msg) => {
    onStepCompleted(msg.payload.stepId)  // Trusts field exists
})
```

### Specific Problems

1. **No type safety**: Frontend accesses `msg.payload.stepId` with no guarantee the field exists
2. **Payload inconsistency**: Some events use `projectId` (camelCase), `timestamp` is sometimes ISO string, sometimes epoch ms
3. **No exhaustive event list**: New events added to one side can be forgotten on the other
4. **No payload validation**: If voice server sends `step_id` (snake_case) instead of `stepId`, frontend silently fails
5. **Event names are magic strings**: `"preview_updated"`, `"step_completed"` hardcoded in both codebases
6. **Context injection uses unstructured text**: `[WEB PAGE UPDATE: ...]` messages (realtime.py:223-227) are free-form strings parsed by AI

### Files Affected

| File | Role |
|------|------|
| `voice-server/src/services/realtime.py:49-133` | Broadcasts events |
| `voice-server/src/services/realtime.py:147-238` | Receives web actions + injects context |
| `src/hooks/use-call-session.ts:47-100` | Listens for events |
| `src/hooks/use-call-session.ts:102-112` | Sends web actions |
| `src/app/build/[projectId]/page.tsx` | Handles event callbacks |

---

## Proposed Solution: Shared Event Schema

### 1. Create Event Schema File (shared source of truth)

```typescript
// src/lib/events/call-events.ts — THE source of truth
// Voice server will have a mirrored Python version

export const CALL_EVENTS = {
  // Voice Server → Frontend
  PREVIEW_UPDATED: 'preview_updated',
  VOICE_MESSAGE: 'voice_message',
  PROJECT_SELECTED: 'project_selected',
  OPEN_ACTION_MENU: 'open_action_menu',
  CLOSE_ACTION_MENU: 'close_action_menu',
  STEP_COMPLETED: 'step_completed',
  CALL_ENDED: 'call_ended',

  // Frontend → Voice Server
  PAGE_OPENED: 'page_opened',
  WEB_ACTION: 'web_action',
} as const

export type CallEventName = typeof CALL_EVENTS[keyof typeof CALL_EVENTS]

// ── Payload Types ──

export interface PreviewUpdatedPayload {
  action: 'generated' | 'edited' | 'theme_changed'
  message: string
  projectId: string
  timestamp: number  // epoch ms, always
}

export interface VoiceMessagePayload {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface ProjectSelectedPayload {
  projectId: string
  timestamp: number
}

export interface StepCompletedPayload {
  stepId: string
  timestamp: number
}

export interface CallEndedPayload {
  timestamp: number
}

// Menu events have no payload (empty object)
export interface EmptyPayload {
  timestamp: number
}

// Frontend → Voice Server
export type WebActionType =
  | 'page_opened'
  | 'text_message_sent'
  | 'image_uploaded'
  | 'project_selected_from_web'
  | 'new_project_requested'
  | 'step_selected'

export interface WebActionPayload {
  actionType: WebActionType
  data: Record<string, unknown>
  timestamp: number
}

// Type map for event → payload
export interface CallEventPayloads {
  [CALL_EVENTS.PREVIEW_UPDATED]: PreviewUpdatedPayload
  [CALL_EVENTS.VOICE_MESSAGE]: VoiceMessagePayload
  [CALL_EVENTS.PROJECT_SELECTED]: ProjectSelectedPayload
  [CALL_EVENTS.STEP_COMPLETED]: StepCompletedPayload
  [CALL_EVENTS.CALL_ENDED]: CallEndedPayload
  [CALL_EVENTS.OPEN_ACTION_MENU]: EmptyPayload
  [CALL_EVENTS.CLOSE_ACTION_MENU]: EmptyPayload
}
```

### 2. Python Mirror

```python
# voice-server/src/events.py — mirrors TypeScript types
from enum import StrEnum
from dataclasses import dataclass
from time import time

class CallEvent(StrEnum):
    PREVIEW_UPDATED = "preview_updated"
    VOICE_MESSAGE = "voice_message"
    PROJECT_SELECTED = "project_selected"
    OPEN_ACTION_MENU = "open_action_menu"
    CLOSE_ACTION_MENU = "close_action_menu"
    STEP_COMPLETED = "step_completed"
    CALL_ENDED = "call_ended"
    PAGE_OPENED = "page_opened"
    WEB_ACTION = "web_action"

class WebActionType(StrEnum):
    PAGE_OPENED = "page_opened"
    TEXT_MESSAGE_SENT = "text_message_sent"
    IMAGE_UPLOADED = "image_uploaded"
    PROJECT_SELECTED_FROM_WEB = "project_selected_from_web"
    NEW_PROJECT_REQUESTED = "new_project_requested"
    STEP_SELECTED = "step_selected"

def make_payload(**kwargs) -> dict:
    """Build a payload dict with timestamp always included."""
    return {**kwargs, "timestamp": int(time() * 1000)}
```

### 3. Update realtime.py to Use Enums

```python
from src.events import CallEvent, make_payload

async def broadcast_step_completed(call_sid: str, step_id: str):
    channel = await _get_channel(call_sid)
    await channel.send_broadcast(
        CallEvent.STEP_COMPLETED,
        make_payload(stepId=step_id)
    )
```

### 4. Update Frontend to Use Types

```typescript
import { CALL_EVENTS, type StepCompletedPayload } from '@/lib/events/call-events'

channel.on('broadcast', { event: CALL_EVENTS.STEP_COMPLETED }, (msg) => {
    const payload = msg.payload as StepCompletedPayload
    onStepCompleted(payload.stepId)  // Now type-safe
})
```

---

## Implementation Steps

1. Create `src/lib/events/call-events.ts` with all event names, payload types, and type map
2. Create `voice-server/src/events.py` with mirrored enum and `make_payload()` helper
3. Update `voice-server/src/services/realtime.py` to use `CallEvent` enum and `make_payload()`
4. Update `src/hooks/use-call-session.ts` to use `CALL_EVENTS` constants and payload types
5. Update `src/app/build/[projectId]/page.tsx` to type event callbacks
6. Add a CI check or test that verifies Python events match TypeScript events

---

## Test Cases

### TypeScript Tests: `tests/call-events-contract.test.ts`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_all_event_names_are_strings` | Every value in `CALL_EVENTS` is a non-empty string | All values pass `typeof x === 'string'` |
| 2 | `test_no_duplicate_event_names` | Event name values are unique | `new Set(values).size === values.length` |
| 3 | `test_payload_types_have_timestamp` | Every payload interface includes `timestamp: number` | TypeScript compile-time check + runtime validation |
| 4 | `test_step_completed_payload_has_stepId` | `StepCompletedPayload` requires `stepId` | Type assertion succeeds |
| 5 | `test_preview_updated_payload_has_all_fields` | `PreviewUpdatedPayload` has `action`, `message`, `projectId`, `timestamp` | All fields present |
| 6 | `test_web_action_types_exhaustive` | `WebActionType` covers all known action types | 6 action types defined |

### Python Tests: `voice-server/tests/test_events_contract.py`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_call_event_enum_values_match_ts` | Python enum values match expected event strings | All 9 events match |
| 2 | `test_web_action_type_enum_values` | WebActionType has all 6 action types | All present |
| 3 | `test_make_payload_includes_timestamp` | `make_payload(stepId="x")` has `timestamp` key | `timestamp` is int, > 0 |
| 4 | `test_make_payload_preserves_kwargs` | `make_payload(stepId="x", projectId="y")` | Both keys present |
| 5 | `test_no_duplicate_event_values` | Enum values are unique | `len(set(CallEvent)) == len(CallEvent)` |

### Cross-Language Sync Test: `voice-server/tests/test_event_sync.py`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_python_events_match_typescript` | Parse TS file, extract event values, compare to Python enum | Sets are identical |
| 2 | `test_python_web_actions_match_typescript` | Parse TS WebActionType, compare to Python enum | Sets are identical |

---

## Acceptance Criteria

- [ ] All event names defined in one place per language (no magic strings)
- [ ] Frontend payload access is type-safe (TypeScript compiler catches mismatches)
- [ ] Voice server uses enum values (not raw strings) for event names
- [ ] All payloads include `timestamp` via `make_payload()` helper
- [ ] Cross-language sync test catches drift between Python and TypeScript event definitions
- [ ] All existing tests continue to pass
