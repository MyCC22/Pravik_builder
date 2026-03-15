'use client'

import { useEffect, useState } from 'react'
import { formatTime, formatPhone } from './utils'

interface CallerMessage {
  id: string
  callerName: string
  callerPhone: string
  reason: string
  calledAt: string
  callSid: string
}

interface CallerMessagesProps {
  projectId: string
}

// Inline SVG icons (project doesn't use lucide-react)
function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  )
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

export function CallerMessages({ projectId }: CallerMessagesProps) {
  const [messages, setMessages] = useState<CallerMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMessages() {
      try {
        const res = await fetch(`/api/projects/${projectId}/messages`)
        if (!res.ok) return
        const data = await res.json()
        setMessages(data.messages || [])
      } catch (err) {
        console.error('Failed to fetch messages:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()
  }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-white/40">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white/60" />
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MessageIcon className="w-10 h-10 text-white/20 mb-3" />
        <p className="text-white/50 text-sm">No messages yet</p>
        <p className="text-white/30 text-xs mt-1">
          When callers leave messages with your AI assistant, they&apos;ll appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2"
        >
          {/* Caller info row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-white/40" />
              <span className="text-white/90 text-sm font-medium">
                {msg.callerName}
              </span>
            </div>
            <div className="flex items-center gap-1 text-white/40">
              <ClockIcon className="w-3 h-3" />
              <span className="text-xs">
                {formatTime(msg.calledAt)}
              </span>
            </div>
          </div>

          {/* Message reason */}
          <p className="text-white/70 text-sm leading-relaxed">
            {msg.reason}
          </p>

          {/* Phone number with tap-to-call */}
          {msg.callerPhone && (
            <a
              href={`tel:${msg.callerPhone}`}
              className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs transition-colors"
            >
              <PhoneIcon className="w-3 h-3" />
              {formatPhone(msg.callerPhone)}
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

