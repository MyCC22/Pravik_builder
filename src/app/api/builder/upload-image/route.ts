import { NextRequest, NextResponse } from 'next/server'
import { uploadImage } from '@/services/storage/upload'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const projectId = formData.get('project_id') as string | null

    if (!file || !projectId) {
      return NextResponse.json(
        { error: 'file and project_id required' },
        { status: 400 }
      )
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const url = await uploadImage(projectId, buffer, file.type, file.name)

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Image upload error:', error)
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
