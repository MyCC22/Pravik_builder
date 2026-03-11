import { sendSMS } from './services/twilio.js'
import { broadcastPreviewUpdate, broadcastVoiceMessage } from './services/realtime.js'
import { saveCallMessage, updateCallState, markPageOpened } from './services/call-session.js'

// Function tool definitions for OpenAI Realtime session
export const TOOLS = [
  {
    type: 'function' as const,
    name: 'send_builder_link',
    description: 'Send an SMS with the website builder link to the user. Call this when the user agrees to start building a website.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    type: 'function' as const,
    name: 'build_website',
    description: 'Build a new website based on the user description. Call this when the user describes what kind of website they want.',
    parameters: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'A detailed description of the website to build, e.g. "A website for a soccer coaching academy with training programs, pricing, and contact info"',
        },
      },
      required: ['description'],
    },
  },
  {
    type: 'function' as const,
    name: 'edit_website',
    description: 'Make changes to the existing website. Call this when the user requests specific modifications like changing text, adding sections, or removing elements.',
    parameters: {
      type: 'object',
      properties: {
        instruction: {
          type: 'string',
          description: 'What to change, e.g. "Change the hero title to Welcome to My Academy" or "Add a testimonials section" or "Remove the pricing section"',
        },
      },
      required: ['instruction'],
    },
  },
  {
    type: 'function' as const,
    name: 'change_theme',
    description: 'Change the color theme of the website. Available themes: clean (professional light), bold (dark mode), vibrant (colorful gradients), warm (cozy earth tones). Call this when the user wants to change colors, make it darker, lighter, warmer, etc.',
    parameters: {
      type: 'object',
      properties: {
        request: {
          type: 'string',
          description: 'The theme change request, e.g. "Make it dark mode" or "Use warmer colors" or "Switch to the vibrant theme"',
        },
      },
      required: ['request'],
    },
  },
]

// Call context passed to tool handlers
export interface ToolContext {
  callSid: string
  sessionId: string
  userId: string
  projectId: string
  phoneNumber: string
  builderApiUrl: string
}

// Execute a function tool and return the result
export async function executeTool(
  name: string,
  args: Record<string, string>,
  ctx: ToolContext
): Promise<string> {
  console.log(`[${ctx.callSid}] Tool call: ${name}(${JSON.stringify(args)})`)

  switch (name) {
    case 'send_builder_link':
      return await handleSendBuilderLink(ctx)
    case 'build_website':
      return await handleBuildWebsite(args.description, ctx)
    case 'edit_website':
      return await handleEditWebsite(args.instruction, ctx)
    case 'change_theme':
      return await handleChangeTheme(args.request, ctx)
    default:
      return `Unknown tool: ${name}`
  }
}

async function handleSendBuilderLink(ctx: ToolContext): Promise<string> {
  const builderUrl = `${ctx.builderApiUrl}/build/${ctx.projectId}?session=${ctx.callSid}`
  const smsBody = `Open this link to see your website being built: ${builderUrl}`

  try {
    await sendSMS(ctx.phoneNumber, smsBody)
    await updateCallState(ctx.callSid, 'waiting_for_page')
    await saveCallMessage({
      callSessionId: ctx.sessionId,
      role: 'system',
      content: `SMS sent with builder link: ${builderUrl}`,
    })
    return 'SMS sent successfully with the builder link. The user should open it on their phone.'
  } catch (err) {
    console.error(`[${ctx.callSid}] Failed to send SMS:`, err)
    return 'Failed to send SMS. Ask the user to try again.'
  }
}

async function handleBuildWebsite(description: string, ctx: ToolContext): Promise<string> {
  try {
    await updateCallState(ctx.callSid, 'building')

    const response = await fetch(`${ctx.builderApiUrl}/api/builder/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: description,
        project_id: ctx.projectId,
      }),
    })

    if (!response.ok) {
      throw new Error(`Builder API returned ${response.status}`)
    }

    const result = await response.json() as { action: string; message: string }

    // Broadcast to browser for live preview update
    await broadcastPreviewUpdate(ctx.callSid, {
      action: result.action,
      message: result.message,
      projectId: ctx.projectId,
    })

    await saveCallMessage({
      callSessionId: ctx.sessionId,
      role: 'assistant',
      content: result.message,
      intent: 'build_website',
    })

    await updateCallState(ctx.callSid, 'follow_up')

    return result.message
  } catch (err) {
    console.error(`[${ctx.callSid}] Build failed:`, err)
    return 'Sorry, there was an error building the website. Please try describing what you want again.'
  }
}

async function handleEditWebsite(instruction: string, ctx: ToolContext): Promise<string> {
  try {
    const response = await fetch(`${ctx.builderApiUrl}/api/builder/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: instruction,
        project_id: ctx.projectId,
      }),
    })

    if (!response.ok) {
      throw new Error(`Builder API returned ${response.status}`)
    }

    const result = await response.json() as { action: string; message: string }

    await broadcastPreviewUpdate(ctx.callSid, {
      action: result.action,
      message: result.message,
      projectId: ctx.projectId,
    })

    await saveCallMessage({
      callSessionId: ctx.sessionId,
      role: 'assistant',
      content: result.message,
      intent: 'edit_website',
    })

    return result.message
  } catch (err) {
    console.error(`[${ctx.callSid}] Edit failed:`, err)
    return 'Sorry, there was an error making that change. Please try again.'
  }
}

async function handleChangeTheme(request: string, ctx: ToolContext): Promise<string> {
  try {
    const response = await fetch(`${ctx.builderApiUrl}/api/builder/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: request,
        project_id: ctx.projectId,
      }),
    })

    if (!response.ok) {
      throw new Error(`Builder API returned ${response.status}`)
    }

    const result = await response.json() as { action: string; message: string }

    await broadcastPreviewUpdate(ctx.callSid, {
      action: result.action,
      message: result.message,
      projectId: ctx.projectId,
    })

    await saveCallMessage({
      callSessionId: ctx.sessionId,
      role: 'assistant',
      content: result.message,
      intent: 'change_theme',
    })

    return result.message
  } catch (err) {
    console.error(`[${ctx.callSid}] Theme change failed:`, err)
    return 'Sorry, there was an error changing the theme. Please try again.'
  }
}
