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
        width: 24,
        height: 64,
        background: '#1e1e2e',
        border: '1px solid #333',
        borderLeft: 'none',
        borderRadius: '0 10px 10px 0',
      }}
      aria-label={`Action steps menu — ${remaining} remaining`}
    >
      <svg
        width="10"
        height="16"
        viewBox="0 0 10 16"
        fill="none"
        className="text-gray-400"
      >
        <path
          d="M2 2L8 8L2 14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {remaining > 0 && (
        <span
          className="absolute -top-1 -right-1"
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#ef4444',
          }}
        />
      )}
    </button>
  )
}
