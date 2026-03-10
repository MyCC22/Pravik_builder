import { getSupabaseClient } from '@/services/supabase/client'
import { renderTemplate } from '@/templates/render'

export default async function SitePage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = getSupabaseClient()
  const { data: project } = await supabase
    .from('projects')
    .select('template_config, name')
    .eq('id', projectId)
    .single()

  if (!project?.template_config) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'sans-serif',
        color: '#666',
      }}>
        <p>Site not found or not yet built.</p>
      </div>
    )
  }

  const html = renderTemplate(project.template_config)

  return (
    <iframe
      srcDoc={html}
      style={{ width: '100%', height: '100vh', border: 'none' }}
      title={project.name || 'Website'}
    />
  )
}
