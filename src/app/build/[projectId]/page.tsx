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
  const [chatId, setChatId] = useState<string | null>(null)

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
          setPreviewUrl(proj.preview_url)
          setChatId(proj.v0_chat_id)
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
        let result

        if (!chatId) {
          const res = await fetch('/api/v0/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, project_id: projectId }),
          })
          result = await res.json()
          setChatId(result.chat?.id)
        } else {
          const res = await fetch('/api/v0/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message,
              project_id: projectId,
            }),
          })
          result = await res.json()
        }

        if (result.chat?.demo) {
          setPreviewUrl(result.chat.demo)
        }

        const assistantMsg: Message = {
          id: `temp-assistant-${Date.now()}`,
          project_id: projectId,
          role: 'assistant',
          content: 'Preview updated',
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
    [projectId, chatId]
  )

  return (
    <BuilderLayout
      preview={<PreviewPanel url={previewUrl} loading={loading} />}
      chat={<ChatPanel messages={messages} onSend={handleSend} loading={loading} />}
    />
  )
}
