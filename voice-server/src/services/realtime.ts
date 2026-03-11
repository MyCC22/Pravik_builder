import { getSupabaseClient } from './supabase.js'
import type { RealtimeChannel } from '@supabase/supabase-js'

const channels = new Map<string, RealtimeChannel>()

export function getCallChannel(callSid: string): RealtimeChannel {
  const existing = channels.get(callSid)
  if (existing) return existing

  const supabase = getSupabaseClient()
  const channel = supabase.channel(`call:${callSid}`)
  channels.set(callSid, channel)
  return channel
}

export async function subscribeToCallChannel(
  callSid: string,
  onPageOpened: () => void
): Promise<RealtimeChannel> {
  const channel = getCallChannel(callSid)

  channel
    .on('broadcast', { event: 'page_opened' }, () => {
      console.log(`[${callSid}] Page opened event received`)
      onPageOpened()
    })
    .subscribe((status) => {
      console.log(`[${callSid}] Realtime channel status: ${status}`)
    })

  return channel
}

export async function broadcastPreviewUpdate(
  callSid: string,
  payload: {
    action: string
    message: string
    projectId: string
  }
): Promise<void> {
  const channel = getCallChannel(callSid)
  await channel.send({
    type: 'broadcast',
    event: 'preview_updated',
    payload: {
      ...payload,
      timestamp: Date.now(),
    },
  })
}

export async function broadcastVoiceMessage(
  callSid: string,
  payload: {
    role: 'user' | 'assistant'
    content: string
  }
): Promise<void> {
  const channel = getCallChannel(callSid)
  await channel.send({
    type: 'broadcast',
    event: 'voice_message',
    payload: {
      ...payload,
      timestamp: Date.now(),
    },
  })
}

export async function broadcastCallEnded(callSid: string): Promise<void> {
  const channel = getCallChannel(callSid)
  await channel.send({
    type: 'broadcast',
    event: 'call_ended',
    payload: { timestamp: Date.now() },
  })
}

export function cleanupChannel(callSid: string): void {
  const channel = channels.get(callSid)
  if (channel) {
    const supabase = getSupabaseClient()
    supabase.removeChannel(channel)
    channels.delete(callSid)
  }
}
