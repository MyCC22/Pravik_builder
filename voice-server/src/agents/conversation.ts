import Anthropic from '@anthropic-ai/sdk'
import { getConversationPrompt, getBuildCompletePrompt } from './prompts/conversation.js'
import type { CallContext } from './types.js'

const anthropic = new Anthropic()

export interface ConversationResult {
  builderCommand: string | null
  voiceResponse: string
  isConversational: boolean
  isDone: boolean
}

export async function processUserInput(
  userSpeech: string,
  context: CallContext
): Promise<ConversationResult> {
  const systemPrompt = getConversationPrompt({
    currentBlocks: context.currentBlocks,
    currentTheme: context.currentTheme,
    lastBuildAction: context.lastBuildAction,
    conversationHistory: context.conversationHistory,
  })

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userSpeech },
    ],
  })

  const text = response.content[0]
  if (text.type !== 'text') throw new Error('Unexpected response type')

  try {
    const parsed = JSON.parse(text.text.trim())
    return {
      builderCommand: parsed.builderCommand || null,
      voiceResponse: parsed.voiceResponse || "Let me work on that for you.",
      isConversational: parsed.isConversational ?? false,
      isDone: parsed.isDone ?? false,
    }
  } catch {
    // If JSON parsing fails, treat as conversational
    return {
      builderCommand: null,
      voiceResponse: text.text.trim(),
      isConversational: true,
      isDone: false,
    }
  }
}

export async function generateBuildCompleteResponse(params: {
  buildAction: string
  buildMessage: string
  currentBlocks: string[]
  currentTheme: string | null
}): Promise<string> {
  const systemPrompt = getBuildCompletePrompt(params)

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: systemPrompt,
    messages: [
      { role: 'user', content: 'Generate the completion response.' },
    ],
  })

  const text = response.content[0]
  if (text.type !== 'text') throw new Error('Unexpected response type')
  return text.text.trim()
}
