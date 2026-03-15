# Loading Animation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the boring spinner during initial website generation with an animated wireframe assembly + cycling progress text.

**Architecture:** One new React component (`GeneratingAnimation`) containing all animation logic (CSS keyframes + React state for progress text). The existing `PreviewPanel` imports it and renders it when `loading && !url`. Dead code (`getLoadingText`, `action` prop) is removed.

**Tech Stack:** React, Tailwind CSS, CSS @keyframes animations

**Spec:** `docs/superpowers/specs/2026-03-15-loading-animation-design.md`

---

## Chunk 1: Implementation

### Task 1: Create `GeneratingAnimation` component

**Files:**
- Create: `src/features/builder/generating-animation.tsx`

- [ ] **Step 1: Create the component file with full implementation**

Write the complete `GeneratingAnimation` component to `src/features/builder/generating-animation.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'

const STEPS = [
  'Choosing the perfect template...',
  'Writing your content...',
  'Finding hero images...',
  'Assembling your website...',
]

export function GeneratingAnimation() {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % STEPS.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center justify-center h-full bg-black">
      <div className="flex flex-col items-center gap-8">
        {/* Wireframe */}
        <div className="max-w-[180px] w-full flex flex-col gap-1.5">
          {/* Nav bar */}
          <div
            className="h-3 bg-[#333] rounded-sm opacity-0"
            style={{
              animation: 'fadeInUp 0.5s ease-out forwards, wfSlide 2s ease-in-out 0.5s infinite',
            }}
          />
          {/* Hero block */}
          <div
            className="h-12 rounded bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/20 opacity-0"
            style={{
              animation: 'fadeInUp 0.5s ease-out 0.4s forwards, wfPulse 2.5s ease-in-out 0.9s infinite',
            }}
          />
          {/* Three columns */}
          <div className="flex gap-1">
            {[0.8, 1.0, 1.2].map((delay, i) => (
              <div
                key={i}
                className="flex-1 h-7 bg-[#1a1a1a] rounded-sm border border-[#333] opacity-0"
                style={{
                  animation: `fadeInUp 0.5s ease-out ${delay}s forwards, wfFade 2s ease-in-out ${delay + 0.5}s infinite`,
                }}
              />
            ))}
          </div>
          {/* Footer */}
          <div
            className="h-2.5 bg-[#222] rounded-sm opacity-0"
            style={{
              animation: 'fadeInUp 0.5s ease-out 1.6s forwards, wfSlide 2s ease-in-out 2.1s infinite',
            }}
          />
        </div>

        {/* Progress text + dots */}
        <div className="text-center">
          <p
            className="text-[13px] text-gray-400 transition-opacity duration-300 min-h-[20px]"
            key={currentStep}
          >
            {STEPS[currentStep]}
          </p>
          <div className="flex gap-1.5 justify-center mt-3">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  i === currentStep
                    ? 'bg-emerald-500'
                    : i < currentStep
                      ? 'bg-emerald-500/40'
                      : 'bg-[#333]'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes wfSlide {
          0%, 100% { transform: scaleX(0.6); opacity: 0.4; }
          50% { transform: scaleX(1); opacity: 1; }
        }
        @keyframes wfPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes wfFade {
          0%, 100% { opacity: 0.2; transform: scaleY(0.5); }
          50% { opacity: 0.8; transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}
```

Key details:
- `'use client'` directive required — uses React hooks (`useState`, `useEffect`)
- **Entrance animation**: Each wireframe element starts at `opacity: 0` and uses `fadeInUp` (translateY 12px -> 0) with staggered delays matching the spec (nav: 0s, hero: 0.4s, columns: 0.8s/1.0s/1.2s, footer: 1.6s). Uses `animation-fill-mode: forwards` to keep final state. Total assembly: ~2.1 seconds.
- **Continuous pulse**: After each element's entrance completes, the looping animation (`wfSlide`/`wfPulse`/`wfFade`) starts with an offset equal to entrance delay + 0.5s
- **Responsive sizing**: Container uses `max-w-[180px] w-full` — scales down on narrow viewports, 3 columns use `flex gap-1` to gracefully compress
- `STEPS` array has 4 progress messages that cycle every 3 seconds via `setInterval`, looping continuously
- `useEffect` cleanup returns `clearInterval` to prevent memory leaks on unmount
- `currentStep` wraps around with modulo: `(prev + 1) % STEPS.length`
- Dot indicators: active = `bg-emerald-500`, completed = `bg-emerald-500/40`, upcoming = `bg-[#333]`
- Container uses `h-full bg-black` to fill the preview panel (matches existing loading state styling)

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/tarun/Desktop/Pravik_Builder && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to `generating-animation.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/features/builder/generating-animation.tsx
git commit -m "feat: add GeneratingAnimation component with wireframe + progress steps"
```

---

