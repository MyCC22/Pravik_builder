# Loading Animation Design

## Goal

Replace the boring spinner shown during initial website generation (~15-20 seconds) with an engaging wireframe assembly animation combined with cycling progress text. The animation gives users visual feedback that their site is actively being built.

## Scope

**In scope:**
- Animated wireframe showing a website being assembled (nav, hero, columns, footer)
- Cycling progress text with dot indicators
- Applies only to initial generation (`loading && !previewUrl`)

**Out of scope:**
- Smart question flow during generation
- Changes to edit/update loading state (keeps existing spinner)
- Changes to the empty "Describe your website" screen

## Architecture

A single new React component (`GeneratingAnimation`) that encapsulates all animation logic. The component uses:
- CSS `@keyframes` animations for the wireframe assembly effect (staggered fade-in + slide-up)
- React `useState` + `useEffect` with `setInterval` for cycling progress text
- No external animation libraries

The existing `PreviewPanel` component imports and renders `GeneratingAnimation` when `loading && !url`.

## Component: `GeneratingAnimation`

### File

`src/features/builder/generating-animation.tsx`

### Visual Structure

```
+-------------------------------------------+
|  [====== nav bar ======]                   |  <- fades in first (0s delay)
|                                            |
|  +-------------------------------------+  |
|  |                                      |  |  <- hero block fades in (0.4s)
|  |          (gradient hero)             |  |
|  |                                      |  |
|  +-------------------------------------+  |
|                                            |
|  +----------+ +----------+ +----------+   |  <- 3 columns fade in (0.8s, 1.0s, 1.2s)
|  |          | |          | |          |   |
|  +----------+ +----------+ +----------+   |
|                                            |
|  [====== footer ======]                    |  <- footer fades in (1.6s)
|                                            |
|  "Choosing the perfect template..."        |  <- progress text cycles every 3s
|  [ o ] [ . ] [ . ] [ . ]                  |  <- dot indicators
+-------------------------------------------+
```

### Animation Details

- **Wireframe elements**: Each element starts at `opacity: 0; translateY: 12px` and animates to `opacity: 1; translateY: 0` with staggered delays
- **Continuous pulse**: After initial assembly, elements have a subtle pulse animation (`opacity: 0.4 -> 1 -> 0.4`) to show the wireframe is "alive"
- **Color scheme**: Dark background (`bg-black`), wireframe elements use grays (`#1a1a1a` to `#333`) with subtle green/blue accent on the hero block (matching Concept C from mockups)
- **Total animation loop**: ~2.5 seconds for assembly, then continuous pulse
- **Responsive sizing**: Wireframe container uses `max-w-[180px] w-full` with percentage-based internal spacing. On mobile (375px-wide screens), elements remain proportional. The 3 columns use `flex gap-1` so they gracefully compress without overlapping.

### Progress Steps

4 steps cycle every 3 seconds, **looping continuously** until the component unmounts. After "Assembling your website..." it wraps back to "Choosing the perfect template..." This avoids any dead end if generation takes longer than expected (>12s).

1. "Choosing the perfect template..."
2. "Writing your content..."
3. "Finding hero images..."
4. "Assembling your website..."

Each step has a corresponding dot indicator. Active dot = green (`#22c55e`), completed dots = dimmer green, upcoming = gray.

### Cleanup

The `setInterval` for progress text cycling is cleaned up in a `useEffect` return function to prevent memory leaks on unmount.

### Props

```typescript
interface GeneratingAnimationProps {
  // No props needed - self-contained component
}
```

## Changes to `PreviewPanel`

### File

`src/features/builder/preview-panel.tsx`

### Change

The current `PreviewPanel` has a single `if (loading)` block that renders a spinner for ALL loading states, using a ternary on `url` only for the text label. This needs to be **restructured** into two sub-branches:

**Before (current code):**
```typescript
if (loading) {
  return (
    <div className="flex items-center justify-center h-full bg-black">
      <div className="text-center space-y-3">
        <Loading size="lg" />
        <p className="text-gray-400 text-sm">
          {url ? 'Updating...' : getLoadingText(action ?? null)}
        </p>
      </div>
    </div>
  )
}
```

**After:**
```typescript
if (loading) {
  if (!url) {
    return <GeneratingAnimation />   // wireframe animation for initial generation
  }
  return (
    <div className="flex items-center justify-center h-full bg-black">
      <div className="text-center space-y-3">
        <Loading size="lg" />
        <p className="text-gray-400 text-sm">Updating...</p>
      </div>
    </div>
  )
}
```

**Note on `getLoadingText` and `action` prop:**
- The `getLoadingText()` function was only meaningful in the `!url` case (initial generation). The new `GeneratingAnimation` component supersedes it with its own progress steps.
- For the `url` case (edits), the text is always "Updating..." regardless of action type, so the function is no longer needed.
- `getLoadingText()` and the `action` prop should be **removed** from `PreviewPanel` to avoid dead code.
- The `action` prop is passed from `page.tsx` but becomes unused in the preview panel. The state can remain in `page.tsx` (it's used for the `clarify` check on line 286) but the prop is dropped from `PreviewPanelProps`.

## Voice Call Compatibility

The wireframe animation applies equally to voice-call-initiated builds. When a voice call triggers generation, `loading=true` and `previewUrl=null` just like text-initiated builds, so the same animation plays. This is the correct behavior: both flows involve the same ~15-20s wait for initial site generation, and the wireframe animation provides better visual feedback than a spinner regardless of input method.

## Error Handling

If generation fails, `page.tsx` sets `loading=false` in the `finally` block and `previewUrl` remains `null`. The `PreviewPanel` transitions from `GeneratingAnimation` back to the "Describe your website" empty state. This is correct: the animation unmounts cleanly (interval cleaned up), and the user sees the empty state where they can try again.

## Testing

- **Visual**: Generate a new website and verify the wireframe animation appears
- **Transition**: Confirm the animation disappears cleanly when the preview URL loads
- **Edit state**: Confirm edits still show the simple spinner (not the wireframe animation)
- **Mobile**: Verify the animation scales well on small screens (375px width, 70dvh preview panel)
- **Voice call**: Trigger generation via voice call flow, confirm same animation
- **Error**: Simulate a generation failure, confirm animation unmounts cleanly to empty state
- **TypeScript**: `npx tsc --noEmit` passes
- **Unit test**: One test confirming progress text cycles correctly and interval cleanup on unmount (deferred to implementation plan for exact test structure)

## No Backend Changes

This is a purely frontend change. No API, database, or server-side modifications.
