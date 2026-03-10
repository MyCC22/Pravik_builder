import { NextRequest, NextResponse } from 'next/server'
import { transcribe } from '@/services/whisper/client'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file required' }, { status: 400 })
    }

    const buffer = Buffer.from(await audioFile.arrayBuffer())
    const text = await transcribe(buffer, audioFile.name || 'audio.webm')

    return NextResponse.json({ text })
  } catch (error) {
    console.error('Transcribe error:', error)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
