import { NextRequest, NextResponse } from 'next/server'
import { handleMessage } from '@/services/agents/orchestrator'
import { getSupabaseClient } from '@/services/supabase/client'

export const maxDuration = 60

// In-memory lock to prevent concurrent generation for the same project
const activeGenerations = new Set<string>()

export async function POST(req: NextRequest) {
  let projectId: string | undefined

  try {
    const { message, project_id, image_urls: imageUrls } = await req.json()
    projectId = project_id

    if (!message || !project_id) {
      return NextResponse.json(
        { error: 'message and project_id required' },
        { status: 400 }
      )
    }

    // Idempotency: reject if this project is already being generated
    if (activeGenerations.has(project_id)) {
      return NextResponse.json(
        { error: 'Generation already in progress for this project' },
        { status: 409 }
      )
    }
    activeGenerations.add(project_id)

    try {
      const supabase = getSupabaseClient()

      // Load recent conversation history for context
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('role, content')
        .eq('project_id', project_id)
        .order('created_at', { ascending: false })
        .limit(10)

      // Reverse to chronological order (DB returns newest first)
      const history = (recentMessages || []).reverse().map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content as string,
      }))

      // Run the multi-agent orchestrator (pass image_urls and history)
      const result = await handleMessage(message, project_id, imageUrls, history)

      // Store messages (include image_urls if present)
      await supabase.from('messages').insert([
        {
          project_id,
          role: 'user',
          content: message,
          ...(imageUrls?.length ? { image_urls: imageUrls } : {}),
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
    } finally {
      activeGenerations.delete(project_id)
    }
  } catch (error) {
    console.error('Builder generate error:', error)
    return NextResponse.json(
      { error: 'Failed to generate website' },
      { status: 500 }
    )
  }
}
