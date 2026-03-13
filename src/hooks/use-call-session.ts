'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getSupabaseBrowser } from '@/services/supabase/browser'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface VoiceMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface UseCallSessionReturn {
  isVoiceCall: boolean
  callActive: boolean
  voiceMessages: VoiceMessage[]
  onPreviewUpdate: (() => void) | null
  broadcastWebAction: ((actionType: string, data: Record<string, unknown>) => void) | null
}

export interface UseCallSessionOptions {
  onRefreshPreview?: () => void
  onProjectSwitched?: (projectId: string) => void
  onActionMenuOpen?: () => void
  onActionMenuClose?: () => void
  onStepCompleted?: (stepId: string) => void
}

export function useCallSession(
  callSid: string | null,
  options?: UseCallSessionOptions,
): UseCallSessionReturn {
  const [callActive, setCallActive] = useState(!!callSid)
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Store options in a ref so the channel subscription doesn't re-run when callbacks change
  const optionsRef = useRef(options)
  optionsRef.current = options

  const handlePreviewUpdate = useCallback(() => {
    setTimeout(() => {
      optionsRef.current?.onRefreshPreview?.()
    }, 500)
  }, [])

  useEffect(() => {
    if (!callSid) return

    const supabase = getSupabaseBrowser()
    const channel = supabase.channel(`call:${callSid}`)

    channel
      .on('broadcast', { event: 'preview_updated' }, (payload) => {
        console.log('Preview updated:', payload)
        handlePreviewUpdate()
      })
      .on('broadcast', { event: 'voice_message' }, (payload) => {
        const msg = payload.payload as VoiceMessage
        setVoiceMessages((prev) => [...prev, msg])
      })
      .on('broadcast', { event: 'project_selected' }, (payload) => {
        const projectId = payload.payload?.projectId
        if (projectId) {
          console.log(`Project switched to: ${projectId}`)
          optionsRef.current?.onProjectSwitched?.(projectId)
        }
      })
      .on('broadcast', { event: 'call_ended' }, () => {
        setCallActive(false)
      })
      // Action steps menu events
      .on('broadcast', { event: 'open_action_menu' }, () => {
        console.log('Action menu: open')
        optionsRef.current?.onActionMenuOpen?.()
      })
      .on('broadcast', { event: 'close_action_menu' }, () => {
        console.log('Action menu: close')
        optionsRef.current?.onActionMenuClose?.()
      })
      .on('broadcast', { event: 'step_completed' }, (payload) => {
        const stepId = payload.payload?.stepId
        if (stepId) {
          console.log(`Step completed: ${stepId}`)
          optionsRef.current?.onStepCompleted?.(stepId)
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to call:${callSid} channel`)
        }
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [callSid, handlePreviewUpdate])

  const broadcastWebAction = useCallback(
    (actionType: string, data: Record<string, unknown>) => {
      if (!channelRef.current) return
      channelRef.current.send({
        type: 'broadcast',
        event: 'web_action',
        payload: { actionType, ...data },
      })
    },
    []
  )

  return {
    isVoiceCall: !!callSid,
    callActive,
    voiceMessages,
    onPreviewUpdate: callSid ? handlePreviewUpdate : null,
    broadcastWebAction: callSid ? broadcastWebAction : null,
  }
}
