export type AgentIntent =
  | 'generate_site'
  | 'edit_block'
  | 'add_block'
  | 'remove_block'
  | 'reorder_blocks'
  | 'change_theme'
  | 'change_image'
  | 'edit_tool'
  | 'add_tool'
  | 'clone_site'
  | 'clarify'

export interface RouterResult {
  intent: AgentIntent
  target_blocks: string[]
  description: string
  question?: string
  position?: number
  clone_mode?: 'content' | 'content_and_style'
  clone_url?: string
}

export interface AgentResponse {
  action: 'generated' | 'edited' | 'theme_changed' | 'removed' | 'reordered' | 'tool_created' | 'tool_edited' | 'clarify'
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

export type ToolFieldType = 'text' | 'email' | 'phone' | 'textarea' | 'number' | 'dropdown'

export interface ToolField {
  name: string
  label: string
  type: ToolFieldType
  required: boolean
  placeholder?: string
  options?: string[]
}

export interface ToolConfig {
  title: string
  subtitle: string
  submitText: string
  successMessage: string
  trustSignals: string[]
  fields: ToolField[]
}
