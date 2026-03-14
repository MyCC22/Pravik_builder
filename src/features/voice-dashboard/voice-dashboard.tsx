'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/services/supabase/browser'
import { CALL_EVENTS, WEB_ACTION_TYPES } from '@/lib/events/call-events'
import { VoiceProjectCard } from './voice-project-card'

interface DashboardProject {
  id: string
  name: string
  source: string | null
  created_at: string
  updated_at: string
}

interface VoiceDashboardProps {
  projects: DashboardProject[]
  callSid: string
  activeProjectId: string | null
}

export function VoiceDashboard({
  projects,
  callSid,
  activeProjectId,
}: VoiceDashboardProps) {
  const router = useRouter()
  const [callActive, setCallActive] = useState(true)
  const [navigating, setNavigating] = useState<string | null>(null)

  // Notify voice server that the page is open
  useEffect(() => {
    fetch('/api/voice/page-opened', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callSid }),
    }).catch(() => {})
  }, [callSid])

  // Track if we've already navigated to prevent double-navigation
  const navigatedRef = useRef(false)

  const navigateToBuild = useCallback(
    (projectId: string, source: string) => {
      if (navigatedRef.current) return
      navigatedRef.current = true
      console.log(`[VoiceDashboard] Navigating to /build/${projectId} (source: ${source})`)
      router.push(`/build/${projectId}?session=${callSid}`)
    },
    [callSid, router]
  )

  // Subscribe to Realtime channel for voice events
  useEffect(() => {
    const supabase = getSupabaseBrowser()
    const channel = supabase.channel(`call:${callSid}`)

    channel
      .on('broadcast', { event: CALL_EVENTS.PROJECT_SELECTED }, (payload) => {
        const projectId = payload.payload?.projectId
        console.log(`[VoiceDashboard] PROJECT_SELECTED event received:`, projectId)
        if (projectId) {
          navigateToBuild(projectId, 'project_selected')
        }
      })
      .on('broadcast', { event: CALL_EVENTS.PREVIEW_UPDATED }, (payload) => {
        const projectId = payload.payload?.projectId
        console.log(`[VoiceDashboard] PREVIEW_UPDATED event received:`, projectId)
        if (projectId) {
          navigateToBuild(projectId, 'preview_updated')
        }
      })
      .on('broadcast', { event: CALL_EVENTS.CALL_ENDED }, () => {
        console.log(`[VoiceDashboard] CALL_ENDED event received`)
        setCallActive(false)
      })
      .subscribe((status) => {
        console.log(`[VoiceDashboard] Realtime subscription status: ${status}`)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [callSid, navigateToBuild])

  // Fallback reconciliation: poll state endpoint to catch missed Realtime events.
  // Only navigate if the project_id CHANGED from what was present at page load.
  useEffect(() => {
    const poll = async () => {
      if (navigatedRef.current) return
      try {
        const res = await fetch(`/api/voice/state/${callSid}`)
        if (!res.ok) return
        const data = await res.json()
        // Navigate only if a project was assigned/changed after page load
        if (data.projectId && data.projectId !== activeProjectId && !navigatedRef.current) {
          console.log(`[VoiceDashboard] Reconciliation: project changed ${activeProjectId} → ${data.projectId}`)
          navigateToBuild(data.projectId, 'reconciliation')
        }
      } catch {
        // Ignore fetch errors during polling
      }
    }

    // Start polling after a short delay (give Realtime a chance first)
    const initialTimeout = setTimeout(poll, 3000)
    const interval = setInterval(poll, 5000)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [callSid, activeProjectId, navigateToBuild])

  const broadcastAction = useCallback(
    (actionType: string, data: Record<string, unknown> = {}) => {
      const supabase = getSupabaseBrowser()
      const channel = supabase.channel(`call:${callSid}`)
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: CALL_EVENTS.WEB_ACTION,
            payload: { actionType, ...data },
          })
        }
      })
    },
    [callSid]
  )

  const handleProjectClick = useCallback(
    (projectId: string) => {
      setNavigating(projectId)
      broadcastAction(WEB_ACTION_TYPES.PROJECT_SELECTED_FROM_WEB, { projectId })
      // Navigate directly — the voice AI will catch up
      setTimeout(() => {
        router.push(`/build/${projectId}?session=${callSid}`)
      }, 300)
    },
    [broadcastAction, callSid, router]
  )

  const handleNewProject = useCallback(() => {
    setNavigating('new')
    broadcastAction(WEB_ACTION_TYPES.NEW_PROJECT_REQUESTED)
    // Wait for voice server to create project and broadcast project_selected
    // The realtime listener above will handle navigation
  }, [broadcastAction])

  // Relative time helper
  const timeAgo = (dateStr: string) => {
    const now = Date.now()
    const then = new Date(dateStr).getTime()
    const diff = now - then
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days === 1) return 'Yesterday'
    if (days < 30) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Status bar */}
      <div className="sticky top-0 z-20 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {callActive ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span className="text-[13px] font-medium text-white/70">
                  On call with Timmy
                </span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-white/20" />
                <span className="text-[13px] font-medium text-white/40">
                  Call ended
                </span>
              </>
            )}
          </div>
          <div className="text-[11px] text-white/30 font-medium tracking-wide uppercase">
            Pravik
          </div>
        </div>
      </div>

      <div className="px-5 pt-6 pb-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[22px] font-semibold text-white tracking-tight">
            Your Websites
          </h1>
          <p className="text-[13px] text-white/40 mt-1">
            {projects.length === 0
              ? 'Your websites will appear here'
              : `${projects.length} site${projects.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Build New button */}
        <button
          onClick={handleNewProject}
          disabled={navigating === 'new'}
          className="w-full mb-5 group relative overflow-hidden rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] p-4 transition-all duration-200 active:scale-[0.98] hover:border-white/20 hover:bg-white/[0.04] disabled:opacity-50 disabled:pointer-events-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center transition-colors group-hover:bg-white/[0.1]">
              {navigating === 'new' ? (
                <svg
                  className="w-5 h-5 text-white/50 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                    opacity="0.2"
                  />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="text-white/50"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              )}
            </div>
            <div className="text-left">
              <div className="text-[15px] font-medium text-white/80">
                Build a New Website
              </div>
              <div className="text-[12px] text-white/30 mt-0.5">
                Start from scratch with Timmy
              </div>
            </div>
          </div>
        </button>

        {/* Project list */}
        {projects.length > 0 && (
          <div className="space-y-3">
            {projects.map((project, index) => (
              <VoiceProjectCard
                key={project.id}
                project={project}
                isActive={project.id === activeProjectId}
                isNavigating={navigating === project.id}
                timeAgo={timeAgo(project.updated_at)}
                onClick={() => handleProjectClick(project.id)}
                index={index}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {projects.length === 0 && (
          <div className="mt-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.03] flex items-center justify-center">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-white/20"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
            </div>
            <p className="text-[13px] text-white/30 leading-relaxed max-w-[240px] mx-auto">
              Tell Timmy what you want to build and your site will show up here
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
