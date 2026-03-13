import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/services/supabase/client'
import { getProjectCompletion, completionToSteps } from '@/lib/services/completion'

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

    // 3. Get completion state via shared service
    const completion = await getProjectCompletion(supabase, session.project_id)
    const completedSteps = completionToSteps(completion)

    return NextResponse.json({
      projectId: session.project_id,
      projectName: completion.name,
      state: session.state,
      completedSteps,
      lastEditTimestamp: completion.updatedAt ? new Date(completion.updatedAt).getTime() : null,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('State reconciliation error:', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
