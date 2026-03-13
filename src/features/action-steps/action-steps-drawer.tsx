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
