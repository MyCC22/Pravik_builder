import { NextRequest, NextResponse } from 'next/server'
import { createChat } from '@/services/v0/platform'
import { getSupabaseClient } from '@/services/supabase/client'

export async function POST(req: NextRequest) {
  try {
    const { message, project_id } = await req.json()

    if (!message || !project_id) {
      return NextResponse.json({ error: 'Message and project_id required' }, { status: 400 })
    }

    // Create v0 chat
    const chat = await createChat(message)

    // Update project with v0 chat ID and preview URL
    const supabase = getSupabaseClient()
    await supabase
      .from('projects')
      .update({
        v0_chat_id: chat.id,
        preview_url: chat.demo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project_id)

    // Store message in our DB
    await supabase.from('messages').insert([
      { project_id, role: 'user', content: message },
      { project_id, role: 'assistant', content: `Preview ready: ${chat.demo}` },
    ])

    return NextResponse.json({ chat })
  } catch (error) {
    console.error('V0 chat error:', error)
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 })
  }
}
