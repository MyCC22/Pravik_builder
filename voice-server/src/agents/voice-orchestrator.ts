import type { WebSocket } from 'ws'
import type {
  CallContext,
  CallState,
  CRSetupMessage,
  CRPromptMessage,
  CRIncomingMessage,
  CRTextToken,
} from './types.js'
import { generateGreeting, handleOnboarding } from './greeter.js'
import { processUserInput, generateBuildCompleteResponse } from './conversation.js'
import { executeBuildCommand, getCurrentSiteState } from './builder-bridge.js'
import {
  createCallSession,
  updateCallState,
  endCallSession,
  saveCallMessage,
} from '../services/call-session.js'
import { subscribeToCallChannel, broadcastVoiceMessage, broadcastCallEnded, cleanupChannel } from '../services/realtime.js'
import { sendSMS } from '../services/twilio.js'

export class VoiceOrchestrator {
  private ws: WebSocket
  private context: CallContext
  private sessionId: string | null = null
  private waitingTimer: ReturnType<typeof setInterval> | null = null
  private isProcessing = false

  constructor(ws: WebSocket) {
    this.ws = ws
    this.context = {
      callSid: '',
      sessionId: '',
      userId: '',
      isNewUser: true,
      userName: null,
      projectId: null,
      phoneNumber: '',
      hasOpenedPage: false,
      conversationHistory: [],
      currentState: 'greeting',
      currentBlocks: [],
      currentTheme: null,
      lastBuildAction: null,
      stateEnteredAt: Date.now(),
    }
  }

  async handleMessage(raw: string): Promise<void> {
    let msg: CRIncomingMessage
    try {
      msg = JSON.parse(raw)
    } catch {
      console.error('Failed to parse ConversationRelay message:', raw)
      return
    }

    switch (msg.type) {
      case 'setup':
        await this.handleSetup(msg)
        break
      case 'prompt':
        await this.handlePrompt(msg)
        break
      case 'interrupt':
        console.log(`[${this.context.callSid}] User interrupted`)
        // Cancel any in-progress operation flag
        this.isProcessing = false
        break
      case 'dtmf':
        console.log(`[${this.context.callSid}] DTMF: ${msg.digit}`)
        break
      case 'error':
        console.error(`[${this.context.callSid}] ConversationRelay error: ${msg.description}`)
        break
    }
  }

  private async handleSetup(msg: CRSetupMessage): Promise<void> {
    const params = msg.customParameters || {}

    this.context.callSid = msg.callSid
    this.context.userId = params.userId || ''
    this.context.isNewUser = params.isNewUser === 'true'
    this.context.projectId = params.projectId || null
    this.context.phoneNumber = msg.from

    console.log(`[${this.context.callSid}] Call setup - user: ${this.context.userId}, new: ${this.context.isNewUser}, project: ${this.context.projectId}`)

    // Create call session in DB
    try {
      const session = await createCallSession({
        callSid: this.context.callSid,
        userId: this.context.userId,
        projectId: this.context.projectId,
        phoneNumber: this.context.phoneNumber,
        isNewUser: this.context.isNewUser,
      })
      this.sessionId = session.id
      this.context.sessionId = session.id
    } catch (err) {
      console.error(`[${this.context.callSid}] Failed to create call session:`, err)
    }

    // Subscribe to Realtime channel for page-open events
    await subscribeToCallChannel(this.context.callSid, () => {
      this.handlePageOpened()
    })

    // Generate and send greeting
    const greeting = await generateGreeting(this.context)
    this.addToHistory('assistant', greeting)
    await this.saveMessage('assistant', greeting)
    this.sendTokens(greeting)

    this.transitionTo('onboarding')
  }

  private async handlePrompt(msg: CRPromptMessage): Promise<void> {
    const userSpeech = msg.voicePrompt
    if (!userSpeech?.trim()) return

    console.log(`[${this.context.callSid}] [${this.context.currentState}] User: "${userSpeech}"`)

    this.addToHistory('user', userSpeech)
    await this.saveMessage('user', userSpeech)

    // Broadcast user message to browser
    if (this.context.projectId) {
      await broadcastVoiceMessage(this.context.callSid, {
        role: 'user',
        content: userSpeech,
      })
    }

    switch (this.context.currentState) {
      case 'onboarding':
        await this.handleOnboardingState(userSpeech)
        break
      case 'waiting_for_page':
        await this.handleWaitingState(userSpeech)
        break
      case 'building':
      case 'follow_up':
        await this.handleBuildingState(userSpeech)
        break
      case 'ended':
        // Call is ending, ignore further input
        break
      default:
        await this.handleBuildingState(userSpeech)
    }
  }

