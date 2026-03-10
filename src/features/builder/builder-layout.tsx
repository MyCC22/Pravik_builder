'use client'

import { ReactNode } from 'react'

interface BuilderLayoutProps {
  preview: ReactNode
  chat: ReactNode
}

export function BuilderLayout({ preview, chat }: BuilderLayoutProps) {
  return (
    <div className="flex flex-col h-dvh bg-black">
      {/* Preview panel - 70% */}
      <div className="h-[70dvh] w-full border-b border-white/10 relative">
        {preview}
      </div>

      {/* Chat panel - 30% */}
      <div className="h-[30dvh] w-full flex flex-col">
        {chat}
      </div>
    </div>
  )
}
