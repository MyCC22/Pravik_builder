import Anthropic from '@anthropic-ai/sdk'
import { getGreeterPrompt, getOnboardingPrompt } from './prompts/greeter.js'
import type { CallContext } from './types.js'

const anthropic = new Anthropic()

export async function generateGreeting(context: CallContext): Promise<string> {
  const systemPrompt = getGreeterPrompt(context.isNewUser, context.userName)

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: systemPrompt,
    messages: [
      { role: 'user', content: 'Generate the greeting.' },
    ],
  })

  const text = response.content[0]
  if (text.type !== 'text') throw new Error('Unexpected response type')
  return text.text.trim()
}

export async function handleOnboarding(
  userSpeech: string,
  context: CallContext
): Promise<{
  response: string
  userWantsToStart: boolean
  shouldSendSMS: boolean
}> {
  const systemPrompt = getOnboardingPrompt()

  const messages: Anthropic.MessageParam[] = []

  // Include conversation history for context
  for (const msg of context.conversationHistory) {
    messages.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })
  }

  messages.push({ role: 'user', content: userSpeech })

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: systemPrompt,
    messages,
  })

  const text = response.content[0]
  if (text.type !== 'text') throw new Error('Unexpected response type')

  try {
    const parsed = JSON.parse(text.text.trim())
    return {
      response: parsed.response || "Great, let me send you a link!",
      userWantsToStart: parsed.userWantsToStart ?? true,
      shouldSendSMS: parsed.shouldSendSMS ?? false,
    }
  } catch {
    // If JSON parsing fails, treat as affirmative
    return {
      response: text.text.trim(),
      userWantsToStart: true,
      shouldSendSMS: true,
    }
  }
}
