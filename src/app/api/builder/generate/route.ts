import { NextRequest, NextResponse } from 'next/server'
import { handleMessage } from '@/services/agents/orchestrator'
import { getSupabaseClient } from '@/services/supabase/client'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { message, project_id, image_urls } = await req.json()

    if (!message || !project_id) {
      return NextResponse.json(
        { error: 'message and project_id required' },
        { status: 400 }
      )
    }

    // Run the multi-agent orchestrator (pass image_urls if present)
    const result = await handleMessage(message, project_id, image_urls)

    const supabase = getSupabaseClient()

    // Store messages (include image_urls if present)
    await supabase.from('messages').insert([
      {
        project_id,
        role: 'user',
        content: message,
        ...(image_urls?.length ? { image_urls } : {}),
      },
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
