import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/services/supabase/client'

/**
 * GET /api/projects/[projectId]/messages
 *
 * Fetches caller messages left by the after-hours AI assistant.
 * These are stored as tool_submissions for the project's after_hours_ai tool.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const supabase = getSupabaseClient()

    // Find the after_hours_ai tool for this project
    const { data: ahTools, error: toolError } = await supabase
      .from('tools')
      .select('id')
      .eq('project_id', projectId)
      .eq('tool_type', 'after_hours_ai')
      .limit(1)

    const ahTool = ahTools?.[0] ?? null

    if (toolError || !ahTool) {
      // No after-hours AI configured — return empty array
      return NextResponse.json({ messages: [] })
    }

    // Fetch submissions (caller messages) for this tool
    const { data: submissions, error: subError } = await supabase
      .from('tool_submissions')
      .select('id, data, created_at')
      .eq('tool_id', ahTool.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (subError) {
      console.error('Messages fetch error:', subError)
      return NextResponse.json({ messages: [] }, { status: 200 })
    }

    // Transform to a clean message format
    const messages = (submissions || []).map((sub) => ({
      id: sub.id,
      callerName: sub.data?.caller_name || 'Unknown',
      callerPhone: sub.data?.caller_phone || '',
      reason: sub.data?.reason || '',
      calledAt: sub.data?.called_at || sub.created_at,
      callSid: sub.data?.call_sid || '',
    }))

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Messages API error:', error)
    return NextResponse.json({ messages: [] }, { status: 200 })
  }
}
