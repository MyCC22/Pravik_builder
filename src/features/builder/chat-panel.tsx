'use client'

import { useRef, useEffect } from 'react'
import { MessageBubble } from './message-bubble'
import { PromptBar } from './prompt-bar'
import type { Message } from '@/lib/types'

interface ChatPanelProps {
  messages: Message[]
  onSend: (message: string) => void
  loading?: boolean
}

export function ChatPanel({ messages, onSend, loading }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-gray-600 text-xs mt-2">
            Send a message to start building
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/10 rounded-2xl rounded-bl-md px-4 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <PromptBar onSend={onSend} disabled={loading} />
    </div>
  )
}
