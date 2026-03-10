export const ROUTES = {
  LOGIN: '/',
  PROJECTS: '/projects',
  BUILD: (projectId: string) => `/build/${projectId}`,
} as const

export const API = {
  AUTH_LOGIN: '/api/auth/login',
  PROJECTS: '/api/projects',
  V0_CHAT: '/api/v0/chat',
  V0_MESSAGE: '/api/v0/message',
  V0_DEPLOY: '/api/v0/deploy',
  VOICE_TRANSCRIBE: '/api/voice/transcribe',
} as const
