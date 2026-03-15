'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loading } from '@/components/ui/loading'
import { useSession } from '@/features/auth/use-session'
import { formatTime, formatPhone } from './utils'

interface AggregatedMessage {
  id: string
  projectId: string
  projectName: string
  callerName: string
  callerPhone: string
  reason: string
  calledAt: string
  callSid: string
}

// ---------------------------------------------------------------------------
// Inline SVG icons (project uses inline SVGs, no icon library)
// ---------------------------------------------------------------------------

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  )
}

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

function EnvelopeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessagesDashboard() {
  const [messages, setMessages] = useState<AggregatedMessage[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!user) return

    fetch('/api/messages', {
      headers: { 'x-user-id': user.id },
    })
      .then((res) => res.json())
      .then((data) => setMessages(data.messages || []))
      .catch((err) => console.error('Failed to fetch messages:', err))
      .finally(() => setLoading(false))
  }, [user])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loading />
      </div>
    )
  }

  // Group messages by project, preserving API sort order (newest first)
  const grouped = groupByProject(messages)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/projects')}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          aria-label="Back to projects"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold">Caller Messages</h1>
      </div>

      {/* Empty state */}
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <EnvelopeIcon className="w-10 h-10 text-white/20 mb-3" />
          <p className="text-white/50 text-sm">No messages yet</p>
          <p className="text-white/30 text-xs mt-1">
            When callers leave messages with your AI assistants, they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([projectName, msgs]) => (
            <div key={projectName}>
              <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
                {projectName}
              </h2>
              <div className="space-y-3">
                {msgs.map((msg) => (
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
                        <span className="text-xs">{formatTime(msg.calledAt)}</span>
                      </div>
                    </div>

                    {/* Message reason */}
                    <p className="text-white/70 text-sm leading-relaxed">{msg.reason}</p>

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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Group a flat list of messages by projectName.
 * Order is preserved from the API (newest first), so the first group
 * contains the project with the most recent message.
 */
function groupByProject(messages: AggregatedMessage[]): [string, AggregatedMessage[]][] {
  const map = new Map<string, AggregatedMessage[]>()
  for (const msg of messages) {
    const existing = map.get(msg.projectName)
    if (existing) {
      existing.push(msg)
    } else {
      map.set(msg.projectName, [msg])
    }
  }
  return Array.from(map.entries())
}
