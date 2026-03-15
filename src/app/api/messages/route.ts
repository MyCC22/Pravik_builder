import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/services/supabase/client'

/**
 * GET /api/messages
 *
 * Aggregated caller messages across all of a user's projects.
 * Uses exactly 3 queries regardless of project count:
 *   1. projects WHERE user_id = ?
 *   2. tools WHERE project_id IN (...) AND tool_type = 'after_hours_ai'
 *   3. tool_submissions WHERE tool_id IN (...) ORDER BY created_at DESC
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 })
    }

    const supabase = getSupabaseClient()

    // Query 1: All user's projects (id + name only)
    const { data: projects, error: projError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('user_id', userId)

    if (projError || !projects || projects.length === 0) {
      return NextResponse.json({ messages: [] })
    }

    const projectIds = projects.map((p) => p.id)
    const projectMap = new Map(projects.map((p) => [p.id, p.name]))

    // Query 2: All after_hours_ai tools for those projects
    const { data: tools, error: toolError } = await supabase
      .from('tools')
      .select('id, project_id')
      .in('project_id', projectIds)
      .eq('tool_type', 'after_hours_ai')

    if (toolError || !tools || tools.length === 0) {
      return NextResponse.json({ messages: [] })
    }

    const toolIds = tools.map((t) => t.id)
    const toolToProject = new Map(tools.map((t) => [t.id, t.project_id]))

    // Query 3: All submissions for those tools, newest first
    const { data: submissions, error: subError } = await supabase
      .from('tool_submissions')
      .select('id, tool_id, data, created_at')
      .in('tool_id', toolIds)
      .order('created_at', { ascending: false })
      .limit(200)

    if (subError) {
      console.error('Aggregated messages fetch error:', subError)
      return NextResponse.json({ messages: [] })
    }

    // Join in app code via Maps: toolId → projectId → projectName
    const messages = (submissions || []).map((sub) => {
      const projectId = toolToProject.get(sub.tool_id) || ''
      return {
        id: sub.id,
        projectId,
        projectName: projectMap.get(projectId) || 'Unknown Project',
        callerName: sub.data?.caller_name || 'Unknown',
        callerPhone: sub.data?.caller_phone || '',
        reason: sub.data?.reason || '',
        calledAt: sub.data?.called_at || sub.created_at,
        callSid: sub.data?.call_sid || '',
      }
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Aggregated messages API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}
