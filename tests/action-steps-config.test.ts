import { describe, it, expect } from 'vitest'
import { ACTION_STEPS, ACTIONABLE_STEP_IDS, getRemainingCount } from '@/features/action-steps/action-steps-config'

describe('ACTION_STEPS', () => {
  it('has expected number of entries', () => {
    expect(ACTION_STEPS.length).toBe(5)
  })

  it('each step has required fields', () => {
    for (const step of ACTION_STEPS) {
      expect(step).toHaveProperty('id')
      expect(step).toHaveProperty('label')
      expect(step).toHaveProperty('subtitle')
      expect(step).toHaveProperty('comingSoon')
    }
  })

  it('has unique IDs', () => {
    const ids = ACTION_STEPS.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('ACTIONABLE_STEP_IDS', () => {
  it('includes ai_phone (no longer coming soon)', () => {
    expect(ACTIONABLE_STEP_IDS).toContain('ai_phone')
  })

  it('includes all non-coming-soon steps', () => {
    expect(ACTIONABLE_STEP_IDS).toContain('build_site')
    expect(ACTIONABLE_STEP_IDS).toContain('contact_form')
    expect(ACTIONABLE_STEP_IDS).toContain('phone_number')
    expect(ACTIONABLE_STEP_IDS).toContain('call_forwarding')
    expect(ACTIONABLE_STEP_IDS).toContain('ai_phone')
  })
})

describe('getRemainingCount', () => {
  it('returns all when none completed', () => {
    expect(getRemainingCount(new Set())).toBe(5)
  })

  it('decrements when steps are completed', () => {
    expect(getRemainingCount(new Set(['build_site']))).toBe(4)
  })

  it('returns zero when all actionable completed', () => {
    expect(getRemainingCount(new Set(['build_site', 'contact_form', 'phone_number', 'call_forwarding', 'ai_phone']))).toBe(0)
  })

  it('counts ai_phone as actionable', () => {
    expect(getRemainingCount(new Set(['ai_phone']))).toBe(4)
  })
})
