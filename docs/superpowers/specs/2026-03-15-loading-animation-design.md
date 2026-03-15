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
- **Continuous pulse**: After initial assembly, elements have a subtle pulse animation (`opacity: 0.4 → 1 → 0.4`) to show the wireframe is "alive"
- **Color scheme**: Dark background (`bg-black`), wireframe elements use grays (`#1a1a1a` to `#333`) with subtle green/blue accent on the hero block (matching Concept C from mockups)
- **Total animation loop**: ~2.5 seconds for assembly, then continuous pulse

### Progress Steps

4 steps cycle every 3 seconds:
1. "Choosing the perfect template..."
2. "Writing your content..."
3. "Finding hero images..."
4. "Assembling your website..."

Each step has a corresponding dot indicator. Active dot = green (`#22c55e`), completed dots = dimmer green, upcoming = gray.

### Props

```typescript
interface GeneratingAnimationProps {
  // No props needed — self-contained component
}
```

## Changes to `PreviewPanel`

### File

`src/features/builder/preview-panel.tsx`

### Change

Replace the `loading && !url` branch to use `GeneratingAnimation` instead of the generic spinner:

```
if (loading) {
  if (!url) {
    return <GeneratingAnimation />      // NEW: wireframe animation for initial gen
  }
  return (
    // existing spinner for edits/updates
  )
}
```

The `loading && url` case (edits) keeps the current spinner + "Updating..." text since edits are fast (~3-5s).

## Testing

- **Visual**: Generate a new website and verify the wireframe animation appears
- **Transition**: Confirm the animation disappears cleanly when the preview URL loads
- **Edit state**: Confirm edits still show the simple spinner (not the wireframe animation)
- **Mobile**: Verify the animation scales well on small screens (70dvh preview panel)
- **TypeScript**: `npx tsc --noEmit` passes

## No Backend Changes

This is a purely frontend change. No API, database, or server-side modifications.