  private async handleOnboardingState(userSpeech: string): Promise<void> {
    const result = await handleOnboarding(userSpeech, this.context)

    if (result.shouldSendSMS && this.context.projectId) {
      // Send SMS with builder link
      const builderUrl = `${process.env.BUILDER_API_URL || 'https://pravik-builder.vercel.app'}/build/${this.context.projectId}?session=${this.context.callSid}`
      const smsBody = `Open this link to see your website being built: ${builderUrl}`

      try {
        await sendSMS(this.context.phoneNumber, smsBody)
        console.log(`[${this.context.callSid}] SMS sent to ${this.context.phoneNumber}`)
      } catch (err) {
        console.error(`[${this.context.callSid}] Failed to send SMS:`, err)
      }

      this.addToHistory('assistant', result.response)
      await this.saveMessage('assistant', result.response)
      this.sendTokens(result.response)
      this.transitionTo('waiting_for_page')

      // Start periodic reassurance while waiting
      this.startWaitingTimer()
    } else if (result.userWantsToStart) {
      // User wants to start but we couldn't send SMS
      this.addToHistory('assistant', result.response)
      await this.saveMessage('assistant', result.response)
      this.sendTokens(result.response)
    } else {
      // User doesn't want to start
      this.addToHistory('assistant', result.response)
      await this.saveMessage('assistant', result.response)
      this.sendTokens(result.response)
    }
  }

  private async handleWaitingState(userSpeech: string): Promise<void> {
    // If user starts describing a website, go straight to building
    const result = await processUserInput(userSpeech, this.context)

    if (result.builderCommand) {
      // User started describing what they want — skip waiting for page
      this.stopWaitingTimer()
      this.transitionTo('building')

      this.addToHistory('assistant', result.voiceResponse)
      await this.saveMessage('assistant', result.voiceResponse)
      this.sendTokens(result.voiceResponse)

      // Execute the build command
      await this.executeBuild(result.builderCommand)
    } else {
      // Just chatting while waiting
      this.addToHistory('assistant', result.voiceResponse)
      await this.saveMessage('assistant', result.voiceResponse)
      this.sendTokens(result.voiceResponse)
    }
  }

  private async handleBuildingState(userSpeech: string): Promise<void> {
    if (this.isProcessing) {
      this.sendTokens("I'm still working on your last request, just a moment.")
      return
    }

    const result = await processUserInput(userSpeech, this.context)

    if (result.isDone) {
      // User is done
      const goodbye = "It was great helping you build your website! You can always call back if you want to make changes. Have a wonderful day!"
      this.addToHistory('assistant', goodbye)
      await this.saveMessage('assistant', goodbye)
      this.sendTokens(goodbye)
      this.transitionTo('ended')

      // End the call after the goodbye plays
      setTimeout(() => {
        this.sendEndOfInteraction()
      }, 5000)
      return
    }

    if (result.builderCommand && this.context.projectId) {
      // Send the immediate voice response
      this.addToHistory('assistant', result.voiceResponse)
      await this.saveMessage('assistant', result.voiceResponse)
      this.sendTokens(result.voiceResponse)

      // Broadcast to browser
      await broadcastVoiceMessage(this.context.callSid, {
        role: 'assistant',
        content: result.voiceResponse,
      })

      // Execute the build command
      await this.executeBuild(result.builderCommand)
    } else {
      // Conversational response
      this.addToHistory('assistant', result.voiceResponse)
      await this.saveMessage('assistant', result.voiceResponse)
      this.sendTokens(result.voiceResponse)

      await broadcastVoiceMessage(this.context.callSid, {
        role: 'assistant',
        content: result.voiceResponse,
      })
    }
  }

