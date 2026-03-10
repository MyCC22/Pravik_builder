import { ReactNode } from 'react'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-black text-white">
      <div className="mx-auto max-w-7xl">
        {children}
      </div>
    </div>
  )
}
