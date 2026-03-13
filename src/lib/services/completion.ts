import type { SupabaseClient } from '@supabase/supabase-js'

export interface ProjectCompletion {
  name: string | null
  hasBlocks: boolean
  hasBookingTool: boolean
  hasPhone: boolean
  hasForwardingPhone: boolean
  updatedAt: string | null
}

/**
 * Single source of truth for project completion state.
 * Used by both /api/projects/[id]/completion and /api/voice/state/[callSid].
 */
export async function getProjectCompletion(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectCompletion> {
  const [blocksResult, toolsResult, projectResult] = await Promise.all([
    supabase
      .from('blocks')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId),
    supabase
      .from('tools')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('tool_type', 'booking'),
    supabase
      .from('projects')
      .select('name, provisioned_phone, forwarding_phone, updated_at')
      .eq('id', projectId)
      .single(),
  ])

  const project = projectResult.data
  return {
    name: project?.name ?? null,
    hasBlocks: (blocksResult.count ?? 0) > 0,
    hasBookingTool: (toolsResult.count ?? 0) > 0,
    hasPhone: !!project?.provisioned_phone,
    hasForwardingPhone: !!project?.forwarding_phone,
    updatedAt: project?.updated_at ?? null,
  }
}

/**
 * Convert completion state to an array of step IDs.
 */
export function completionToSteps(completion: ProjectCompletion): string[] {
  const steps: string[] = []
  if (completion.hasBlocks) steps.push('build_site')
  if (completion.hasBookingTool) steps.push('contact_form')
  if (completion.hasPhone) steps.push('phone_number')
  if (completion.hasForwardingPhone) steps.push('call_forwarding')
  return steps
}