  private async executeBuild(command: string): Promise<void> {
    if (!this.context.projectId) return

    this.isProcessing = true

    try {
      const buildResult = await executeBuildCommand(
        command,
        this.context.projectId,
        this.context.callSid
      )

      // Update site state
      const siteState = await getCurrentSiteState(this.context.projectId)
      this.context.currentBlocks = siteState.blocks
      this.context.currentTheme = siteState.theme
      this.context.lastBuildAction = buildResult.action

      // Generate a voice-friendly completion message
      const completionResponse = await generateBuildCompleteResponse({
        buildAction: buildResult.action,
        buildMessage: buildResult.message,
        currentBlocks: this.context.currentBlocks,
        currentTheme: this.context.currentTheme,
      })

      this.addToHistory('assistant', completionResponse)
      await this.saveMessage('assistant', completionResponse, buildResult.action)
      this.sendTokens(completionResponse)

      await broadcastVoiceMessage(this.context.callSid, {
        role: 'assistant',
        content: completionResponse,
      })

      // Transition to follow_up after first build
      if (this.context.currentState === 'building') {
        this.transitionTo('follow_up')
      }
    } catch (err) {
      console.error(`[${this.context.callSid}] Build failed:`, err)
      const errorMsg = "I ran into a small issue building that. Could you try describing what you want one more time?"
      this.addToHistory('assistant', errorMsg)
      await this.saveMessage('assistant', errorMsg)
      this.sendTokens(errorMsg)
    } finally {
      this.isProcessing = false
    }
  }

  private handlePageOpened(): void {
    console.log(`[${this.context.callSid}] Page opened!`)
    this.context.hasOpenedPage = true
    this.stopWaitingTimer()

    if (this.context.currentState === 'waiting_for_page') {
      const msg = "I can see you've opened the page. What kind of website would you like to build?"
      this.addToHistory('assistant', msg)
      this.saveMessage('assistant', msg)
      this.sendTokens(msg)
      this.transitionTo('building')
    }
  }

  private transitionTo(newState: CallState): void {
    console.log(`[${this.context.callSid}] State: ${this.context.currentState} -> ${newState}`)
    this.context.currentState = newState
    this.context.stateEnteredAt = Date.now()

    // Persist state to DB
    updateCallState(this.context.callSid, newState).catch((err) => {
      console.error(`[${this.context.callSid}] Failed to update call state:`, err)
    })
  }

  private sendTokens(text: string): void {
    // Split text into sentence-sized chunks for more natural speech
    const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text]

    for (let i = 0; i < sentences.length; i++) {
      const token: CRTextToken = {
        type: 'text',
        token: sentences[i].trim(),
        last: i === sentences.length - 1,
      }
      this.ws.send(JSON.stringify(token))
    }
  }

  private sendEndOfInteraction(): void {
    this.ws.send(JSON.stringify({ type: 'end' }))
  }

  private addToHistory(role: 'user' | 'assistant', content: string): void {
    this.context.conversationHistory.push({
      role,
      content,
      timestamp: Date.now(),
    })

    // Keep history manageable (last 20 messages)
    if (this.context.conversationHistory.length > 20) {
      this.context.conversationHistory = this.context.conversationHistory.slice(-20)
    }
  }

  private async saveMessage(role: 'user' | 'assistant' | 'system', content: string, intent?: string): Promise<void> {
    if (!this.sessionId) return
    try {
      await saveCallMessage({
        callSessionId: this.sessionId,
        role,
        content,
        intent,
      })
    } catch (err) {
      console.error(`[${this.context.callSid}] Failed to save message:`, err)
    }
  }

  private startWaitingTimer(): void {
    let reminderCount = 0
    this.waitingTimer = setInterval(() => {
      if (this.context.currentState !== 'waiting_for_page') {
        this.stopWaitingTimer()
        return
      }

      reminderCount++
      if (reminderCount === 1) {
        this.sendTokens("I'm still here! Just open that link whenever you're ready.")
      } else if (reminderCount === 2) {
        this.sendTokens("Take your time. I'll be right here when you open the link.")
      }
      // After 2 reminders, stay silent
    }, 20000) // Every 20 seconds
  }

  private stopWaitingTimer(): void {
    if (this.waitingTimer) {
      clearInterval(this.waitingTimer)
      this.waitingTimer = null
    }
  }

  async cleanup(): Promise<void> {
    this.stopWaitingTimer()

    if (this.context.callSid) {
      try {
        await endCallSession(this.context.callSid)
        await broadcastCallEnded(this.context.callSid)
      } catch (err) {
        console.error(`[${this.context.callSid}] Cleanup error:`, err)
      }
      cleanupChannel(this.context.callSid)
    }

    console.log(`[${this.context.callSid}] Call ended, cleaned up`)
  }
}
