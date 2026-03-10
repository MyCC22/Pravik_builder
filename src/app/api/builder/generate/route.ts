import { NextRequest, NextResponse } from 'next/server'
import { pickTemplate } from '@/services/ai/template-picker'
import { getSupabaseClient } from '@/services/supabase/client'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { message, project_id } = await req.json()

    if (!message || !project_id) {
      return NextResponse.json(
        { error: 'message and project_id required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Load current config (null for new projects)
    const { data: project } = await supabase
      .from('projects')
      .select('template_config')
      .eq('id', project_id)
      .single()

    const currentConfig = project?.template_config ?? null

    // Call Claude Haiku
    const config = await pickTemplate(message, currentConfig)

    // Store updated config and preview URL
    const previewUrl = `/site/${project_id}`
    await supabase
      .from('projects')
      .update({
        template_config: config,
        preview_url: previewUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project_id)

    // Store messages
    const isUpdate = !!currentConfig
    const templateLabel = config.template.replace(/-/g, ' ')
    const assistantContent = isUpdate
      ? `Updated your website with the requested changes.`
      : `Created your website using the ${templateLabel} template with the ${config.theme} theme.`

    await supabase.from('messages').insert([
      { project_id, role: 'user', content: message },
      { project_id, role: 'assistant', content: assistantContent },
    ])

    return NextResponse.json({ config, previewUrl, isUpdate })
  } catch (error) {
    console.error('Builder generate error:', error)
    return NextResponse.json(
      { error: 'Failed to generate website' },
      { status: 500 }
    )
  }
}
