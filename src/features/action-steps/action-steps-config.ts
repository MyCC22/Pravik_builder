export interface ActionStep {
  id: string
  label: string
  subtitle: string
  comingSoon: boolean
}

export const ACTION_STEPS: ActionStep[] = [
  { id: 'build_site', label: 'Build website', subtitle: 'Create your site', comingSoon: false },
  { id: 'contact_form', label: 'Add contact form', subtitle: 'Collect leads from visitors', comingSoon: false },
  { id: 'phone_number', label: 'Get phone number', subtitle: 'Local number for your business', comingSoon: false },
  { id: 'ai_phone', label: 'AI phone agent', subtitle: 'Answer calls automatically', comingSoon: true },
]

/** Step IDs that are actionable (not coming soon) */
export const ACTIONABLE_STEP_IDS = ACTION_STEPS
  .filter((s) => !s.comingSoon)
  .map((s) => s.id)

/** Count of remaining actionable steps */
export function getRemainingCount(completedSteps: Set<string>): number {
  return ACTIONABLE_STEP_IDS.filter((id) => !completedSteps.has(id)).length
}
