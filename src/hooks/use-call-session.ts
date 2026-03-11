'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getSupabaseBrowser } from '@/services/supabase/browser'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface VoiceMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface UseCallSessionReturn {
  isVoiceCall: boolean
  callActive: boolean
  voiceMessages: VoiceMessage[]
  onPreviewUpdate: (() => void) | null
}

export function useCallSession(
  callSid: string | null,
  onRefreshPreview?: () => void
): UseCallSessionReturn {
  const [callActive, setCallActive] = useState(!!callSid)
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)

  const handlePreviewUpdate = useCallback(() => {
    onRefreshPreview?.()
  }, [onRefreshPreview])

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
      .on('broadcast', { event: 'call_ended' }, () => {
        setCallActive(false)
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [callSid, handlePreviewUpdate])

  return {
    isVoiceCall: !!callSid,
    callActive,
    voiceMessages,
    onPreviewUpdate: callSid ? handlePreviewUpdate : null,
  }
}
