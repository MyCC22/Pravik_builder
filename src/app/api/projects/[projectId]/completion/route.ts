import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/services/supabase/client'
import { getProjectCompletion } from '@/lib/services/completion'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const supabase = getSupabaseClient()
    const completion = await getProjectCompletion(supabase, projectId)

    return NextResponse.json({
      hasBlocks: completion.hasBlocks,
      hasBookingTool: completion.hasBookingTool,
      hasPhone: completion.hasPhone,
      hasForwardingPhone: completion.hasForwardingPhone,
    })
  } catch (error) {
    console.error('Completion check error:', error)
    return NextResponse.json(
      { hasBlocks: false, hasBookingTool: false, hasPhone: false, hasForwardingPhone: false },
      { status: 200 }
    )
  }
}
