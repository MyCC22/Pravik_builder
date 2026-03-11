import { getSupabaseClient } from '@/services/supabase/client'
import { createClient } from '@supabase/supabase-js'
import { routeIntent } from './router'
import { generateSite } from './generator'
import { editBlock, addBlock } from './block-editor'
import { pickTheme } from './theme-agent'
import { generateBookingTool } from './tool-generator'
import { editToolConfig } from './tool-editor'
import type { Block, AgentResponse, ToolConfig } from './types'

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

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

    // Auto-generate booking tool
    const templateType = result.config.template || 'landing'
    const toolConfig = await generateBookingTool(message, projectId, templateType)

    if (toolConfig) {
      // Wire CTA buttons to booking page
      const updatedContent = { ...result.config.content, bookingUrl: `/book/${projectId}`, bookingText: toolConfig.submitText }
      const updatedConfig = { ...result.config, content: updatedContent }
      await supabase
        .from('projects')
        .update({ template_config: updatedConfig, updated_at: new Date().toISOString() })
        .eq('id', projectId)
    }

    return {
      action: 'generated',
      message: `Your website is ready! I created sections: ${blockTypes} with the ${result.theme} theme.${toolConfig ? ` A booking form is live at /book/${projectId}` : ''}`,
    }
  }

  // Route the intent
  const route = await routeIntent(message, currentBlocks, currentTheme)

  switch (route.intent) {
    case 'generate_site': {
      // Delete existing blocks and tools, then regenerate
      await supabase.from('blocks').delete().eq('project_id', projectId)
      await supabase.from('tools').delete().eq('project_id', projectId)
      const result = await generateSite(message, projectId)
      const blockTypes = result.blocks.map(b => b.block_type).join(', ')

      // Auto-generate booking tool
      const templateType = result.config.template || 'landing'
      const toolConfig = await generateBookingTool(message, projectId, templateType)

      if (toolConfig) {
        const updatedContent = { ...result.config.content, bookingUrl: `/book/${projectId}`, bookingText: toolConfig.submitText }
        const updatedConfig = { ...result.config, content: updatedContent }
        await supabase
          .from('projects')
          .update({ template_config: updatedConfig, updated_at: new Date().toISOString() })
          .eq('id', projectId)
      }

      return {
        action: 'generated',
        message: `Rebuilt your website! Sections: ${blockTypes} with the ${result.theme} theme.${toolConfig ? ` Booking form updated at /book/${projectId}` : ''}`,
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

    case 'edit_tool': {
      const svc = getServiceSupabase()

      // Load existing tool for this project
      const { data: tool } = await svc
        .from('tools')
        .select('*')
        .eq('project_id', projectId)
        .eq('tool_type', 'booking')
        .single()

      if (!tool) {
        return {
          action: 'clarify',
          message: "You don't have a booking form yet. Would you like me to create one?",
          question: "Would you like me to create a booking form?",
        }
      }

      const updatedConfig = await editToolConfig(tool.config as ToolConfig, message)

      await svc
        .from('tools')
        .update({ config: updatedConfig, updated_at: new Date().toISOString() })
        .eq('id', tool.id)

      return {
        action: 'tool_edited',
        message: `Done! I updated your booking form. View it at /book/${projectId}`,
      }
    }

    case 'add_tool': {
      const svc = getServiceSupabase()

      // Check if tool already exists
      const { data: existingTool } = await svc
        .from('tools')
        .select('id')
        .eq('project_id', projectId)
        .eq('tool_type', 'booking')
        .single()

      if (existingTool) {
        return {
          action: 'clarify',
          message: "You already have a booking form. Would you like to edit it instead?",
          question: "You already have a booking form. Would you like to edit it?",
        }
      }

      // Get project name for context
      const { data: proj } = await supabase
        .from('projects')
        .select('name, template_config')
        .eq('id', projectId)
        .single()

      const templateType = (proj?.template_config as Record<string, unknown>)?.template as string || 'landing'
      const businessContext = proj?.name || message

      const toolConfig = await generateBookingTool(businessContext, projectId, templateType)

      if (!toolConfig) {
        return {
          action: 'clarify',
          message: "I had trouble creating the booking form. Could you describe your business so I can try again?",
          question: "Could you describe your business?",
        }
      }

      // Update project template_config with bookingUrl
      if (proj?.template_config) {
        const config = proj.template_config as Record<string, unknown>
        const content = (config.content || {}) as Record<string, unknown>
        content.bookingUrl = `/book/${projectId}`
        content.bookingText = toolConfig.submitText
        config.content = content

        await supabase
          .from('projects')
          .update({ template_config: config, updated_at: new Date().toISOString() })
          .eq('id', projectId)
      }

      return {
        action: 'tool_created',
        message: `Done! I created a booking form for your site. View it at /book/${projectId}`,
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
