/**
 * Shared event contract for voice call Realtime broadcasts.
 *
 * This is THE source of truth for all event names and payload types
 * exchanged between the Python voice server and the TypeScript frontend
 * via Supabase Realtime.
 *
 * Python mirror: voice-server/src/events.py
 */

// ── Event Names ──

export const CALL_EVENTS = {
  // Voice Server → Frontend
  PREVIEW_UPDATED: 'preview_updated',
  VOICE_MESSAGE: 'voice_message',
  PROJECT_SELECTED: 'project_selected',
  OPEN_ACTION_MENU: 'open_action_menu',
  CLOSE_ACTION_MENU: 'close_action_menu',
  STEP_COMPLETED: 'step_completed',
  CALL_ENDED: 'call_ended',

  // Frontend → Voice Server
  PAGE_OPENED: 'page_opened',
  WEB_ACTION: 'web_action',
} as const

export type CallEventName = (typeof CALL_EVENTS)[keyof typeof CALL_EVENTS]

// ── Web Action Types ──

export const WEB_ACTION_TYPES = {
  PAGE_OPENED: 'page_opened',
  TEXT_MESSAGE_SENT: 'text_message_sent',
  IMAGE_UPLOADED: 'image_uploaded',
  PROJECT_SELECTED_FROM_WEB: 'project_selected_from_web',
  NEW_PROJECT_REQUESTED: 'new_project_requested',
  STEP_SELECTED: 'step_selected',
} as const

export type WebActionType = (typeof WEB_ACTION_TYPES)[keyof typeof WEB_ACTION_TYPES]

// ── Payload Types (Voice Server → Frontend) ──

export interface PreviewUpdatedPayload {
  action: 'generated' | 'edited' | 'theme_changed'
  message: string
  projectId: string
  timestamp: number
}

export interface VoiceMessagePayload {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface ProjectSelectedPayload {
  projectId: string
  timestamp: number
}

export interface StepCompletedPayload {
  stepId: string
  timestamp: number
}

export interface CallEndedPayload {
  timestamp: number
}

/** Payload for events with no additional data (open/close action menu). */
export interface EmptyPayload {
  timestamp: number
}

// ── Payload Types (Frontend → Voice Server) ──

export interface WebActionPayload {
  actionType: WebActionType
  [key: string]: unknown
}

// ── Type Map ──

export interface CallEventPayloads {
  [CALL_EVENTS.PREVIEW_UPDATED]: PreviewUpdatedPayload
  [CALL_EVENTS.VOICE_MESSAGE]: VoiceMessagePayload
  [CALL_EVENTS.PROJECT_SELECTED]: ProjectSelectedPayload
  [CALL_EVENTS.STEP_COMPLETED]: StepCompletedPayload
  [CALL_EVENTS.CALL_ENDED]: CallEndedPayload
  [CALL_EVENTS.OPEN_ACTION_MENU]: EmptyPayload
  [CALL_EVENTS.CLOSE_ACTION_MENU]: EmptyPayload
}
