'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { BuilderLayout } from '@/features/builder/builder-layout'
import { PreviewPanel } from '@/features/builder/preview-panel'
import { ChatPanel } from '@/features/builder/chat-panel'
import { useSession } from '@/features/auth/use-session'
import { useCallSession } from '@/hooks/use-call-session'
import type { Message, Project } from '@/lib/types'

export default function BuilderPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const searchParams = useSearchParams()
  const callSid = searchParams.get('session')
  const { user } = useSession()
  const [project, setProject] = useState<Project | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<string | null>(null)

  // Refresh preview callback for voice call updates
  const refreshPreview = useCallback(() => {
    if (projectId) {
      setPreviewUrl(`/api/builder/preview/${projectId}?t=${Date.now()}`)
    }
  }, [projectId])

  // Voice call session — subscribes to Supabase Realtime for live updates
  const { isVoiceCall, callActive, voiceMessages } = useCallSession(
    callSid,
    refreshPreview
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

  // Poll for preview updates during active voice calls
  // Realtime broadcast can be unreliable — polling is the reliable fallback
  useEffect(() => {
    if (!isVoiceCall || !callActive || !projectId) return

    const interval = setInterval(() => {
      setPreviewUrl(`/api/builder/preview/${projectId}?t=${Date.now()}`)
    }, 4000)

    return () => clearInterval(interval)
  }, [isVoiceCall, callActive, projectId])

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
    [projectId]
  )

  const shareUrl = projectId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/site/${projectId}`
    : null

  return (
    <BuilderLayout
      preview={<PreviewPanel url={previewUrl} loading={loading} action={action} />}
      chat={<ChatPanel messages={messages} onSend={handleSend} loading={loading} />}
      shareUrl={shareUrl}
      isVoiceCall={isVoiceCall}
      callActive={callActive}
    />
  )
}
