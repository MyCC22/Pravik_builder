import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/services/supabase/client'
import { renderTemplate } from '@/templates/render'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params

    const supabase = getSupabaseClient()
    const { data: project, error } = await supabase
      .from('projects')
      .select('template_config')
      .eq('id', projectId)
      .single()

    if (error || !project?.template_config) {
      return new NextResponse(
        '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666"><p>No preview available yet. Send a message to get started.</p></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    const html = renderTemplate(project.template_config)

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    })
  } catch (error) {
    console.error('Preview render error:', error)
    return new NextResponse(
      '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666"><p>Error rendering preview</p></body></html>',
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    )
  }
}
