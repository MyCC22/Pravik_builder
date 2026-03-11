import { broadcastPreviewUpdate } from '../services/realtime.js'

export interface BuildResult {
  action: string
  message: string
  question?: string
}

export async function executeBuildCommand(
  command: string,
  projectId: string,
  callSid: string
): Promise<BuildResult> {
  const builderUrl = process.env.BUILDER_API_URL || 'https://pravik-builder.vercel.app'

  console.log(`[${callSid}] Executing build command: ${command}`)

  const response = await fetch(`${builderUrl}/api/builder/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: command,
      project_id: projectId,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[${callSid}] Builder API error: ${response.status} ${errorText}`)
    throw new Error(`Builder API returned ${response.status}`)
  }

  const result = await response.json() as BuildResult & { error?: string }

  console.log(`[${callSid}] Build result: action=${result.action}, message=${result.message}`)

  // Broadcast preview update to the browser via Supabase Realtime
  if (result.action !== 'clarify') {
    await broadcastPreviewUpdate(callSid, {
      action: result.action,
      message: result.message,
      projectId,
    })
  }

  return {
    action: result.action,
    message: result.message,
    question: result.question,
  }
}

export async function getCurrentSiteState(projectId: string): Promise<{
  blocks: string[]
  theme: string | null
}> {
  // Fetch current blocks and theme from Supabase directly
  // (This avoids needing a special API endpoint)
  const { getSupabaseClient } = await import('../services/supabase.js')
  const supabase = getSupabaseClient()

  const [blocksResult, projectResult] = await Promise.all([
    supabase
      .from('blocks')
      .select('block_type')
      .eq('project_id', projectId)
      .order('position', { ascending: true }),
    supabase
      .from('projects')
      .select('theme')
      .eq('id', projectId)
      .single(),
  ])

  return {
    blocks: (blocksResult.data || []).map((b: { block_type: string }) => b.block_type),
    theme: projectResult.data?.theme || null,
  }
}
