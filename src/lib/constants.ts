export const ROUTES = {
  LOGIN: '/',
  PROJECTS: '/projects',
  BUILD: (projectId: string) => `/build/${projectId}`,
  SITE: (projectId: string) => `/site/${projectId}`,
} as const

export const API = {
  AUTH_LOGIN: '/api/auth/login',
  PROJECTS: '/api/projects',
  BUILDER_GENERATE: '/api/builder/generate',
  BUILDER_PREVIEW: (projectId: string) => `/api/builder/preview/${projectId}`,
  VOICE_TRANSCRIBE: '/api/voice/transcribe',
} as const
