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
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  project_id: string
  role: 'user' | 'assistant'
  content: string
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

export interface V0Chat {
  id: string
  demo: string
  files?: { name: string; content: string }[]
}

export interface V0Deployment {
  id: string
  url: string
  status: string
}
