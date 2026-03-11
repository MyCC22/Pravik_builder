import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/services/supabase/client'

export async function POST(req: NextRequest) {
  try {
    const { callSid } = await req.json()

    if (!callSid) {
      return NextResponse.json({ error: 'callSid required' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    // Update call session
    await supabase
      .from('call_sessions')
      .update({
        page_opened: true,
        page_opened_at: new Date().toISOString(),
      })
      .eq('call_sid', callSid)

    // Broadcast page_opened event via Supabase Realtime
    const channel = supabase.channel(`call:${callSid}`)
    await channel.send({
      type: 'broadcast',
      event: 'page_opened',
      payload: { timestamp: Date.now() },
    })

    // Clean up the channel after broadcasting
    supabase.removeChannel(channel)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Page opened error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
