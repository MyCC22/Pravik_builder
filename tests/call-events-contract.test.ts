import { describe, it, expect } from 'vitest'
import {
  CALL_EVENTS,
  WEB_ACTION_TYPES,
  type PreviewUpdatedPayload,
  type VoiceMessagePayload,
  type ProjectSelectedPayload,
  type StepCompletedPayload,
  type CallEndedPayload,
  type EmptyPayload,
  type WebActionPayload,
} from '@/lib/events/call-events'

describe('CALL_EVENTS', () => {
  it('all event names are non-empty strings', () => {
    const values = Object.values(CALL_EVENTS)
    expect(values.length).toBeGreaterThan(0)
    for (const v of values) {
      expect(typeof v).toBe('string')
      expect(v.length).toBeGreaterThan(0)
    }
  })

  it('no duplicate event name values', () => {
    const values = Object.values(CALL_EVENTS)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })

  it('has exactly 9 events', () => {
    expect(Object.keys(CALL_EVENTS)).toHaveLength(9)
  })
})

describe('Payload types have timestamp', () => {
  it('PreviewUpdatedPayload has required fields', () => {
    const payload: PreviewUpdatedPayload = {
      action: 'generated',
      message: 'Website built!',
      projectId: 'proj-1',
      timestamp: Date.now(),
    }
    expect(payload.action).toBe('generated')
    expect(payload.message).toBe('Website built!')
    expect(payload.projectId).toBe('proj-1')
    expect(typeof payload.timestamp).toBe('number')
  })

  it('StepCompletedPayload has stepId and timestamp', () => {
    const payload: StepCompletedPayload = {
      stepId: 'contact_form',
      timestamp: Date.now(),
    }
    expect(payload.stepId).toBe('contact_form')
    expect(typeof payload.timestamp).toBe('number')
  })

  it('VoiceMessagePayload has role, content, timestamp', () => {
    const payload: VoiceMessagePayload = {
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
    }
    expect(payload.role).toBe('user')
    expect(payload.content).toBe('Hello')
    expect(typeof payload.timestamp).toBe('number')
  })
})

describe('WEB_ACTION_TYPES', () => {
  it('covers all 6 action types', () => {
    const expected = [
      'page_opened',
      'text_message_sent',
      'image_uploaded',
      'project_selected_from_web',
      'new_project_requested',
      'step_selected',
    ]
    const values = Object.values(WEB_ACTION_TYPES)
    expect(values).toHaveLength(6)
    for (const e of expected) {
      expect(values).toContain(e)
    }
  })

  it('no duplicate action type values', () => {
    const values = Object.values(WEB_ACTION_TYPES)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })
})
