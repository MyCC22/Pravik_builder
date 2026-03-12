'use client'

import { ReactNode, useState, useEffect } from 'react'
import { VoiceCallBanner } from './voice-call-banner'

interface BuilderLayoutProps {
  preview: ReactNode
  chat: ReactNode | ((collapsed: boolean) => ReactNode)
  shareUrl?: string | null
  isVoiceCall?: boolean
  callActive?: boolean
  hasMessages?: boolean
}

export function BuilderLayout({ preview, chat, shareUrl, isVoiceCall, callActive, hasMessages }: BuilderLayoutProps) {
  // Start collapsed — auto-expand when first message arrives
  const [chatExpanded, setChatExpanded] = useState(false)
  const [userCollapsed, setUserCollapsed] = useState(false)

  // Auto-expand when messages arrive (unless user manually collapsed)
  useEffect(() => {
    if (hasMessages && !userCollapsed) {
      setChatExpanded(true)
    }
  }, [hasMessages, userCollapsed])

  const handleToggle = () => {
    if (chatExpanded) {
      setChatExpanded(false)
      setUserCollapsed(true)
    } else {
      setChatExpanded(true)
      setUserCollapsed(false)
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-black">
      {/* Preview panel — grows when chat is collapsed */}
      <div
        className={`w-full border-b border-white/10 relative transition-all duration-300 ${
          chatExpanded ? 'h-[70dvh]' : 'flex-1'
        }`}
      >
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

      {/* Chat panel — collapsible to just the input bar */}
      <div
        className={`w-full flex flex-col transition-all duration-300 ${
          chatExpanded ? 'h-[30dvh]' : 'h-auto'
        }`}
      >
        {/* Toggle handle — only visible when there are messages to show/hide */}
        {hasMessages && (
          <button
            type="button"
            onClick={handleToggle}
            className="flex items-center justify-center gap-1.5 py-1 bg-white/5 hover:bg-white/10 transition-colors shrink-0 group"
          >
            <svg
              className={`w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 transition-transform duration-300 ${
                chatExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
            <span className="text-[11px] text-gray-500 group-hover:text-gray-300 transition-colors">
              {chatExpanded ? 'Hide messages' : 'Show messages'}
            </span>
          </button>
        )}
        {typeof chat === 'function' ? chat(!chatExpanded) : chat}
      </div>
    </div>
  )
}