### Task 2: Integrate into `PreviewPanel` and remove dead code

**Files:**
- Modify: `src/features/builder/preview-panel.tsx` (lines 1-58, full file)
- Modify: `src/app/build/[projectId]/page.tsx` (line 329, remove `action` prop)

- [ ] **Step 1: Rewrite `preview-panel.tsx`**

Replace the entire contents of `src/features/builder/preview-panel.tsx` with:

```tsx
'use client'

import { Loading } from '@/components/ui/loading'
import { GeneratingAnimation } from './generating-animation'

interface PreviewPanelProps {
  url: string | null
  loading?: boolean
}

export function PreviewPanel({ url, loading }: PreviewPanelProps) {
  if (loading) {
    if (!url) {
      return <GeneratingAnimation />
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

  if (!url) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-center space-y-2 px-8">
          <p className="text-4xl mb-4">&#9997;&#65039;</p>
          <p className="text-gray-300 font-medium">Describe your website</p>
          <p className="text-gray-500 text-sm">Type or use your voice below to get started</p>
        </div>
      </div>
    )
  }

  return (
    <iframe
      src={url}
      className="w-full h-full border-0 bg-white"
      title="Website Preview"
      allow="clipboard-write"
    />
  )
}
```

Changes from current code:
- **Added**: `import { GeneratingAnimation } from './generating-animation'`
- **Removed**: `getLoadingText()` function (lines 11-22 of original) — superseded by `GeneratingAnimation`'s own progress steps for the `!url` case. For the `url` case (edits), text is always "Updating..." so the function is dead code.
- **Removed**: `action` from `PreviewPanelProps` interface — no longer consumed by this component
- **Restructured**: `if (loading)` block now has two branches:
  - `!url` → `<GeneratingAnimation />` (initial generation)
  - has `url` → spinner + "Updating..." (edits)
- **Preserved**: The `!url` empty state and iframe states are unchanged

- [ ] **Step 2: Remove `action` prop from `page.tsx`**

In `src/app/build/[projectId]/page.tsx`, line 329, change:

```tsx
preview={<PreviewPanel url={previewUrl} loading={loading} action={action} />}
```

to:

```tsx
preview={<PreviewPanel url={previewUrl} loading={loading} />}
```

The `action` state variable stays in `page.tsx` — it's still used on line 286 for the `clarify` check. Only the prop passing is removed.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/tarun/Desktop/Pravik_Builder && npx tsc --noEmit 2>&1 | head -20`
Expected: Clean compile, no errors

- [ ] **Step 4: Commit**

```bash
git add src/features/builder/preview-panel.tsx src/app/build/[projectId]/page.tsx
git commit -m "feat: integrate GeneratingAnimation into PreviewPanel, remove dead code"
```

---

### Task 3: Visual verification and deploy

- [ ] **Step 1: Start dev server and visually verify**

Run: `cd /Users/tarun/Desktop/Pravik_Builder && npm run dev`

Test scenarios:

**Initial generation (primary flow):**
1. Open `http://localhost:3000` in browser
2. Create/open a project and type a message to trigger generation
3. **Verify**: Wireframe elements fade in one by one (nav first, then hero, columns, footer)
4. **Verify**: After entrance, elements pulse/breathe continuously
5. **Verify**: Progress text cycles: "Choosing the perfect template..." → "Writing your content..." → etc.
6. **Verify**: Dot indicators advance in sync with text
7. **Verify**: When generation completes, animation is replaced by the iframe preview

**Edit/update flow:**
8. After a website is generated, make an edit (e.g., "change the heading")
9. **Verify**: Simple spinner with "Updating..." text appears (not the wireframe animation)

**Mobile viewport:**
10. Use browser DevTools to set viewport to 375px width
11. Trigger generation again
12. **Verify**: Wireframe scales properly, columns don't overlap, text is readable

**Error handling:**
13. Simulate a failure (e.g., disconnect network, or send an invalid request)
14. **Verify**: Animation disappears, "Describe your website" empty state shows

- [ ] **Step 2: Deploy to Vercel**

Run: `cd /Users/tarun/Desktop/Pravik_Builder && git push`

Vercel auto-deploys from the push. Verify the animation works on the deployed URL.

- [ ] **Step 3: Commit any fixes if needed**

If visual verification reveals any issues (sizing, timing, colors), fix them and commit.

---

### Note on unit tests

The project has vitest configured (`environment: 'node'`) but zero existing tests and no React testing infrastructure (`@testing-library/react`, `jsdom` environment). Adding a React component unit test would require installing new dependencies and configuring jsdom. Given this is a purely visual/animation component with simple state logic (`setInterval` + modulo counter), the cost of setting up the test infrastructure outweighs the benefit. The interval cleanup is a standard React pattern that's reliable by inspection. Visual verification in Task 3 provides adequate coverage. Unit tests can be added later when the project establishes a React testing baseline.
