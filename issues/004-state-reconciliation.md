# Issue 004: State Reconciliation

**Criticality**: High
**Impact**: State drift during calls
**Effort**: Small (half day)

---

## Problem

State lives in **three places** that can drift apart during a call:

1. **Voice Server** (`ToolContext` dataclass) — mutable, in-memory
2. **Frontend** (React state) — `completedSteps`, `project`, `messages`
3. **Database** (Supabase) — `call_sessions`, `projects` tables

When state changes in one place, it may not propagate to others. Examples:

### Drift Scenarios

| Scenario | What Happens | User Impact |
|----------|-------------|-------------|
| Phone provisioned but broadcast missed | Voice server has phone, frontend doesn't show step complete | User sees stale action steps |
| Page reload during call | Frontend state resets, voice server still has context | Completed steps disappear, must re-fetch |
| Project switched mid-call | `ToolContext.project_id` updated, but if broadcast fails, frontend shows old project | User sees wrong project preview |
| Build completes but polling misses it | Database has blocks, frontend shows stale preview | User thinks build failed |
| Image uploaded, tool call fails | `pending_image_urls` cleared, images lost | User's images never used |

### Current State Flow

```
User speaks → Voice Server (ToolContext) → Tool Handler
  → Supabase DB update
  → Broadcast event
  → Frontend receives (or misses) → React state update
```

**No reconciliation path exists.** If step 3 or 4 fails, state is permanently out of sync until page reload.

### Files Affected

| File | Role | State |
|------|------|-------|
| `voice-server/src/tools.py:311-330` | `ToolContext` dataclass | `project_id`, `link_sent`, `page_opened`, `pending_image_urls` |
| `src/app/build/[projectId]/page.tsx:12-57` | React component state | `project`, `completedSteps`, `previewUrl` |
| `src/hooks/use-call-session.ts:29-121` | Realtime subscription | Event callbacks |
| `src/app/api/projects/[projectId]/completion/route.ts` | Completion endpoint | `hasBlocks`, `hasPhone`, etc. |

---

## Proposed Solution: State Reconciliation Endpoint + Heartbeat

### 1. Server-Side State Endpoint

Create an endpoint that returns the **current ground truth** from the database:

```typescript
// src/app/api/voice/state/[callSid]/route.ts
export async function GET(req: NextRequest, { params }) {
  const { callSid } = await params

  const { data: session } = await supabase
    .from('call_sessions')
    .select('project_id, state, page_opened')
    .eq('call_sid', callSid)
    .single()

  if (!session) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Get project completion state
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, provisioned_phone, forwarding_phone')
    .eq('id', session.project_id)
    .single()

  const { data: blocks } = await supabase
    .from('blocks')
    .select('id')
    .eq('project_id', session.project_id)
    .limit(1)

  const { data: tools } = await supabase
    .from('tools')
    .select('type')
    .eq('project_id', session.project_id)

  const completedSteps: string[] = []
  if (blocks && blocks.length > 0) completedSteps.push('build_site')
  if (tools?.some(t => t.type === 'booking')) completedSteps.push('contact_form')
  if (project?.provisioned_phone) completedSteps.push('phone_number')
  if (project?.forwarding_phone) completedSteps.push('call_forwarding')

  return NextResponse.json({
    projectId: session.project_id,
    state: session.state,
    completedSteps,
    projectName: project?.name,
    timestamp: Date.now(),
  })
}
```

### 2. Frontend Reconciliation Hook

```typescript
// src/hooks/use-state-reconciliation.ts
export function useStateReconciliation(
  callSid: string | null,
  callActive: boolean,
  onReconcile: (state: ReconciliationState) => void
) {
  useEffect(() => {
    if (!callSid || !callActive) return

    // Reconcile on mount (handles page reload)
    reconcile()

    // Reconcile periodically (handles missed broadcasts)
    const interval = setInterval(reconcile, 10_000)  // Every 10 seconds

    return () => clearInterval(interval)

    async function reconcile() {
      try {
        const res = await fetch(`/api/voice/state/${callSid}`)
        if (!res.ok) return
        const state = await res.json()
        onReconcile(state)
      } catch {
        // Silent fail — next interval will retry
      }
    }
  }, [callSid, callActive])
}
```

### 3. Frontend Integration

```typescript
// In page.tsx
useStateReconciliation(callSid, callActive, (state) => {
  // Reconcile completed steps
  setCompletedSteps(new Set(state.completedSteps))

  // Reconcile project if switched
  if (state.projectId !== projectId) {
    router.replace(`/build/${state.projectId}?session=${callSid}`)
  }
})
```

### 4. Replace Polling with Reconciliation

The current 3-second preview polling (page.tsx:146-165) can be **merged** into the reconciliation hook, eliminating the separate polling loop:

```typescript
// Reconciliation response includes hasBlocks
// If hasBlocks changed from false → true, refresh preview
if (state.completedSteps.includes('build_site') && !completedSteps.has('build_site')) {
  refreshPreview()
}
```

---

## Implementation Steps

1. Create `src/app/api/voice/state/[callSid]/route.ts` — reconciliation endpoint
2. Create `src/hooks/use-state-reconciliation.ts` — reconciliation hook
3. Integrate hook in `src/app/build/[projectId]/page.tsx`
4. Remove or reduce 3-second preview polling (merge into reconciliation)
5. Add reconciliation on `visibilitychange` event (tab becomes visible)
6. Add reconciliation after each broadcast receive (belt-and-suspenders)

---

## Test Cases

### API Tests: `tests/state-reconciliation-route.test.ts`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_returns_completed_steps_with_blocks` | Project has blocks | `completedSteps` includes `"build_site"` |
| 2 | `test_returns_completed_steps_with_phone` | Project has provisioned_phone | `completedSteps` includes `"phone_number"` |
| 3 | `test_returns_completed_steps_with_forwarding` | Project has forwarding_phone | `completedSteps` includes `"call_forwarding"` |
| 4 | `test_returns_completed_steps_with_booking_tool` | Project has booking tool | `completedSteps` includes `"contact_form"` |
| 5 | `test_returns_empty_steps_for_new_project` | Fresh project, no content | `completedSteps` is empty array |
| 6 | `test_returns_404_for_unknown_call_sid` | Non-existent callSid | Status 404 |
| 7 | `test_returns_current_project_id` | Session has project_id | Response includes correct `projectId` |
| 8 | `test_returns_project_name` | Project has name | Response includes `projectName` |

### Hook Tests: `tests/use-state-reconciliation.test.ts`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_reconciles_on_mount` | Hook mounts with callSid | Fetch called immediately |
| 2 | `test_reconciles_periodically` | After 10s interval | Fetch called again |
| 3 | `test_no_fetch_without_call_sid` | `callSid` is null | No fetch calls made |
| 4 | `test_no_fetch_when_call_inactive` | `callActive` is false | No fetch calls made |
| 5 | `test_calls_onReconcile_with_state` | Successful fetch | `onReconcile` called with parsed state |
| 6 | `test_silent_fail_on_network_error` | Fetch throws | No error thrown, no `onReconcile` call |

---

## Acceptance Criteria

- [ ] Frontend always reflects database truth within 10 seconds
- [ ] Page reload during active call restores all completed steps
- [ ] Project switch mid-call is reflected even if broadcast was missed
- [ ] 3-second preview polling is removed or merged into reconciliation
- [ ] No user-visible state inconsistency after missed broadcasts
- [ ] All existing tests continue to pass
