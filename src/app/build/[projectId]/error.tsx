'use client'

import { useEffect } from 'react'

export default function BuilderError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Builder page error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-gray-500 text-center max-w-md">
        The builder encountered an error. Your project is safe — try refreshing.
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
      >
        Try Again
      </button>
    </div>
  )
}
