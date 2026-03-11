import type { TemplateConfig } from '@/templates/types'

export interface User {
  id: string
  phone_number: string
  created_at: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  v0_chat_id: string | null
  v0_project_id: string | null
  preview_url: string | null
  template_config: TemplateConfig | null
  theme: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  project_id: string
  role: 'user' | 'assistant'
  content: string
  image_urls?: string[]
  created_at: string
}

export interface Session {
  id: string
  user_id: string
  phone_number: string
  session_token: string
  source: 'web' | 'twilio'
  expires_at: string
  created_at: string
}

export interface CallSession {
  id: string
  call_sid: string
  user_id: string
  project_id: string | null
  phone_number: string
  state: string
  is_new_user: boolean
  page_opened: boolean
  page_opened_at: string | null
  metadata: Record<string, unknown>
  started_at: string
  ended_at: string | null
  created_at: string
}

export interface Tool {
  id: string
  project_id: string
  tool_type: string
  config: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ToolSubmission {
  id: string
  tool_id: string
  data: Record<string, string>
  submitted_at: string
}
