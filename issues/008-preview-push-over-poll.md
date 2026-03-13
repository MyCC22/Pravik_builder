# Issue 008: Preview Push Over Poll

**Criticality**: Medium
**Impact**: Server load at scale
**Effort**: Small (remove after #4)

---

## Problem

The frontend polls the preview endpoint every 3 seconds during active voice calls to detect when builds/edits complete. This is a band-aid over unreliable Realtime broadcast delivery.

### Current Polling Code

```typescript
// src/app/build/[projectId]/page.tsx:146-165
useEffect(() => {
  if (!isVoiceCall || !callActive || !projectId) return

  let lastLength = 0
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`/api/builder/preview/${projectId}?poll=1`)
      const html = await res.text()
      if (html.length !== lastLength && !html.includes('No preview available')) {
        lastLength = html.length
        setPreviewUrl(`/api/builder/preview/${projectId}?t=${Date.now()}`)
      }
    } catch {
      // Ignore fetch errors during polling
    }
  }, 3000)

  return () => clearInterval(interval)
}, [isVoiceCall, callActive, projectId])
```

### Problems

1. **Server load**: Every active call generates 20 requests/minute to the preview endpoint. With 100 concurrent calls, that's 2,000 requests/minute just for polling.
2. **Content-length comparison is crude**: Compares `html.length` to detect changes. If an edit produces same-length HTML, update is missed.
3. **Duplicate with Realtime**: The `preview_updated` broadcast already notifies the frontend. Polling exists only because broadcasts are sometimes missed.
4. **Cache-busting breaks CDN**: Preview endpoint returns `Cache-Control: no-store, no-cache`. Combined with `?t=timestamp`, CDN caching is impossible.
5. **Latency**: Changes appear up to 3 seconds late (average 1.5s delay).

### Files Affected

| File | Lines | Content |
|------|------|---------|
| `src/app/build/[projectId]/page.tsx` | 146-165 | Polling interval |
| `src/app/api/builder/preview/[projectId]/route.ts` | 7-10 | Cache-Control: no-store |

---

## Proposed Solution: Rely on Realtime + Reconciliation

With Issue 004 (State Reconciliation) implemented, we have a reliable fallback that replaces polling:

### 1. Remove 3-Second Polling

Delete the `setInterval` polling code entirely from `page.tsx`.

### 2. Rely on Realtime Broadcasts (Primary)

The `preview_updated` broadcast from the voice server already notifies the frontend. This is the happy path and works 95%+ of the time.

```typescript
// Already exists in use-call-session.ts
channel.on('broadcast', { event: 'preview_updated' }, () => {
  handlePreviewUpdate()  // Refreshes iframe
})
```

### 3. Reconciliation Catches Missed Updates (Fallback)

The state reconciliation hook (Issue 004) polls the ground-truth state every 10 seconds. If it detects that `build_site` is newly completed, it triggers a preview refresh:

```typescript
// In the reconciliation callback
useStateReconciliation(callSid, callActive, (state) => {
  const newCompletedSteps = new Set(state.completedSteps)

  // If build_site was not in our set but is now in server state, refresh preview
  if (newCompletedSteps.has('build_site') && !completedSteps.has('build_site')) {
    refreshPreview()
  }

  // Also refresh if any edit has happened (check a version counter or timestamp)
  if (state.lastEditTimestamp > lastKnownEditTimestamp) {
    refreshPreview()
  }

  setCompletedSteps(newCompletedSteps)
})
```

### 4. Enable Preview Caching

With polling removed, we can add a short cache to the preview endpoint:

```typescript
// src/app/api/builder/preview/[projectId]/route.ts
return new NextResponse(html, {
  headers: {
    'Content-Type': 'text/html',
    'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
    // 5s CDN cache, serve stale for 10s while revalidating
  },
})
```

This means the CDN serves cached previews for 5 seconds, dramatically reducing origin load.

---

## Implementation Steps

1. **Prerequisite**: Implement Issue 004 (State Reconciliation) first
2. Remove the `setInterval` polling code from `page.tsx:146-165`
3. Verify Realtime broadcasts are the primary update mechanism
4. Add `lastEditTimestamp` to reconciliation response (from `projects.updated_at`)
5. Update reconciliation callback to trigger preview refresh on state changes
6. Update preview endpoint Cache-Control header from `no-store` to `s-maxage=5`
7. Add a `visibilitychange` listener to refresh preview when tab becomes visible
8. Test with flaky network (simulate missed broadcasts)

---

## Test Cases

### Unit Tests: `tests/preview-refresh.test.ts`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_no_polling_interval_exists` | Check page component | No `setInterval` for preview polling |
| 2 | `test_realtime_preview_updated_triggers_refresh` | Simulate broadcast | Preview URL updated with new timestamp |
| 3 | `test_reconciliation_detects_new_build` | Reconciliation returns build_site completed | Preview refreshes |
| 4 | `test_reconciliation_detects_edit` | Reconciliation returns newer timestamp | Preview refreshes |
| 5 | `test_no_refresh_when_no_changes` | Reconciliation returns same state | Preview URL unchanged |

### Integration Tests: `tests/preview-caching.test.ts`

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | `test_preview_has_cache_headers` | Fetch preview endpoint | `Cache-Control` includes `s-maxage` |
| 2 | `test_preview_no_longer_has_no_store` | Fetch preview endpoint | `Cache-Control` does NOT include `no-store` |

### Load Estimation

| Metric | Before (Polling) | After (Push) |
|--------|----------|-----------|
| Requests per active call per minute | 20 | 0.1 (reconciliation only) |
| With 100 concurrent calls | 2,000 req/min | 10 req/min |
| Preview endpoint cache hit rate | 0% | ~80% (5s TTL) |

---

## Acceptance Criteria

- [ ] No `setInterval` polling for preview updates exists in the codebase
- [ ] Realtime `preview_updated` broadcast is the primary refresh trigger
- [ ] State reconciliation catches missed updates within 10 seconds
- [ ] Preview endpoint has a short CDN-friendly cache header
- [ ] Tab `visibilitychange` triggers a refresh when user returns
- [ ] All existing tests continue to pass
- [ ] Prerequisite: Issue 004 must be implemented first

---

## Dependency

This issue **depends on Issue 004 (State Reconciliation)**. The reconciliation hook replaces polling as the reliable fallback. Implement Issue 004 first, then this issue becomes trivial (mostly deletion of code).
