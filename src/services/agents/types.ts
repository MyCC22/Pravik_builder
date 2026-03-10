export type AgentIntent =
  | 'generate_site'
  | 'edit_block'
  | 'add_block'
  | 'remove_block'
  | 'reorder_blocks'
  | 'change_theme'
  | 'clarify'

export interface RouterResult {
  intent: AgentIntent
  target_blocks: string[]
  description: string
  question?: string
  position?: number
}

export interface AgentResponse {
  action: 'generated' | 'edited' | 'theme_changed' | 'removed' | 'reordered' | 'clarify'
  message: string
  question?: string
}

export interface Block {
  id: string
  project_id: string
  block_type: string
  html: string
  position: number
}
