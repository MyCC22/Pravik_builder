import { getSupabaseClient } from '@/services/supabase/client'
import { getThemeCSS } from './themes'
import { renderTailwindShell } from './render'
import { getThemeClasses } from './theme-classes'

function isLegacyBlock(html: string): boolean {
  return html.includes('var(--') || (html.includes('style="') && !html.includes('class="'))
}

export async function renderFromBlocks(projectId: string): Promise<string | null> {
  const supabase = getSupabaseClient()

  const { data: blocks, error: blocksError } = await supabase
    .from('blocks')
    .select('html, position')
    .eq('project_id', projectId)
    .order('position', { ascending: true })

  if (blocksError || !blocks || blocks.length === 0) return null

  const { data: project } = await supabase
    .from('projects')
    .select('theme, name')
    .eq('id', projectId)
    .single()

  const themeId = project?.theme || 'clean'
  const siteName = project?.name || 'Website'
  const bodyHtml = blocks.map(b => b.html).join('\n')

  // Detect old inline-style blocks vs new Tailwind blocks
  const firstContentBlock = blocks.find(b => !b.html.trim().startsWith('<nav'))
  const legacy = firstContentBlock ? isLegacyBlock(firstContentBlock.html) : false

  if (legacy) {
    const themeCSS = getThemeCSS(themeId)
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${siteName}</title>
  <style>${themeCSS}</style>
</head>
<body>${bodyHtml}</body>
</html>`
  }

  const t = getThemeClasses(themeId as any)
  return renderTailwindShell(siteName, t.bg, bodyHtml)
}
