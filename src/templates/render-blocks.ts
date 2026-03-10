import { getSupabaseClient } from '@/services/supabase/client'
import { getThemeCSS } from './themes'
import type { ThemeId } from './types'
import { THEME_IDS } from './types'

export async function renderFromBlocks(projectId: string): Promise<string | null> {
  const supabase = getSupabaseClient()

  // Load blocks ordered by position
  const { data: blocks, error: blocksError } = await supabase
    .from('blocks')
    .select('html, position')
    .eq('project_id', projectId)
    .order('position', { ascending: true })

  if (blocksError || !blocks || blocks.length === 0) {
    return null
  }

  // Load project theme
  const { data: project } = await supabase
    .from('projects')
    .select('theme, name')
    .eq('id', projectId)
    .single()

  const themeId: ThemeId = THEME_IDS.includes(project?.theme as ThemeId)
    ? (project!.theme as ThemeId)
    : 'ocean'
  const siteName = project?.name || 'Website'

  const themeCSS = getThemeCSS(themeId)
  const bodyHtml = blocks.map(b => b.html).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${siteName}</title>
  <style>${themeCSS}</style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`
}
