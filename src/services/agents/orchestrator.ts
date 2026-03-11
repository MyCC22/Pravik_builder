import { getSupabaseClient } from '@/services/supabase/client'
import { createClient } from '@supabase/supabase-js'
import { routeIntent } from './router'
import { generateSite, renderAndStoreBlocks } from './generator'
import { editBlock, addBlock } from './block-editor'
import { pickTheme } from './theme-agent'
import { generateBookingTool } from './tool-generator'
import { editToolConfig } from './tool-editor'
import { fetchSingleImage } from '@/services/unsplash/image-fetcher'
import { crawlSite } from '@/services/scraper/firecrawl'
import { extractContent } from '@/services/scraper/extractor'
import { analyzeScreenshot } from '@/services/scraper/visual-analyzer'
import { generateCloneConfig } from '@/services/scraper/clone-generator'
import type { Block, AgentResponse, ToolConfig } from './types'

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * After generating a booking tool, patch any block HTML that still has
 * placeholder hrefs (#contact, #booking) so CTA buttons point to /book/{projectId}.
 */
async function patchBlockBookingUrls(projectId: string, supabase: ReturnType<typeof getSupabaseClient>) {
  const bookingUrl = `/book/${projectId}`

  // Load all blocks for this project
  const { data: blocks } = await supabase
    .from('blocks')
    .select('id, block_type, html')
    .eq('project_id', projectId)

  if (!blocks) return

  // Patch blocks that contain placeholder hrefs
  const ctaBlockTypes = ['hero', 'cta', 'booking', 'contact', 'custom']
  for (const block of blocks) {
    if (!ctaBlockTypes.includes(block.block_type) && !block.html.includes('#contact')) continue

    let patched = block.html
    // Replace common placeholder hrefs with the real booking URL
    patched = patched.replace(/href="#contact"/g, `href="${bookingUrl}"`)
    patched = patched.replace(/href="#booking"/g, `href="${bookingUrl}"`)
    patched = patched.replace(/href="#book"/g, `href="${bookingUrl}"`)

    if (patched !== block.html) {
      await supabase
        .from('blocks')
        .update({ html: patched, updated_at: new Date().toISOString() })
        .eq('id', block.id)
    }
  }
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

  // Detect clone URLs early — clone requests must go through the router
  // even for new projects with no blocks (otherwise they get routed to
  // the generic generateSite which invents content)
  const hasUrl = /https?:\/\/[^\s]+/.test(message)
  const hasCloneKeywords = /\b(clone|copy|recreate|replicate|like this|make .* like|website like|similar to)\b/i.test(message)
  const isLikelyClone = hasUrl && hasCloneKeywords

  // If no blocks exist AND not a clone request, skip router and generate directly
  if (currentBlocks.length === 0 && !isLikelyClone) {
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

      // Safety net: patch any block HTML that still has placeholder hrefs
      await patchBlockBookingUrls(projectId, supabase)
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

        // Safety net: patch any block HTML that still has placeholder hrefs
        await patchBlockBookingUrls(projectId, supabase)
      }

      return {
        action: 'generated',
        message: `Rebuilt your website! Sections: ${blockTypes} with the ${result.theme} theme.${toolConfig ? ` Booking form updated at /book/${projectId}` : ''}`,
      }
    }

    case 'clone_site': {
      const cloneUrl = route.clone_url || route.description
      const cloneMode = route.clone_mode || 'content'

      // Validate URL — try to fix bare domains
      let targetUrl = cloneUrl
      if (!targetUrl || !targetUrl.match(/^https?:\/\//)) {
        if (targetUrl && targetUrl.match(/\w+\.\w+/)) {
          targetUrl = `https://${targetUrl}`
        } else {
          return {
            action: 'clarify',
            message: "I need a valid URL to clone. Could you provide the full website address? (e.g., https://example.com)",
            question: "What's the URL of the website you'd like to clone?",
          }
        }
      }

      // Step 1: Crawl the site
      const crawlResult = await crawlSite(targetUrl)
      if (!crawlResult) {
        return {
          action: 'clarify',
          message: "I couldn't access that website. Please check the URL and make sure the site is publicly accessible, then try again.",
          question: 'Could you double-check the URL?',
        }
      }

      // Step 2: Extract structured content
      const extracted = extractContent(crawlResult)

      // Step 3: Visual analysis (only in style mode + if screenshot available)
      let visualAnalysis = null
      if (cloneMode === 'content_and_style' && crawlResult.mainPage.screenshot) {
        visualAnalysis = await analyzeScreenshot(crawlResult.mainPage.screenshot)
      }

      // Step 4: Generate TemplateConfig via clone generator AI
      const config = await generateCloneConfig(extracted, visualAnalysis, projectId)

      // Step 5: Delete existing blocks and tools
      await supabase.from('blocks').delete().eq('project_id', projectId)
      await supabase.from('tools').delete().eq('project_id', projectId)

      // Step 6: Render, fetch images, split into blocks, store
      const result = await renderAndStoreBlocks(config, projectId)
      const blockTypes = result.blocks.map(b => b.block_type).join(', ')

      // Step 7: Auto-generate booking tool
      const templateType = result.config.template || 'landing'
      const toolConfig = await generateBookingTool(
        extracted.siteName || message,
        projectId,
        templateType
      )

      if (toolConfig) {
        const updatedContent = {
          ...result.config.content,
          bookingUrl: `/book/${projectId}`,
          bookingText: toolConfig.submitText,
        }
        const updatedConfig = { ...result.config, content: updatedContent }
        await supabase
          .from('projects')
          .update({ template_config: updatedConfig, updated_at: new Date().toISOString() })
          .eq('id', projectId)

        await patchBlockBookingUrls(projectId, supabase)
      }

      const styleNote = visualAnalysis
        ? ` I matched the ${visualAnalysis.colors.mood} color vibe and ${visualAnalysis.layout.heroStyle} layout from the original.`
        : ''

      return {
        action: 'generated',
        message: `Your site is ready! I rebuilt it from ${extracted.siteName}'s content with fresh images. Sections: ${blockTypes}.${styleNote}${toolConfig ? ` Booking form live at /book/${projectId}` : ''}`,
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
      const updatedHtml = await editBlock(targetBlock, message, allBlockTypes, projectId)

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

    case 'change_image': {
      const imageTargetType = route.target_blocks[0] || 'hero'
      const imageBlock = currentBlocks.find(b => b.block_type === imageTargetType)

      if (!imageBlock) {
        return {
          action: 'clarify',
          message: `I couldn't find a "${imageTargetType}" section with an image. Your site has: ${currentBlocks.map(b => b.block_type).join(', ')}`,
          question: `Which section's image would you like to change?`,
        }
      }

      // Use the router's description as the search query (what kind of image the user wants)
      const searchQuery = route.description || message
      const newImageUrl = await fetchSingleImage(searchQuery, 'landscape')

      if (!newImageUrl) {
        return {
          action: 'clarify',
          message: "I couldn't find a matching image. Could you describe the kind of image you'd like?",
          question: "What kind of image would you like?",
        }
      }

      // Replace image URLs in the block HTML
      let patchedHtml = imageBlock.html
      // Replace background-image inline styles
      patchedHtml = patchedHtml.replace(
        /background-image:\s*url\(['"]?[^'")\s]+['"]?\)/g,
        `background-image:url('${newImageUrl}')`
      )
      // Replace <img> src attributes (for hero-split)
      patchedHtml = patchedHtml.replace(
        /src="https:\/\/images\.unsplash\.com[^"]*"/g,
        `src="${newImageUrl}"`
      )

      // If no image was found to replace (block might use gradient), add one
      if (patchedHtml === imageBlock.html && imageTargetType === 'hero') {
        // For hero blocks without images, convert to image-backed hero
        // Replace gradient background with image background
        patchedHtml = patchedHtml.replace(
          /background:linear-gradient\([^)]+\)/g,
          `background-image:url('${newImageUrl}');background-size:cover;background-position:center`
        )
      }

      if (patchedHtml !== imageBlock.html) {
        await supabase
          .from('blocks')
          .update({ html: patchedHtml, updated_at: new Date().toISOString() })
          .eq('id', imageBlock.id)

        return {
          action: 'edited',
          message: `Done! I updated the ${imageTargetType} image.`,
        }
      }

      return {
        action: 'clarify',
        message: `The ${imageTargetType} section doesn't have an image to replace. Would you like me to add one?`,
        question: `Would you like me to add an image to the ${imageTargetType} section?`,
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

      // Safety net: patch any block HTML that still has placeholder hrefs
      await patchBlockBookingUrls(projectId, supabase)

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
