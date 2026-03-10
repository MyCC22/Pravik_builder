import { NextRequest, NextResponse } from 'next/server'
import { createDeployment } from '@/services/v0/platform'

export async function POST(req: NextRequest) {
  try {
    const { project_id, chat_id, version_id } = await req.json()

    if (!project_id || !chat_id || !version_id) {
      return NextResponse.json({ error: 'project_id, chat_id, and version_id required' }, { status: 400 })
    }

    const deployment = await createDeployment(project_id, chat_id, version_id)

    return NextResponse.json({ deployment })
  } catch (error) {
    console.error('Deploy error:', error)
    return NextResponse.json({ error: 'Deployment failed' }, { status: 500 })
  }
}
