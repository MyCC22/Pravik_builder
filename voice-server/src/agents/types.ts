export type CallState =
  | 'greeting'
  | 'onboarding'
  | 'waiting_for_page'
  | 'building'
  | 'follow_up'
  | 'ended'

export interface CallContext {
  callSid: string
  sessionId: string
  userId: string
  isNewUser: boolean
  userName: string | null
  projectId: string | null
  phoneNumber: string
  hasOpenedPage: boolean
  conversationHistory: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: number
  }>
  currentState: CallState
  currentBlocks: string[]
  currentTheme: string | null
  lastBuildAction: string | null
  stateEnteredAt: number
}

export interface VoiceAgentResponse {
  text: string
  shouldSendSMS: boolean
  nextState: CallState | null
  builderCommand: string | null
}

// ConversationRelay WebSocket message types
export interface CRSetupMessage {
  type: 'setup'
  callSid: string
  parentCallSid?: string
  from: string
  to: string
  customParameters: Record<string, string>
}

export interface CRPromptMessage {
  type: 'prompt'
  voicePrompt: string
  lastUtteranceGroup?: {
    role: string
    content: string
  }[]
}

export interface CRInterruptMessage {
  type: 'interrupt'
  utteranceUntilInterrupt: string
  durationUntilInterruptMs: number
}

export interface CRDtmfMessage {
  type: 'dtmf'
  digit: string
}

export interface CRErrorMessage {
  type: 'error'
  description: string
}

export type CRIncomingMessage =
  | CRSetupMessage
  | CRPromptMessage
  | CRInterruptMessage
  | CRDtmfMessage
  | CRErrorMessage

export interface CRTextToken {
  type: 'text'
  token: string
  last: boolean
}

export interface CREndOfInteraction {
  type: 'end'
  handoffData?: string
}
