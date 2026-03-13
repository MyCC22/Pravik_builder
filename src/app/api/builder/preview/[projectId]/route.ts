import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/services/supabase/client'
import { renderTemplate } from '@/templates/render'
import { renderFromBlocks } from '@/templates/render-blocks'

/** Never cache preview responses — refreshes must always show the latest build. */
const PREVIEW_HEADERS = {
  'Content-Type': 'text/html',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params

    // Try block-based rendering first
    const blockHtml = await renderFromBlocks(projectId)
    if (blockHtml) {
      return new NextResponse(blockHtml, { headers: PREVIEW_HEADERS })
    }

    // Fall back to old template_config rendering
    const supabase = getSupabaseClient()
    const { data: project, error } = await supabase
      .from('projects')
      .select('template_config')
      .eq('id', projectId)
      .single()

    if (error || !project?.template_config) {
      return new NextResponse(
        '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666"><p>No preview available yet. Send a message to get started.</p></body></html>',
        { headers: PREVIEW_HEADERS }
      )
    }

    const html = renderTemplate(project.template_config)

    return new NextResponse(html, { headers: PREVIEW_HEADERS })
  } catch (error) {
    console.error('Preview render error:', error)
    return new NextResponse(
      '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666"><p>Error rendering preview</p></body></html>',
      { status: 500, headers: PREVIEW_HEADERS }
    )
  }
}
