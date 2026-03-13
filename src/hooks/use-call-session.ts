'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getSupabaseBrowser } from '@/services/supabase/browser'
import type { RealtimeChannel } from '@supabase/supabase-js'
import {
  CALL_EVENTS,
  WEB_ACTION_TYPES,
  type VoiceMessagePayload,
  type ProjectSelectedPayload,
  type StepCompletedPayload,
  type WebActionType,
} from '@/lib/events/call-events'

export interface UseCallSessionReturn {
  isVoiceCall: boolean
  callActive: boolean
  voiceMessages: VoiceMessagePayload[]
  onPreviewUpdate: (() => void) | null
  broadcastWebAction: ((actionType: WebActionType, data: Record<string, unknown>) => void) | null
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
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessagePayload[]>([])
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
      .on('broadcast', { event: CALL_EVENTS.PREVIEW_UPDATED }, (payload) => {
        console.log('Preview updated:', payload)
        handlePreviewUpdate()
      })
      .on('broadcast', { event: CALL_EVENTS.VOICE_MESSAGE }, (payload) => {
        const msg = payload.payload as VoiceMessagePayload
        setVoiceMessages((prev) => [...prev, msg])
      })
      .on('broadcast', { event: CALL_EVENTS.PROJECT_SELECTED }, (payload) => {
        const { projectId } = payload.payload as ProjectSelectedPayload
        if (projectId) {
          console.log(`Project switched to: ${projectId}`)
          optionsRef.current?.onProjectSwitched?.(projectId)
        }
      })
      .on('broadcast', { event: CALL_EVENTS.CALL_ENDED }, () => {
        setCallActive(false)
      })
      // Action steps menu events
      .on('broadcast', { event: CALL_EVENTS.OPEN_ACTION_MENU }, () => {
        console.log('Action menu: open')
        optionsRef.current?.onActionMenuOpen?.()
      })
      .on('broadcast', { event: CALL_EVENTS.CLOSE_ACTION_MENU }, () => {
        console.log('Action menu: close')
        optionsRef.current?.onActionMenuClose?.()
      })
      .on('broadcast', { event: CALL_EVENTS.STEP_COMPLETED }, (payload) => {
        const { stepId } = payload.payload as StepCompletedPayload
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
    (actionType: WebActionType, data: Record<string, unknown>) => {
      if (!channelRef.current) return
      channelRef.current.send({
        type: 'broadcast',
        event: CALL_EVENTS.WEB_ACTION,
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
