'use client'

import { ReactNode } from 'react'
import { VoiceCallBanner } from './voice-call-banner'

interface BuilderLayoutProps {
  preview: ReactNode
  chat: ReactNode
  shareUrl?: string | null
  isVoiceCall?: boolean
  callActive?: boolean
}

export function BuilderLayout({ preview, chat, shareUrl, isVoiceCall, callActive }: BuilderLayoutProps) {
  return (
    <div className="flex flex-col h-dvh bg-black">
      {/* Preview panel - 70% */}
      <div className="h-[70dvh] w-full border-b border-white/10 relative">
        {preview}
        {isVoiceCall && <VoiceCallBanner callActive={!!callActive} />}
        {shareUrl && (
          <div className="absolute top-2 right-2 z-10">
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors"
            >
              Share link
            </a>
          </div>
        )}
      </div>

      {/* Chat panel - 30% */}
      <div className="h-[30dvh] w-full flex flex-col">
        {chat}
      </div>
    </div>
  )
}
