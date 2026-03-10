import { getSupabaseClient } from '@/services/supabase/client'
import { routeIntent } from './router'
import { generateSite } from './generator'
import { editBlock, addBlock } from './block-editor'
import { pickTheme } from './theme-agent'
import type { Block, AgentResponse } from './types'

export async function handleMessage(
  message: string,
  projectId: string
): Promise<AgentResponse> {
  const supabase = getSupabaseClient()

  // Load current blocks and theme
  const { data: blocks } = await supabase
    .from('blocks')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true })

  const { data: project } = await supabase
    .from('projects')
    .select('theme')
    .eq('id', projectId)
    .single()

  const currentBlocks: Block[] = (blocks as Block[]) || []
  const currentTheme = project?.theme || null

  // If no blocks exist, skip router and generate directly
  if (currentBlocks.length === 0) {
    const result = await generateSite(message, projectId)
    const blockTypes = result.blocks.map(b => b.block_type).join(', ')
    return {
      action: 'generated',
      message: `Your website is ready! I created sections: ${blockTypes} with the ${result.theme} theme.`,
    }
  }

  // Route the intent
  const route = await routeIntent(message, currentBlocks, currentTheme)

  switch (route.intent) {
    case 'generate_site': {
      // Delete existing blocks, then regenerate
      await supabase.from('blocks').delete().eq('project_id', projectId)
      const result = await generateSite(message, projectId)
      const blockTypes = result.blocks.map(b => b.block_type).join(', ')
      return {
        action: 'generated',
        message: `Rebuilt your website! Sections: ${blockTypes} with the ${result.theme} theme.`,
      }
    }

    case 'edit_block': {
      const targetType = route.target_blocks[0]
      const targetBlock = currentBlocks.find(b => b.block_type === targetType)

      if (!targetBlock) {
        return {
          action: 'clarify',
          message: `I couldn't find a "${targetType}" section on your site. Would you like me to add one instead?`,
          question: `I couldn't find a "${targetType}" section. Would you like me to add one?`,
        }
      }

      const allBlockTypes = currentBlocks.map(b => b.block_type)
      const updatedHtml = await editBlock(targetBlock, message, allBlockTypes)

      await supabase
        .from('blocks')
        .update({ html: updatedHtml, updated_at: new Date().toISOString() })
        .eq('id', targetBlock.id)

      return {
        action: 'edited',
        message: `Done! I updated the ${targetType} section with your changes.`,
      }
    }

    case 'add_block': {
      const newType = route.target_blocks[0] || 'custom'
      const position = route.position ?? currentBlocks.length
      const allBlockTypes = currentBlocks.map(b => b.block_type)

      await addBlock(projectId, newType, message, position, allBlockTypes)

      return {
        action: 'edited',
        message: `Done! I added a new ${newType} section to your website.`,
      }
    }

    case 'remove_block': {
      const removeType = route.target_blocks[0]
      const removeBlock = currentBlocks.find(b => b.block_type === removeType)

      if (!removeBlock) {
        return {
          action: 'clarify',
          message: `I couldn't find a "${removeType}" section to remove. Your site has: ${currentBlocks.map(b => b.block_type).join(', ')}`,
          question: `Which section would you like to remove?`,
        }
      }

      await supabase.from('blocks').delete().eq('id', removeBlock.id)

      return {
        action: 'removed',
        message: `Done! I removed the ${removeType} section from your website.`,
      }
    }

    case 'reorder_blocks': {
      return {
        action: 'reordered',
        message: `I'll reorder the sections as requested. (Reordering is coming soon — for now, you can remove and re-add sections in the order you want.)`,
      }
    }

    case 'change_theme': {
      const themeResult = await pickTheme(message, currentTheme)

      await supabase
        .from('projects')
        .update({ theme: themeResult.theme, updated_at: new Date().toISOString() })
        .eq('id', projectId)

      return {
        action: 'theme_changed',
        message: `Done! Switched to the ${themeResult.theme} theme — ${themeResult.description}`,
      }
    }

    case 'clarify': {
      return {
        action: 'clarify',
        message: route.question || route.description,
        question: route.question || route.description,
      }
    }

    default: {
      return {
        action: 'clarify',
        message: "I'm not sure what you'd like me to do. Could you describe the change you want?",
        question: "Could you describe the change you want?",
      }
    }
  }
}
