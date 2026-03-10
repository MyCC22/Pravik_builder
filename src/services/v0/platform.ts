import type { V0Chat, V0Deployment } from '@/lib/types'

const V0_API_BASE = 'https://api.v0.dev/v1'

function headers() {
  return {
    Authorization: `Bearer ${process.env.V0_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

export async function createChat(message: string): Promise<V0Chat> {
  const res = await fetch(`${V0_API_BASE}/chats`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ message }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`v0 createChat failed: ${res.status} ${JSON.stringify(err)}`)
  }
  return res.json()
}

export async function sendMessage(chatId: string, message: string): Promise<V0Chat> {
  const res = await fetch(`${V0_API_BASE}/chats/${chatId}/messages`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ message }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`v0 sendMessage failed: ${res.status} ${JSON.stringify(err)}`)
  }
  return res.json()
}

export async function createDeployment(projectId: string, chatId: string, versionId: string): Promise<V0Deployment> {
  const res = await fetch(`${V0_API_BASE}/deployments`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ projectId, chatId, versionId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`v0 deploy failed: ${res.status} ${JSON.stringify(err)}`)
  }
  return res.json()
}
