import { redirect } from 'next/navigation'
import { getSupabaseClient } from '@/services/supabase/client'
import { VoiceDashboard } from '@/features/voice-dashboard/voice-dashboard'

export const dynamic = 'force-dynamic'

interface ProjectWithBlocks {
  id: string
  name: string
  source: string | null
  created_at: string
  updated_at: string
  template_config?: {
    theme?: string
    content?: {
      siteName?: string
      businessCategory?: string
    }
  } | null
}

export default async function LinksPage() {
  const supabase = getSupabaseClient()

  // Find the most recent active call session (not ended)
  const { data: session } = await supabase
    .from('call_sessions')
    .select('project_id, call_sid, state, phone_number, user_id')
    .neq('state', 'ended')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!session) {
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
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center max-w-md px-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </div>
          <h1 className="text-lg font-medium text-white/90 mb-1.5">
            No active call
          </h1>
          <p className="text-sm text-white/40 leading-relaxed">
            Call us to start building your website, then open this page to see it come to life.
          </p>
        </div>
      </div>
    )
  }

  // Active call found — check if user has multiple projects
  const userId = session.user_id
  const callSid = session.call_sid

  // If there's already a project assigned, check if user has multiple projects
  // to decide between dashboard vs direct redirect
  const { data: allProjects } = await supabase
    .from('projects')
    .select('id, name, source, created_at, updated_at, template_config')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  // Filter to projects that have at least one block (actual built sites)
  const projectsWithContent: ProjectWithBlocks[] = []
  for (const proj of (allProjects || []).slice(0, 20)) {
    const { count } = await supabase
      .from('blocks')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', proj.id)

    if (count && count > 0) {
      projectsWithContent.push(proj)
    }
  }

  // 0 or 1 content projects → redirect directly to builder (no dashboard needed)
  if (projectsWithContent.length <= 1) {
    const targetProjectId = session.project_id || projectsWithContent[0]?.id
    if (targetProjectId) {
      redirect(`/build/${targetProjectId}?session=${callSid}`)
    }

    // No project yet (new user, project not created yet) — redirect once it's assigned
    // For now, show a waiting state that will auto-redirect via realtime
    return (
      <VoiceDashboard
        projects={[]}
        callSid={callSid}
        activeProjectId={null}
      />
    )
  }

  // 2+ content projects → show the dashboard
  return (
    <VoiceDashboard
      projects={projectsWithContent}
      callSid={callSid}
      activeProjectId={session.project_id}
    />
  )
}
