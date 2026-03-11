import { redirect } from 'next/navigation'
import { getSupabaseClient } from '@/services/supabase/client'

export const dynamic = 'force-dynamic'

export default async function LinksPage() {
  const supabase = getSupabaseClient()

  // Find the most recent active call session (not ended)
  const { data: session } = await supabase
    .from('call_sessions')
    .select('project_id, call_sid, state, phone_number')
    .neq('state', 'ended')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // If there's an active call with a project, redirect to the builder
  if (session?.project_id) {
    redirect(`/build/${session.project_id}?session=${session.call_sid}`)
  }

  // Fallback: check the most recent call session (even if ended)
  const { data: recentSession } = await supabase
    .from('call_sessions')
    .select('project_id, call_sid')
    .not('project_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (recentSession?.project_id) {
    redirect(`/build/${recentSession.project_id}?session=${recentSession.call_sid}`)
  }

  // No active session at all
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-md px-6">
        <div className="text-4xl mb-4">📞</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          No active call
        </h1>
        <p className="text-slate-500">
          Call us to start building your website, then open this page to see it
          come to life in real-time.
        </p>
      </div>
    </div>
  )
}
