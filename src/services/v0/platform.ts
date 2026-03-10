import { createClient } from 'v0-sdk'

let client: ReturnType<typeof createClient> | null = null

function getClient() {
  if (!client) {
    client = createClient({ apiKey: process.env.V0_API_KEY })
  }
  return client
}

export interface V0ChatResult {
  id: string
  webUrl: string
  demoUrl: string | null
  latestVersionId: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractChatResult(chat: any, fallbackId?: string): V0ChatResult {
  return {
    id: chat.id || fallbackId || '',
    webUrl: chat.webUrl || '',
    demoUrl: chat.latestVersion?.demoUrl || chat.demo || null,
    latestVersionId: chat.latestVersion?.id || null,
  }
}

export async function createChat(message: string): Promise<V0ChatResult> {
  const chat = await getClient().chats.create({ message })
  return extractChatResult(chat)
}

export async function sendMessage(chatId: string, message: string): Promise<V0ChatResult> {
  const chat = await getClient().chats.sendMessage({ chatId, message })
  return extractChatResult(chat, chatId)
}

export async function createDeployment(projectId: string, chatId: string, versionId: string) {
  return getClient().deployments.create({
    projectId,
    chatId,
    versionId,
  })
}
