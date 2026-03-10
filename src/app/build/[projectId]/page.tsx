'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { BuilderLayout } from '@/features/builder/builder-layout'
import { PreviewPanel } from '@/features/builder/preview-panel'
import { ChatPanel } from '@/features/builder/chat-panel'
import { useSession } from '@/features/auth/use-session'
import type { Message, Project } from '@/lib/types'

export default function BuilderPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useSession()
  const [project, setProject] = useState<Project | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

  const handleSend = useCallback(
    async (message: string) => {
      if (!projectId) return

      const tempMsg: Message = {
        id: `temp-${Date.now()}`,
        project_id: projectId,
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, tempMsg])
      setLoading(true)

      try {
        const res = await fetch('/api/builder/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, project_id: projectId }),
        })
        const result = await res.json()

        if (result.error) {
          throw new Error(result.error)
        }

        // Force iframe refresh by appending timestamp
        setPreviewUrl(`/api/builder/preview/${projectId}?t=${Date.now()}`)

        const assistantMsg: Message = {
          id: `temp-assistant-${Date.now()}`,
          project_id: projectId,
          role: 'assistant',
          content: `Updated: ${result.config?.template} / ${result.config?.theme}`,
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
      preview={<PreviewPanel url={previewUrl} loading={loading} />}
      chat={<ChatPanel messages={messages} onSend={handleSend} loading={loading} />}
      shareUrl={shareUrl}
    />
  )
}
