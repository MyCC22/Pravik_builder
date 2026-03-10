import { NextRequest, NextResponse } from 'next/server'
import { sendMessage } from '@/services/v0/platform'
import { getSupabaseClient } from '@/services/supabase/client'

export async function POST(req: NextRequest) {
  try {
    const { chat_id, message, project_id } = await req.json()

    if (!chat_id || !message || !project_id) {
      return NextResponse.json({ error: 'chat_id, message, and project_id required' }, { status: 400 })
    }

    // Send message to v0
    const chat = await sendMessage(chat_id, message)

    // Update preview URL
    const supabase = getSupabaseClient()
    await supabase
      .from('projects')
      .update({
        preview_url: chat.demo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project_id)

    // Store messages
    await supabase.from('messages').insert([
      { project_id, role: 'user', content: message },
      { project_id, role: 'assistant', content: `Updated preview: ${chat.demo}` },
    ])

    return NextResponse.json({ chat })
  } catch (error) {
    console.error('V0 message error:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
