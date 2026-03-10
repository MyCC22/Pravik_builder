import { NextRequest, NextResponse } from 'next/server'
import { handleMessage } from '@/services/agents/orchestrator'
import { getSupabaseClient } from '@/services/supabase/client'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { message, project_id } = await req.json()

    if (!message || !project_id) {
      return NextResponse.json(
        { error: 'message and project_id required' },
        { status: 400 }
      )
    }

    // Run the multi-agent orchestrator
    const result = await handleMessage(message, project_id)

    const supabase = getSupabaseClient()

    // Store messages
    await supabase.from('messages').insert([
      { project_id, role: 'user', content: message },
      { project_id, role: 'assistant', content: result.message },
    ])

    const previewUrl = `/site/${project_id}`

    return NextResponse.json({
      action: result.action,
      message: result.message,
      question: result.question || null,
      previewUrl,
    })
  } catch (error) {
    console.error('Builder generate error:', error)
    return NextResponse.json(
      { error: 'Failed to generate website' },
      { status: 500 }
    )
  }
}
