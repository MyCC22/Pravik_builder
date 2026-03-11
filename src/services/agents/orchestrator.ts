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

/**
 * Convert a hero-split layout (text left, <img> right in grid) to a full-width
 * background image layout (like hero-center). Preserves the text content.
 */
function convertSplitToBackground(html: string, imageUrl: string): string {
  // Extract text content from the split layout
  // Look for the h1 title
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
  const title = titleMatch ? titleMatch[0] : ''

  // Look for the subtitle (p tag after h1)
  const subtitleMatch = html.match(/<h1[\s\S]*?<\/h1>\s*<p[^>]*>([\s\S]*?)<\/p>/)
  const subtitle = subtitleMatch ? subtitleMatch[0].replace(titleMatch?.[0] || '', '').trim() : ''

  // Look for tagline/label (small text above h1, often in a p or span with uppercase)
  const taglineMatch = html.match(/<(?:p|span)[^>]*(?:tracking-wider|uppercase|text-sm|text-xs)[^>]*>([\s\S]*?)<\/(?:p|span)>/)
  const tagline = taglineMatch ? taglineMatch[0] : ''

  // Look for CTA button/link
  const ctaMatch = html.match(/<a[^>]*class="[^"]*(?:rounded|btn|button|bg-)[^"]*"[^>]*>[\s\S]*?<\/a>/)
  const cta = ctaMatch ? ctaMatch[0] : ''

  // Rewrite the CTA colors: change theme-colored buttons to white for readability over image
  let ctaFixed = cta
  if (ctaFixed) {
    // Replace theme bg colors with white bg + black text for contrast over image
    ctaFixed = ctaFixed.replace(/bg-(?:indigo|blue|purple|violet|emerald|amber|rose|red|green|orange|yellow|cyan|teal|fuchsia|pink)-\d+/g, 'bg-white')
    ctaFixed = ctaFixed.replace(/text-(?:white|black)/g, 'text-black')
    // Ensure hover state works
    ctaFixed = ctaFixed.replace(/hover:bg-(?:indigo|blue|purple|violet|emerald|amber|rose|red|green|orange|yellow|cyan|teal|fuchsia|pink)-\d+/g, 'hover:bg-gray-100')
  }

  // Fix text colors: change theme colors to white for readability over background image
  let titleFixed = title
    .replace(/text-(?:indigo|blue|purple|violet|emerald|amber|rose|red|green|orange|yellow|cyan|teal|fuchsia|pink)-\d+/g, 'text-white')
    .replace(/text-(?:gray|slate|zinc|neutral|stone)-\d+/g, 'text-white')
  // Ensure text is white
  if (!titleFixed.includes('text-white')) {
    titleFixed = titleFixed.replace(/<h1/, '<h1 style="color:white"')
  }

  let taglineFixed = tagline
    .replace(/text-(?:indigo|blue|purple|violet|emerald|amber|rose|red|green|orange|yellow|cyan|teal|fuchsia|pink)-\d+/g, 'text-white/70')
    .replace(/text-(?:gray|slate|zinc|neutral|stone)-\d+/g, 'text-white/70')

  let subtitleFixed = subtitle
    .replace(/text-(?:gray|slate|zinc|neutral|stone)-\d+/g, 'text-white/80')

  // Build new hero HTML with background image
  return `<section class="relative py-24 sm:py-32 overflow-hidden" style="background-image:url('${imageUrl}');background-size:cover;background-position:center">
  <div class="absolute inset-0 bg-black/50"></div>
  <div class="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center">
    ${taglineFixed}
    ${titleFixed}
    ${subtitleFixed}
    ${ctaFixed ? `<div class="mt-8 flex justify-center">${ctaFixed}</div>` : ''}
  </div>
</section>`
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function handleMessage(
  message: string,
  projectId: string,
  imageUrls?: string[],
  history?: ChatMessage[]
): Promise<AgentResponse> {
  const supabase = getSupabaseClient()
  // Service role client for write operations that need to bypass RLS
  // (anon key DELETE silently fails due to RLS requiring auth.uid())
  const svcSupabase = getServiceSupabase()

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

  // If the message contains a URL, always go through the router —
  // the AI router can detect clone intent from any phrasing, whereas
  // keyword matching is too fragile and misses natural language like
  // "build me https://example.com" or just a pasted URL.
  const hasUrl = /https?:\/\/[^\s]+/.test(message) || /\w+\.\w+\.\w+/.test(message)

  // If no blocks exist AND no URL present, skip router and generate directly
  if (currentBlocks.length === 0 && !hasUrl) {
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

  // Route the intent (include image context so router knows user attached images)
  const messageWithImageContext = imageUrls?.length
    ? `${message}\n\n[User attached ${imageUrls.length} image(s)]`
    : message
  const route = await routeIntent(messageWithImageContext, currentBlocks, currentTheme, history)

  switch (route.intent) {
    case 'generate_site': {
      // Delete existing blocks and tools, then regenerate
      // Use service role to bypass RLS (anon key silently fails on DELETE)
      await svcSupabase.from('blocks').delete().eq('project_id', projectId)
      await svcSupabase.from('tools').delete().eq('project_id', projectId)
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
      // Use service role to bypass RLS (anon key silently fails on DELETE)
      await svcSupabase.from('blocks').delete().eq('project_id', projectId)
      await svcSupabase.from('tools').delete().eq('project_id', projectId)

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
      const updatedHtml = await editBlock(targetBlock, message, allBlockTypes, projectId, history)

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

      await svcSupabase.from('blocks').delete().eq('id', removeBlock.id)

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
      const hasUserImages = imageUrls && imageUrls.length > 0

      // If user says "change image" with no attachment and no clear description,
      // ask if they have an image or want AI to pick
      if (!hasUserImages && route.description?.includes('ask_user')) {
        return {
          action: 'clarify',
          message: "Sure! Do you have an image you'd like to use, or should I find one for you?",
          question: "Do you have an image to upload, or should I pick one?",
        }
      }

      // For gallery batch replace with multiple user images
      if (hasUserImages && imageTargetType === 'gallery') {
        const galleryBlock = currentBlocks.find(b => b.block_type === 'gallery')
        if (!galleryBlock) {
          return {
            action: 'clarify',
            message: `I couldn't find a gallery section. Your site has: ${currentBlocks.map(b => b.block_type).join(', ')}`,
            question: `Which section's images would you like to change?`,
          }
        }

        let patchedHtml = galleryBlock.html
        // Find all background-image URLs in the gallery
        const bgImageRegex = /background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/g
        let matchIndex = 0
        patchedHtml = patchedHtml.replace(bgImageRegex, (match) => {
          if (matchIndex < imageUrls!.length) {
            const url = imageUrls![matchIndex]
            matchIndex++
            return `background-image:url('${url}')`
          }
          return match // keep original if no more user images
        })

        // Also replace <img> src attributes
        const imgSrcRegex = /src="(https?:\/\/[^"]*(?:unsplash|supabase)[^"]*)"/g
        let srcIndex = 0
        patchedHtml = patchedHtml.replace(imgSrcRegex, (match) => {
          if (srcIndex < imageUrls!.length) {
            const url = imageUrls![srcIndex]
            srcIndex++
            return `src="${url}"`
          }
          return match
        })

        if (patchedHtml !== galleryBlock.html) {
          await supabase
            .from('blocks')
            .update({ html: patchedHtml, updated_at: new Date().toISOString() })
            .eq('id', galleryBlock.id)

          const used = Math.min(imageUrls!.length, Math.max(matchIndex, srcIndex))
          const extra = imageUrls!.length - used
          const note = extra > 0 ? ` (I used ${used} of your ${imageUrls!.length} images — the gallery has ${used} slots)` : ''
          return {
            action: 'edited',
            message: `Done! I updated the gallery images with your photos.${note}`,
          }
        }
      }

      const imageBlock = currentBlocks.find(b => b.block_type === imageTargetType)

      if (!imageBlock) {
        return {
          action: 'clarify',
          message: `I couldn't find a "${imageTargetType}" section with an image. Your site has: ${currentBlocks.map(b => b.block_type).join(', ')}`,
          question: `Which section's image would you like to change?`,
        }
      }

      // Determine image URL: user-provided or Unsplash
      let newImageUrl: string | null = null

      if (hasUserImages) {
        // Use the user's uploaded image directly
        newImageUrl = imageUrls![0]
      } else {
        // Fetch from Unsplash
        const searchQuery = route.description || message
        newImageUrl = await fetchSingleImage(searchQuery, 'landscape')
      }

      if (!newImageUrl) {
        return {
          action: 'clarify',
          message: "I couldn't find a matching image. Could you describe the kind of image you'd like, or attach one?",
          question: "What kind of image would you like?",
        }
      }

      // Use LLM-determined image_placement (no keyword matching)
      const wantsBackground = route.image_placement === 'background'
      const isSplitLayout = imageBlock.html.includes('<img') && imageBlock.html.includes('grid')

      let patchedHtml = imageBlock.html

      if (wantsBackground && imageTargetType === 'hero') {
        if (isSplitLayout) {
          // Convert hero-split (text left, img right) to full-width background
          patchedHtml = convertSplitToBackground(imageBlock.html, newImageUrl)
        } else if (imageBlock.html.includes('background-image')) {
          // Already a background layout, just swap the URL
          patchedHtml = patchedHtml.replace(
            /background-image:\s*url\(['"]?[^'")\s]+['"]?\)/g,
            `background-image:url('${newImageUrl}')`
          )
        } else {
          // No image yet — add background-image to the section
          patchedHtml = patchedHtml.replace(
            /<section([^>]*)>/,
            `<section$1 style="background-image:url('${newImageUrl}');background-size:cover;background-position:center">`
          )
          // Add overlay for readability if not present
          if (!patchedHtml.includes('bg-black/')) {
            patchedHtml = patchedHtml.replace(
              /(<section[^>]*>)/,
              `$1\n  <div class="absolute inset-0 bg-black/50"></div>`
            )
            // Make section relative and add overflow-hidden
            patchedHtml = patchedHtml.replace(
              /class="([^"]*)"/,
              (match, classes) => `class="relative overflow-hidden ${classes}"`
            )
          }
        }
      } else {
        // Standard in-place image replacement
        // Replace background-image inline styles
        patchedHtml = patchedHtml.replace(
          /background-image:\s*url\(['"]?[^'")\s]+['"]?\)/g,
          `background-image:url('${newImageUrl}')`
        )
        // Replace <img> src attributes
        patchedHtml = patchedHtml.replace(
          /src="https?:\/\/[^"]*(?:unsplash|supabase)[^"]*"/g,
          `src="${newImageUrl}"`
        )

        // If no image was found to replace (block might use gradient), add one
        if (patchedHtml === imageBlock.html && imageTargetType === 'hero') {
          patchedHtml = patchedHtml.replace(
            /background:linear-gradient\([^)]+\)/g,
            `background-image:url('${newImageUrl}');background-size:cover;background-position:center`
          )
        }
      }

      if (patchedHtml !== imageBlock.html) {
        await supabase
          .from('blocks')
          .update({ html: patchedHtml, updated_at: new Date().toISOString() })
          .eq('id', imageBlock.id)

        const source = hasUserImages ? 'your uploaded image' : 'a new image'
        return {
          action: 'edited',
          message: `Done! I updated the ${imageTargetType} image with ${source}.`,
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
