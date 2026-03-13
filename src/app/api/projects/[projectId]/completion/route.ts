import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/services/supabase/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const supabase = getSupabaseClient()

    // Check if project has any blocks
    const { count: blocksCount } = await supabase
      .from('blocks')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)

    // Check if project has a booking tool
    const { count: bookingCount } = await supabase
      .from('tools')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('tool_type', 'booking')

    // Check if project has a provisioned phone
    const { data: project } = await supabase
      .from('projects')
      .select('provisioned_phone')
      .eq('id', projectId)
      .single()

    return NextResponse.json({
      hasBlocks: (blocksCount ?? 0) > 0,
      hasBookingTool: (bookingCount ?? 0) > 0,
      hasPhone: !!project?.provisioned_phone,
    })
  } catch (error) {
    console.error('Completion check error:', error)
    return NextResponse.json(
      { hasBlocks: false, hasBookingTool: false, hasPhone: false },
      { status: 200 } // Graceful degradation — return empty state, not error
    )
  }
}
