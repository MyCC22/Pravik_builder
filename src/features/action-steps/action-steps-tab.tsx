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
