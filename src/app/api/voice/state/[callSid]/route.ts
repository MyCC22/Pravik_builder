import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/services/supabase/client'

/**
 * State reconciliation endpoint.
 *
 * Returns the ground truth from the database so the frontend can
 * reconcile its React state (completedSteps, projectId) during an
 * active voice call. Called every 10 seconds by the frontend and
 * on page reload / tab focus.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ callSid: string }> }
) {
  try {
    const { callSid } = await params
    const supabase = getSupabaseClient()

    // 1. Look up the call session
    const { data: session } = await supabase
      .from('call_sessions')
      .select('project_id, state')
      .eq('call_sid', callSid)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    // 2. If no project yet, return early with empty steps
    if (!session.project_id) {
      return NextResponse.json({
        projectId: null,
        projectName: null,
        state: session.state,
        completedSteps: [],
        timestamp: Date.now(),
      })
    }

    // 3. Query project details + completion state in parallel
    const [projectResult, blocksResult, toolsResult] = await Promise.all([
      supabase
        .from('projects')
        .select('name, provisioned_phone, forwarding_phone')
        .eq('id', session.project_id)
        .single(),
      supabase
        .from('blocks')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', session.project_id),
      supabase
        .from('tools')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', session.project_id)
        .eq('tool_type', 'booking'),
    ])

    const project = projectResult.data
    const completedSteps: string[] = []

    if ((blocksResult.count ?? 0) > 0) completedSteps.push('build_site')
    if ((toolsResult.count ?? 0) > 0) completedSteps.push('contact_form')
    if (project?.provisioned_phone) completedSteps.push('phone_number')
    if (project?.forwarding_phone) completedSteps.push('call_forwarding')

    return NextResponse.json({
      projectId: session.project_id,
      projectName: project?.name ?? null,
      state: session.state,
      completedSteps,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('State reconciliation error:', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
