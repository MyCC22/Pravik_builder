'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { BuilderLayout } from '@/features/builder/builder-layout'
import { PreviewPanel } from '@/features/builder/preview-panel'
import { ChatPanel } from '@/features/builder/chat-panel'
import { useSession } from '@/features/auth/use-session'
import { useCallSession } from '@/hooks/use-call-session'
import { WEB_ACTION_TYPES } from '@/lib/events/call-events'
import type { Message, Project } from '@/lib/types'

export default function BuilderPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const searchParams = useSearchParams()
  const callSid = searchParams.get('session')
  const router = useRouter()
  const { user } = useSession()
  const [project, setProject] = useState<Project | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())

  // Refresh preview by updating the URL with a cache-busting timestamp.
  // This forces a full re-fetch from the server — more reliable on mobile
  // than iframe.contentWindow.location.reload() which can serve cached content.
  const refreshPreview = useCallback(() => {
    if (projectId) {
      setPreviewUrl(`/api/builder/preview/${projectId}?t=${Date.now()}`)
    }
  }, [projectId])

  // Handle mid-call project switching — voice AI selected a different project
  const handleProjectSwitched = useCallback(
    (newProjectId: string) => {
      if (newProjectId !== projectId) {
        router.push(`/build/${newProjectId}?session=${callSid}`)
      }
    },
    [projectId, callSid, router]
  )

  // Voice call session — subscribes to Supabase Realtime for live updates
  const { isVoiceCall, callActive, voiceMessages, broadcastWebAction } = useCallSession(
    callSid,
    {
      onRefreshPreview: refreshPreview,
      onProjectSwitched: handleProjectSwitched,
      onActionMenuOpen: () => setDrawerOpen(true),
      onActionMenuClose: () => setDrawerOpen(false),
      onStepCompleted: (stepId: string) => {
        setCompletedSteps((prev) => new Set(prev).add(stepId))
      },
    }
  )

  // Step selection handler — broadcasts to voice AI and closes drawer
  const handleStepSelected = useCallback(
    (stepId: string, stepLabel: string) => {
      if (broadcastWebAction) {
        broadcastWebAction(WEB_ACTION_TYPES.STEP_SELECTED, { stepId, stepLabel })
      }
      setDrawerOpen(false)
    },
    [broadcastWebAction]
  )

  // Notify voice server that page has been opened
  useEffect(() => {
    if (!callSid) return

    fetch('/api/voice/page-opened', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callSid }),
    }).catch((err) => {
      console.error('Failed to notify page opened:', err)
    })
  }, [callSid])

  // Add voice messages to the chat panel
  useEffect(() => {
    if (voiceMessages.length === 0 || !projectId) return

    const lastMsg = voiceMessages[voiceMessages.length - 1]
    const msg: Message = {
      id: `voice-${lastMsg.timestamp}`,
      project_id: projectId,
      role: lastMsg.role,
      content: lastMsg.content,
      created_at: new Date(lastMsg.timestamp).toISOString(),
    }
    setMessages((prev) => [...prev, msg])
  }, [voiceMessages, projectId])

  // Fetch initial step completion state (non-voice calls use projectId-based endpoint)
  useEffect(() => {
    if (!projectId || isVoiceCall) return

    fetch(`/api/projects/${projectId}/completion`)
      .then((res) => res.json())
      .then((data) => {
        const completed = new Set<string>()
        if (data.hasBlocks) completed.add('build_site')
        if (data.hasBookingTool) completed.add('contact_form')
        if (data.hasPhone) completed.add('phone_number')
        if (data.hasForwardingPhone) completed.add('call_forwarding')
        setCompletedSteps(completed)
      })
      .catch(() => {
        // Graceful degradation — voice AI will re-broadcast completions
      })
  }, [projectId, isVoiceCall])

  useEffect(() => {
    if (!user || !projectId) return

    fetch(`/api/projects`, {
      headers: { 'x-user-id': user.id },
    })
      .then((res) => res.json())
      .then((data) => {
        const proj = data.projects?.find((p: Project) => p.id === projectId)
        if (proj) {
          setProject(proj)
          if (proj.template_config) {
            setPreviewUrl(`/api/builder/preview/${projectId}`)
          }
        }
      })
  }, [user, projectId])

  // For voice calls without auth, set initial preview URL
  useEffect(() => {
    if (isVoiceCall && projectId && !previewUrl) {
      setPreviewUrl(`/api/builder/preview/${projectId}`)
    }
  }, [isVoiceCall, projectId, previewUrl])

  // Track last known edit timestamp to detect edits via reconciliation.
  // When the server's lastEditTimestamp is newer than what we've seen,
  // it means an edit happened that we may have missed via Realtime.
  const lastEditTimestampRef = useRef<number>(0)
  const reconcileInFlightRef = useRef(false)

  // State reconciliation — periodically fetch ground truth from the database
  // to catch missed Realtime broadcasts, handle page reloads, and detect
  // project switches. Replaces the old 3-second preview polling.
  useEffect(() => {
    if (!isVoiceCall || !callActive || !callSid) return

    async function reconcile() {
      if (reconcileInFlightRef.current) return
      reconcileInFlightRef.current = true
      try {
        const res = await fetch(`/api/voice/state/${callSid}`)
        if (!res.ok) return
        const state = await res.json()

        // Additive merge — never remove steps the client already has
        // (avoids flicker if DB write is slightly delayed)
        setCompletedSteps((prev) => {
          const merged = new Set(prev)
          let changed = false
          for (const step of state.completedSteps) {
            if (!merged.has(step)) {
              merged.add(step)
              changed = true
            }
          }
          // If build_site is newly detected, refresh the preview
          if (!prev.has('build_site') && state.completedSteps.includes('build_site')) {
            refreshPreview()
          }
          return changed ? merged : prev
        })

        // Detect edits via lastEditTimestamp — refresh preview if project
        // was updated since our last check (catches missed edit broadcasts)
        if (state.lastEditTimestamp && state.lastEditTimestamp > lastEditTimestampRef.current) {
          if (lastEditTimestampRef.current > 0) {
            // Only refresh if we had a previous value (skip initial fetch)
            refreshPreview()
          }
          lastEditTimestampRef.current = state.lastEditTimestamp
        }

        // Reconcile project if switched mid-call
        if (state.projectId && state.projectId !== projectId) {
          router.replace(`/build/${state.projectId}?session=${callSid}`)
        }
      } catch {
        // Silent fail — next interval or broadcast will catch up
      } finally {
        reconcileInFlightRef.current = false
      }
    }

    // Reconcile immediately on mount (handles page reload recovery)
    reconcile()

    // Reconcile every 10 seconds (handles missed broadcasts)
    const interval = setInterval(reconcile, 10_000)

    // Reconcile when tab becomes visible (handles tab switching back)
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        reconcile()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [isVoiceCall, callActive, callSid, projectId, router, refreshPreview])


  const handleSend = useCallback(
    async (message: string, images?: File[]) => {
      if (!projectId) return

      // Upload images first (if any) and collect URLs
      let imageUrls: string[] = []
      if (images && images.length > 0) {
        try {
          const uploads = await Promise.all(
            images.map(async (file) => {
              const formData = new FormData()
              formData.append('file', file)
              formData.append('project_id', projectId)
              const res = await fetch('/api/builder/upload-image', {
                method: 'POST',
                body: formData,
              })
              if (!res.ok) throw new Error('Upload failed')
              const data = await res.json()
              return data.url as string
            })
          )
          imageUrls = uploads
        } catch (err) {
          console.error('Image upload error:', err)
        }
      }

      const tempMsg: Message = {
        id: `temp-${Date.now()}`,
        project_id: projectId,
        role: 'user',
        content: message,
        image_urls: imageUrls.length > 0 ? imageUrls : undefined,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, tempMsg])
      setLoading(true)
      setAction(null)

      try {
        const res = await fetch('/api/builder/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            project_id: projectId,
            ...(imageUrls.length > 0 ? { image_urls: imageUrls } : {}),
          }),
        })

        if (!res.ok) {
          throw new Error(`Server error: ${res.status}`)
        }

        const result = await res.json()

        if (result.error) {
          throw new Error(result.error)
        }

        setAction(result.action)

        if (result.action !== 'clarify') {
          setPreviewUrl(`/api/builder/preview/${projectId}?t=${Date.now()}`)
        }

        // Notify voice AI about web page actions during active voice calls
        if (isVoiceCall && callActive && broadcastWebAction) {
          broadcastWebAction(WEB_ACTION_TYPES.TEXT_MESSAGE_SENT, {
            message,
            ...(imageUrls.length > 0 ? { imageUrls } : {}),
          })
        }

        const assistantMsg: Message = {
          id: `temp-assistant-${Date.now()}`,
          project_id: projectId,
          role: 'assistant',
          content: result.message,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, assistantMsg])
      } catch (err) {
        console.error('Send error:', err)
        const errorMsg: Message = {
          id: `temp-error-${Date.now()}`,
          project_id: projectId,
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, errorMsg])
      } finally {
        setLoading(false)
      }
    },
    [projectId, isVoiceCall, callActive, broadcastWebAction]
  )

  const shareUrl = projectId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/site/${projectId}`
    : null

  return (
    <BuilderLayout
      preview={<PreviewPanel url={previewUrl} loading={loading} action={action} />}
      chat={(collapsed) => <ChatPanel messages={messages} onSend={handleSend} loading={loading} collapsed={collapsed} />}
      shareUrl={shareUrl}
      isVoiceCall={isVoiceCall}
      callActive={callActive}
      hasMessages={messages.length > 0}
      drawerOpen={drawerOpen}
      completedSteps={completedSteps}
      onStepSelected={handleStepSelected}
      onDrawerToggle={setDrawerOpen}
    />
  )
}
