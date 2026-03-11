import { getSupabaseClient } from '@/services/supabase/client'
import { getThemeClasses } from '@/templates/theme-classes'
import type { ThemeId } from '@/templates/types'
import type { ToolConfig } from '@/services/agents/types'
import { BookingPage } from '@/features/booking/booking-page'

export default async function BookPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = getSupabaseClient()

  // Load project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('name, theme')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Page not found</h1>
          <p className="text-slate-500">This page doesn&apos;t exist.</p>
        </div>
      </div>
    )
  }

  // Load tool — use limit(1) + order to get the latest one
  // (.single() errors when duplicate tools exist from clone + regenerate)
  const { data: tools, error: toolError } = await supabase
    .from('tools')
    .select('id, config, is_active')
    .eq('project_id', projectId)
    .eq('tool_type', 'booking')
    .order('created_at', { ascending: false })
    .limit(1)

  const tool = tools?.[0] || null

  if (toolError || !tool) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">No booking form yet</h1>
          <p className="text-slate-500">A booking form hasn&apos;t been set up for this site yet.</p>
        </div>
      </div>
    )
  }

  if (!tool.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Form unavailable</h1>
          <p className="text-slate-500">This form is currently unavailable.</p>
        </div>
      </div>
    )
  }

  const config = tool.config as ToolConfig

  if (!config.fields || !Array.isArray(config.fields) || config.fields.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Coming soon</h1>
          <p className="text-slate-500">This form is being set up. Please check back soon.</p>
        </div>
      </div>
    )
  }

  const themeId = (project.theme || 'clean') as ThemeId
  const theme = getThemeClasses(themeId)
  const siteName = project.name || 'Website'

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <style>{`body { font-family: 'Inter', system-ui, sans-serif; margin: 0; }`}</style>
      <BookingPage
        toolId={tool.id}
        config={config}
        siteName={siteName}
        theme={theme}
      />
    </>
  )
}
